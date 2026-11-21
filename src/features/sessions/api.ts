import { useMutation, useQueries, useQuery } from '@tanstack/react-query';

import type { Equipment, Exercise } from '@/features/catalog/api';
import { dayRange, fromList } from '@/features/home/weeks';
import { removeExerciseVideos, removeSessionVideos } from '@/features/recovery/videos';
import { randomSessionName } from '@/features/sessions/session-name';
import { queryClient, unwrap } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';

export type WorkoutSession = Tables<'workout_sessions'>;
export type ExerciseSet = Tables<'exercise_sets'>;
export type SessionExercise = Tables<'session_exercises'> & {
  exercise: Exercise;
  exercise_sets: ExerciseSet[];
  /** Its note, if any (an exercise has at most one; stored in `notes`). */
  notes: { id: string; body: string }[];
};
export type SessionDetail = WorkoutSession & { session_exercises: SessionExercise[] };
/** A session's display name; sessions created before names existed fall back to "Session". */
export const sessionName = (session: Pick<WorkoutSession, 'title'>) =>
  session.title?.trim() || 'Session';

export type SessionSummary = WorkoutSession & {
  session_exercises: {
    id: string;
    position: number;
    exercise_id: string;
    exercise: { name: string };
    exercise_sets: Pick<ExerciseSet, 'id' | 'weight' | 'reps' | 'unit'>[];
  }[];
};

export const sessionKeys = {
  all: ['sessions'] as const,
  list: () => [...sessionKeys.all, 'list'] as const,
  active: () => [...sessionKeys.all, 'active'] as const,
  detail: (id: string) => [...sessionKeys.all, 'detail', id] as const,
  startTimes: () => [...sessionKeys.all, 'start-times'] as const,
  onDay: (day: number) => [...sessionKeys.all, 'day', day] as const,
  exercise: (id: string) => [...sessionKeys.all, 'exercise', id] as const,
  lastPerformance: (exerciseId: string, excludeSessionId: string) =>
    [...sessionKeys.all, 'last', exerciseId, excludeSessionId] as const,
};

const SUMMARY_SELECT =
  '*, session_exercises(id, position, exercise_id, exercise:exercises(name), exercise_sets(id, weight, reps, unit))';

/** The Sessions list holds the newest this many. */
const LIST_LIMIT = 100;
/** Rows per request when reading every session; the API returns at most 1000 (config.toml). */
const PAGE_SIZE = 1000;

const invalidateSessions = () => queryClient.invalidateQueries({ queryKey: sessionKeys.all });

// Queries -----------------------------------------------------------------------

export function useSessions() {
  return useQuery({
    queryKey: sessionKeys.list(),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workout_sessions')
          .select(SUMMARY_SELECT)
          .order('started_at', { ascending: false })
          .order('position', { referencedTable: 'session_exercises' })
          .limit(LIST_LIMIT),
      ) as SessionSummary[],
  });
}

/**
 * When every session started, newest first: the week strip's checks and how far back it goes.
 * Only one column, so a few years of training is still a small download. Reads page by page
 * until it has the count the first page reported.
 */
