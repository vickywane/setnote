import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient, unwrap } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { RecordedVideo } from '@/modules/presage-vitals';
import type { Tables, TablesInsert } from '@/types/database';

import { removeVideos, storeCheckVideo } from './videos';

/** A reading for a whole session (`session_exercise_id` null) or for one exercise in it. */
export type RecoveryCheck = Tables<'recovery_checks'>;

/** A past check, with which exercise it was taken after (null for session checks). */
export type RecentRecoveryCheck = RecoveryCheck & {
  session_exercise: { exercise_id: string } | null;
};

export const recoveryKeys = {
  all: ['recovery'] as const,
  session: (sessionId: string) => [...recoveryKeys.all, 'session', sessionId] as const,
  check: (id: string) => [...recoveryKeys.all, 'check', id] as const,
  recent: () => [...recoveryKeys.all, 'recent'] as const,
};

/** How many past checks "your usual" looks at. */
const RECENT_LIMIT = 50;

const invalidate = () => queryClient.invalidateQueries({ queryKey: recoveryKeys.all });

/** Every check taken in this session: the session's own and its exercises'. */
export function useSessionRecoveryChecks(sessionId: string) {
  return useQuery({
    queryKey: recoveryKeys.session(sessionId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('recovery_checks')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at'),
      ) as RecoveryCheck[],
  });
}

/** One check, with the exercise it was taken after, for watching its video. */
export function useRecoveryCheck(id: string) {
  return useQuery({
    queryKey: recoveryKeys.check(id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('recovery_checks')
          .select('*, session_exercise:session_exercises(exercise_id, exercise:exercises(name))')
          .eq('id', id)
          .maybeSingle(),
      ) as
        | (RecoveryCheck & {
            session_exercise: { exercise_id: string; exercise: { name: string } } | null;
          })
        | null,
  });
}

/** The newest checks first, for comparing with "your usual". */
export function useRecentRecoveryChecks() {
  return useQuery({
    queryKey: recoveryKeys.recent(),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('recovery_checks')
          .select('*, session_exercise:session_exercises(exercise_id)')
          .order('created_at', { ascending: false })
          .limit(RECENT_LIMIT),
      ) as RecentRecoveryCheck[],
  });
}

/**
 * Earlier checks to compare with: session checks for a session, and checks taken after the
 * same exercise (in other sessions) for an exercise.
 */
export function comparableChecks(
  checks: RecentRecoveryCheck[],
  target: { exerciseId: string | null; before?: string; excludeSessionId?: string },
) {
  return checks.filter(
    (c) =>
      (c.session_exercise?.exercise_id ?? null) === target.exerciseId &&
      (target.exerciseId !== null || c.session_exercise_id === null) &&
      c.session_id !== target.excludeSessionId &&
      (!target.before || c.created_at < target.before),
  );
}

/**
 * Saves a check for the session or one of its exercises, replacing an earlier one (a retake,
 * whose video goes too), and keeps its video if it recorded one. A video that can't be saved
 * doesn't lose the reading: the check is saved without it and `videoError` says why.
 */
export function useSaveRecoveryCheck() {
  return useMutation({
    mutationFn: async ({
      check,
      video,
    }: {
      check: TablesInsert<'recovery_checks'>;
      video?: RecordedVideo | null;
    }) => {
      const sameTarget = <T extends { eq: Function; is: Function }>(query: T): T =>
        check.session_exercise_id
          ? query.eq('session_exercise_id', check.session_exercise_id)
          : query.is('session_exercise_id', null);
      const earlier = unwrap(
        await sameTarget(
          supabase
            .from('recovery_checks')
            .select('video_path, video_location')
            .eq('session_id', check.session_id),
        ),
      );
      await removeVideos(earlier);
      unwrap(
        await sameTarget(
          supabase.from('recovery_checks').delete().eq('session_id', check.session_id),
        ),
      );
      const saved = unwrap(await supabase.from('recovery_checks').insert(check).select().single());
      if (!video) return { check: saved, videoError: null };
      try {
        const stored = await storeCheckVideo(saved, video);
        const withVideo = unwrap(
          await supabase
            .from('recovery_checks')
            .update(stored)
            .eq('id', saved.id)
            .select()
            .single(),
        );
        return { check: withVideo, videoError: null };
      } catch (error) {
        return { check: saved, videoError: (error as Error).message };
      }
    },
    onSuccess: invalidate,
  });
}
