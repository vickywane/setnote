import { useMutation, useQuery } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';

import { useAuthStore } from '@/features/auth/auth-store';
import { queryClient, unwrap } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { RecordedVideo } from '@/modules/presage-vitals';

import type { RecoveryCheck } from './api';

/**
 * Videos of recovery checks, to rewatch. Saved only when the person turned on "Save check
 * videos" in Settings and left it on for that check. Signed-in users' videos go to the
 * private `recovery-videos` bucket at <user_id>/<check_id>.mp4; a guest's stay on the phone
 * in the documents folder (recovery-videos/<check_id>.mp4). See
 * supabase/migrations/20261119090000_recovery_check_videos.sql.
 */
const BUCKET = 'recovery-videos';
const DEVICE_FOLDER = 'recovery-videos';
const SIGNED_URL_SECONDS = 60 * 60;

type VideoRef = Pick<RecoveryCheck, 'video_path' | 'video_location'>;

export const videoKeys = {
  url: (path: string) => ['recovery-video', path] as const,
};

/** Where a new video goes: the account for signed-in users, the phone for guests. */
export function videoLocation(): 'cloud' | 'device' {
  return (useAuthStore.getState().session?.user.is_anonymous ?? true) ? 'device' : 'cloud';
}

const deviceFile = (path: string) => new File(Paths.document, path);

/** Keeps a finished recording with its saved check: uploads it or moves it into place. */
export async function storeCheckVideo(
  check: Pick<RecoveryCheck, 'id' | 'user_id'>,
  video: RecordedVideo,
): Promise<{ video_path: string; video_location: 'cloud' | 'device' }> {
  const source = new File(video.uri);
  if (!source.exists) throw new Error('The video file is missing');
  if (videoLocation() === 'cloud') {
    const path = `${check.user_id}/${check.id}.mp4`;
    const bytes = await source.bytes();
    unwrap(
      await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: 'video/mp4',
        upsert: true,
      }),
    );
    try {
      source.delete();
    } catch {
      // Left in the cache directory; the system clears it.
    }
    return { video_path: path, video_location: 'cloud' };
  }
  const folder = new Directory(Paths.document, DEVICE_FOLDER);
  folder.create({ intermediates: true, idempotent: true });
  const path = `${DEVICE_FOLDER}/${check.id}.mp4`;
  const target = deviceFile(path);
  if (target.exists) target.delete();
  await source.move(target);
  return { video_path: path, video_location: 'device' };
}

/** Deletes the files behind these checks' videos (before the checks themselves go). */
export async function removeVideos(refs: VideoRef[]) {
  const cloud = refs.filter((r) => r.video_location === 'cloud' && r.video_path);
  for (const ref of refs) {
    if (ref.video_location !== 'device' || !ref.video_path) continue;
    try {
      const file = deviceFile(ref.video_path);
      if (file.exists) file.delete();
    } catch {
      // Already gone.
    }
  }
  if (cloud.length > 0) {
    unwrap(await supabase.storage.from(BUCKET).remove(cloud.map((r) => r.video_path as string)));
  }
}

const VIDEO_COLUMNS = 'video_path, video_location';

/** Removes the videos of a session's checks, before the session is deleted. */
export async function removeSessionVideos(sessionId: string) {
  const rows = unwrap(
    await supabase
      .from('recovery_checks')
      .select(VIDEO_COLUMNS)
      .eq('session_id', sessionId)
      .not('video_path', 'is', null),
  );
  await removeVideos(rows);
}

/** Removes the video of an exercise's check, before the exercise is removed. */
export async function removeExerciseVideos(sessionExerciseId: string) {
  const rows = unwrap(
    await supabase
      .from('recovery_checks')
      .select(VIDEO_COLUMNS)
      .eq('session_exercise_id', sessionExerciseId)
      .not('video_path', 'is', null),
  );
  await removeVideos(rows);
}

/** Removes every check video of this user, before deleting the account. */
export async function removeAllVideos() {
  const rows = unwrap(
    await supabase.from('recovery_checks').select(VIDEO_COLUMNS).not('video_path', 'is', null),
  );
  await removeVideos(rows);
  removeDeviceVideos();
}

/** Removes the check videos kept on this phone (guest videos never leave it). */
export function removeDeviceVideos() {
  try {
    const folder = new Directory(Paths.document, DEVICE_FOLDER);
    if (folder.exists) folder.delete();
  } catch {
    // Nothing on this phone.
  }
}

/** Something a video player can open: a file on the phone or a short-lived link. */
export function useCheckVideoSource(check: VideoRef | null) {
  const path = check?.video_path ?? null;
  const location = check?.video_location ?? null;
  return useQuery({
    queryKey: videoKeys.url(path ?? ''),
    enabled: path !== null,
    staleTime: location === 'cloud' ? (SIGNED_URL_SECONDS - 5 * 60) * 1000 : Infinity,
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      if (location === 'device') {
        const file = deviceFile(path);
        return file.exists ? file.uri : null;
      }
      return unwrap(await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS))
        .signedUrl;
    },
  });
}

/** Deletes a check's video and keeps its numbers. */
export function useDeleteCheckVideo() {
  return useMutation({
    mutationFn: async (check: RecoveryCheck) => {
      await removeVideos([check]);
      return unwrap(
        await supabase
          .from('recovery_checks')
          .update({ video_path: null, video_location: null })
          .eq('id', check.id)
          .select()
          .single(),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recovery'] }),
  });
}