export function useSessionStartTimes() {
  return useQuery({
    queryKey: sessionKeys.startTimes(),
    queryFn: async () => {
      const times: string[] = [];
      let total = Infinity;
      while (times.length < total) {
        const { data, error, count } = await supabase
          .from('workout_sessions')
          .select('started_at', times.length === 0 ? { count: 'exact' } : undefined)
          .order('started_at', { ascending: false })
          .order('id')
          .range(times.length, times.length + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        for (const row of rows) times.push(row.started_at);
        if (typeof count === 'number') total = count;
        // Nothing more to read (or no count to go by): stop rather than loop.
        if (rows.length === 0 || !Number.isFinite(total)) break;
      }
      return times;
    },
  });
}

/**
 * Sessions started on `day` (local midnight, ms), newest first. Shown straight away from the
 * Sessions list when that list reaches back to the day, then refreshed like any query.
 */
export function useSessionsOnDay(day: number | null) {
  return useQuery({
    queryKey: sessionKeys.onDay(day ?? 0),
    enabled: day !== null,
    queryFn: async () => {
      const { from, to } = dayRange(day ?? 0);
      return unwrap(
        await supabase
          .from('workout_sessions')
          .select(SUMMARY_SELECT)
          .gte('started_at', from)
          .lt('started_at', to)
          .order('started_at', { ascending: false })
          .order('position', { referencedTable: 'session_exercises' }),
      ) as SessionSummary[];
    },
    initialData: () => {
      if (day === null) return undefined;
      const list = queryClient.getQueryData<SessionSummary[]>(sessionKeys.list());
      return list ? fromList(list, day, LIST_LIMIT, (s) => s.started_at) : undefined;
    },
    initialDataUpdatedAt: () => queryClient.getQueryState(sessionKeys.list())?.dataUpdatedAt,
  });
}

/** The most recent unfinished session, if any, so it can be resumed. */
export function useActiveSession() {
  return useQuery({
    queryKey: sessionKeys.active(),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workout_sessions')
          .select(SUMMARY_SELECT)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .order('position', { referencedTable: 'session_exercises' })
          .limit(1)
          .maybeSingle(),
      ) as SessionSummary | null,
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: sessionKeys.detail(id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('workout_sessions')
          .select(
            '*, session_exercises(*, exercise:exercises(*), exercise_sets(*), notes(id, body))',
          )
          .eq('id', id)
          .order('position', { referencedTable: 'session_exercises' })
          .order('position', { referencedTable: 'session_exercises.exercise_sets' })
          .single(),
      ) as SessionDetail,
  });
}

export type LastPerformance = {
  startedAt: string;
  equipment: Equipment | null;
  sets: ExerciseSet[];
} | null;

/** Latest other session containing this exercise with at least one set. */
async function fetchLastPerformance(
  exerciseId: string,
  excludeSessionId: string,
): Promise<LastPerformance> {
  // Latest sessions containing this exercise (inner join filters the sessions).
  const sessions = unwrap(
    await supabase
      .from('workout_sessions')
      .select('started_at, session_exercises!inner(equipment, exercise_sets(*))')
      .eq('session_exercises.exercise_id', exerciseId)
      .neq('id', excludeSessionId)
      .order('started_at', { ascending: false })
      .order('position', { referencedTable: 'session_exercises.exercise_sets' })
      .limit(3),
  );
  for (const session of sessions) {
    const entry = session.session_exercises.find((se) => se.exercise_sets.length > 0);
    if (entry) {
      return {
        startedAt: session.started_at,
        equipment: entry.equipment,
        sets: entry.exercise_sets,
      };
    }
  }
  return null;
}

/**
 * What the user did for this exercise in their latest other session ("what did I do
 * last time?", VIC-64). Used for the hint under each exercise and to prefill sets.
 */
export function useLastPerformance(exerciseId: string, excludeSessionId: string) {
  return useQuery({
    queryKey: sessionKeys.lastPerformance(exerciseId, excludeSessionId),
    queryFn: () => fetchLastPerformance(exerciseId, excludeSessionId),
    enabled: !!exerciseId && !!excludeSessionId,
  });
}

/** Last performance for several exercises at once (the wrap-up looks for new bests). */
export function useLastPerformances(exerciseIds: string[], excludeSessionId: string) {
  return useQueries({
    queries: exerciseIds.map((exerciseId) => ({
      queryKey: sessionKeys.lastPerformance(exerciseId, excludeSessionId),
      queryFn: () => fetchLastPerformance(exerciseId, excludeSessionId),
    })),
  });
}

export type ExerciseUsage = {
  count: number;
  lastAt: string;
  lastSets: SessionSummary['session_exercises'][number]['exercise_sets'];
};

/** How often, and when last, each exercise was logged, from the recent sessions list. */
export function exerciseUsage(sessions: readonly SessionSummary[]) {
  const usage = new Map<string, ExerciseUsage>();
  // Sessions are newest first, so the first sighting is the latest.
  for (const session of sessions) {
    for (const se of session.session_exercises) {
      const entry = usage.get(se.exercise_id);
      if (entry) entry.count += 1;
      else
        usage.set(se.exercise_id, {
          count: 1,
          lastAt: session.started_at,
          lastSets: se.exercise_sets,
        });
    }
  }
  return usage;
}

export type SessionExerciseWithSession = SessionExercise & {
  session: Pick<WorkoutSession, 'id' | 'title' | 'started_at' | 'ended_at'>;
};

/** One exercise in a session, with its session, for the exercise note screen. */
export function useSessionExercise(id: string) {
  return useQuery({
    queryKey: sessionKeys.exercise(id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('session_exercises')
          .select(
            '*, exercise:exercises(*), exercise_sets(*), notes(id, body), session:workout_sessions(id, title, started_at, ended_at)',
          )
          .eq('id', id)
          .single(),
      ) as SessionExerciseWithSession,
  });
}

// Mutations ---------------------------------------------------------------------

/** Starts a new session. Any session still in progress is finished first, so only one is open. */
export function useStartSession() {
  return useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      unwrap(
        await supabase.from('workout_sessions').update({ ended_at: now }).is('ended_at', null),
      );
      return unwrap(
        await supabase
          .from('workout_sessions')
          .insert({ started_at: now, title: randomSessionName() })
          .select()
          .single(),
      );
    },
    onSuccess: invalidateSessions,
  });
}

export function useUpdateSession() {
  return useMutation({
    mutationFn: async ({ id, ...changes }: TablesUpdate<'workout_sessions'> & { id: string }) =>
      unwrap(
        await supabase.from('workout_sessions').update(changes).eq('id', id).select().single(),
      ),
    onSuccess: invalidateSessions,
  });
}

export function useDeleteSession() {
  return useMutation({
    mutationFn: async (id: string) => {
      // Check videos are files; they don't cascade with the rows.
      await removeSessionVideos(id);
      return unwrap(await supabase.from('workout_sessions').delete().eq('id', id));
    },
    onSuccess: invalidateSessions,
  });
}

export function useAddSessionExercise() {
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      exerciseId: string;
      equipment: Equipment | null;
      position: number;
    }) =>
      unwrap(
        await supabase
          .from('session_exercises')
          .insert({
            session_id: input.sessionId,
            exercise_id: input.exerciseId,
            equipment: input.equipment,
            position: input.position,
          })
          .select()
          .single(),
      ),
    onSuccess: invalidateSessions,
  });
}

export function useUpdateSessionExercise() {
  return useMutation({
    mutationFn: async ({ id, ...changes }: TablesUpdate<'session_exercises'> & { id: string }) =>
      unwrap(await supabase.from('session_exercises').update(changes).eq('id', id)),
    onSuccess: invalidateSessions,
  });
}

export function useRemoveSessionExercise() {
  return useMutation({
    mutationFn: async (id: string) => {
      await removeExerciseVideos(id);
      return unwrap(await supabase.from('session_exercises').delete().eq('id', id));
    },
    onSuccess: invalidateSessions,
  });
}

/** Ids of sets shown before the server has saved them (optimistic). */
export const PENDING_SET_PREFIX = 'pending-';
export const isPendingSet = (set: Pick<ExerciseSet, 'id'>) => set.id.startsWith(PENDING_SET_PREFIX);

const SET_MUTATION_KEY = ['sessions', 'set-mutation'] as const;

/** Applies `change` to the session's cached detail and returns what was there, for rollback. */
async function patchSessionDetail(
  sessionId: string,
  change: (exercises: SessionExercise[]) => SessionExercise[],
) {
  const key = sessionKeys.detail(sessionId);
  // A refetch in flight would overwrite the change with the old rows.
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<SessionDetail>(key);
  if (previous) {
    queryClient.setQueryData<SessionDetail>(key, {
      ...previous,
      session_exercises: change(previous.session_exercises),
    });
  }
  return { key, previous };
}

type SetContext = Awaited<ReturnType<typeof patchSessionDetail>>;

const rollback = (_error: unknown, _input: unknown, context: SetContext | undefined) => {
  if (context?.previous) queryClient.setQueryData(context.key, context.previous);
};

/**
 * Refetch once the last set change in a burst has settled. Refetching after each one would
 * briefly drop sets logged since, which are only in the cache until their own insert lands.
 */
const settleSets = () => {
  if (queryClient.isMutating({ mutationKey: SET_MUTATION_KEY }) <= 1) void invalidateSessions();
};

type AddSetInput = {
  sessionId: string;
  sessionExerciseId: string;
  position: number;
  weight: number | null;
  reps: number | null;
  unit: ExerciseSet['unit'];
  setType?: ExerciseSet['set_type'];
};
type UpdateSetInput = TablesUpdate<'exercise_sets'> & { id: string; sessionId: string };

const ADD_SET_KEY = [...SET_MUTATION_KEY, 'add'] as const;
const UPDATE_SET_KEY = [...SET_MUTATION_KEY, 'update'] as const;
const DELETE_SET_KEY = ['sessions', 'delete-set'] as const;

const addSet = async (input: AddSetInput) =>
  unwrap(
    await supabase
      .from('exercise_sets')
      .insert({
        session_exercise_id: input.sessionExerciseId,
        position: input.position,
        weight: input.weight,
        reps: input.reps,
        unit: input.unit,
        set_type: input.setType ?? 'normal',
      })
      .select()
      .single(),
  );

const updateSet = async ({ id, sessionId: _sessionId, ...changes }: UpdateSetInput) =>
  unwrap(await supabase.from('exercise_sets').update(changes).eq('id', id));

const deleteSet = async (id: string) =>
  unwrap(await supabase.from('exercise_sets').delete().eq('id', id));

// Registered on the client (not only in the hooks) so saves made offline can run after the
// app restarts: the persisted cache keeps their input, and these say how to send it.
queryClient.setMutationDefaults(ADD_SET_KEY, { mutationFn: addSet, onSettled: settleSets });
queryClient.setMutationDefaults(UPDATE_SET_KEY, { mutationFn: updateSet, onSettled: settleSets });
queryClient.setMutationDefaults(DELETE_SET_KEY, {
  mutationFn: deleteSet,
  onSuccess: invalidateSessions,
});

/**
 * Logs a set. The chip shows straight away (gyms have bad signal). Offline, the insert waits
 * and is sent when the connection is back; it's rolled back only if the server rejects it.
 */
export function useAddSet() {
  return useMutation({
    mutationKey: ADD_SET_KEY,
    mutationFn: addSet,
    onMutate: (input) =>
      patchSessionDetail(input.sessionId, (exercises) =>
        exercises.map((se) =>
          se.id === input.sessionExerciseId
            ? {
                ...se,
                exercise_sets: [
                  ...se.exercise_sets,
                  {
                    id: `${PENDING_SET_PREFIX}${Date.now()}-${se.exercise_sets.length}`,
                    session_exercise_id: input.sessionExerciseId,
                    position: input.position,
                    weight: input.weight,
                    reps: input.reps,
                    unit: input.unit,
                    set_type: input.setType ?? 'normal',
                    rpe: null,
                    user_id: se.user_id,
                    created_at: new Date().toISOString(),
                  },
                ],
              }
            : se,
        ),
      ),
    onError: rollback,
    onSettled: settleSets,
  });
}

/** Edits a set, showing the new values straight away. */
export function useUpdateSet() {
  return useMutation({
    mutationKey: UPDATE_SET_KEY,
    mutationFn: updateSet,
    onMutate: ({ id, sessionId, ...changes }) =>
      patchSessionDetail(sessionId, (exercises) =>
        exercises.map((se) => ({
          ...se,
          exercise_sets: se.exercise_sets.map((set) =>
            set.id === id ? { ...set, ...changes } : set,
          ),
        })),
      ),
    onError: rollback,
    onSettled: settleSets,
  });
}

export function useDeleteSet() {
  return useMutation({
    mutationKey: DELETE_SET_KEY,
    mutationFn: deleteSet,
    onSuccess: invalidateSessions,
  });
}
