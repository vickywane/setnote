import { useMutation, useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useAuthStore } from '@/features/auth/auth-store';
import { queryClient, unwrap } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { joinWavs, waveformOf } from '@/lib/wav';
import type { Tables } from '@/types/database';

/**
 * Voice recordings on a note: the audio behind text that was spoken into it. Files are in the
 * private `note-audio` bucket at <user_id>/<note_id>/<time>-<random>.wav. See
 * supabase/migrations/20261019120000_note_recordings.sql.
 */
export type NoteRecording = Tables<'note_recordings'>;

const BUCKET = 'note-audio';
/** How long a playback link lasts; refetched before it runs out. */
const SIGNED_URL_SECONDS = 60 * 60;

export const recordingKeys = {
  all: ['note-recordings'] as const,
  forNote: (noteId: string) => [...recordingKeys.all, 'note', noteId] as const,
  url: (path: string) => [...recordingKeys.all, 'url', path] as const,
};

export function useNoteRecordings(noteId: string | null) {
  return useQuery({
    queryKey: recordingKeys.forNote(noteId ?? 'new'),
    enabled: noteId !== null,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('note_recordings')
          .select('*')
          .eq('note_id', noteId ?? '')
          .order('created_at', { ascending: true }),
      ),
  });
}

/** A short-lived link to play a recording. */
export function useRecordingUrl(path: string | null) {
  return useQuery({
    queryKey: recordingKeys.url(path ?? ''),
    enabled: path !== null,
    staleTime: (SIGNED_URL_SECONDS - 5 * 60) * 1000,
    queryFn: async () =>
      unwrap(await supabase.storage.from(BUCKET).createSignedUrl(path ?? '', SIGNED_URL_SECONDS))
        .signedUrl,
  });
}

/** Bars in a clip's waveform (Figma "AudioClip"). */
export const WAVEFORM_BARS = 32;

/**
 * Uploads a finished recording and adds it to the note. A recording paused and picked up again
 * arrives as several files; they're joined into one first. The local files are removed after.
 */
export function useAddRecording() {
  return useMutation({
    mutationFn: async (input: {
      noteId: string;
      uris: string[];
      durationMs: number;
      transcript: string;
    }) => {
      const userId = useAuthStore.getState().session?.user.id;
      if (!userId) throw new Error('Not signed in');
      const files = input.uris.map((uri) => new File(uri)).filter((f) => f.exists);
      if (files.length === 0) throw new Error('The recording file is missing');
      const pieces = await Promise.all(files.map((f) => f.bytes()));
      const audio = pieces.length === 1 ? pieces[0] : (joinWavs(pieces) ?? pieces[0]);

      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const path = `${userId}/${input.noteId}/${name}.wav`;
      unwrap(await supabase.storage.from(BUCKET).upload(path, audio, { contentType: 'audio/wav' }));
      const row = unwrap(
        await supabase
          .from('note_recordings')
          .insert({
            note_id: input.noteId,
            path,
            duration_ms: Math.round(input.durationMs),
            transcript: input.transcript,
            waveform: waveformOf(audio, WAVEFORM_BARS),
          })
          .select()
          .single(),
      );
      for (const file of files) {
        try {
          file.delete();
        } catch {
          // Left in the cache directory; the system clears it.
        }
      }
      return row;
    },
    onSuccess: (row) =>
      queryClient.invalidateQueries({ queryKey: recordingKeys.forNote(row.note_id) }),
  });
}

/** Deletes a recording and its audio. The words it added stay in the note. */
export function useDeleteRecording() {
  return useMutation({
    mutationFn: async (recording: NoteRecording) => {
      unwrap(await supabase.storage.from(BUCKET).remove([recording.path]));
      unwrap(await supabase.from('note_recordings').delete().eq('id', recording.id));
      return recording;
    },
    onSuccess: (recording) =>
      queryClient.invalidateQueries({ queryKey: recordingKeys.forNote(recording.note_id) }),
  });
}

/** Saves a new transcript for a recording (after re-transcribing it). */
export function useUpdateRecordingTranscript() {
  return useMutation({
    mutationFn: async ({
      recording,
      transcript,
    }: {
      recording: NoteRecording;
      transcript: string;
    }) =>
      unwrap(
        await supabase
          .from('note_recordings')
          .update({ transcript })
          .eq('id', recording.id)
          .select()
          .single(),
      ),
    onSuccess: (row) =>
      queryClient.invalidateQueries({ queryKey: recordingKeys.forNote(row.note_id) }),
  });
}

/** Downloads a recording to the cache directory, for sharing or re-transcribing. */
export async function downloadRecording(recording: NoteRecording) {
  const { signedUrl } = unwrap(
    await supabase.storage.from(BUCKET).createSignedUrl(recording.path, 60),
  );
  const name = recording.path.split('/').pop() ?? `${recording.id}.wav`;
  const file = await File.downloadFileAsync(signedUrl, new File(Paths.cache, name), {
    idempotent: true,
  });
  return file.uri;
}

/** Opens the share sheet with a recording's audio. */
export async function shareRecording(recording: NoteRecording) {
  const uri = await downloadRecording(recording);
  await Sharing.shareAsync(uri, { mimeType: 'audio/wav', UTI: 'com.microsoft.waveform-audio' });
}

/** Removes a note's audio files, before the note (and so its recording rows) is deleted. */
export async function removeNoteAudio(noteId: string) {
  const rows = unwrap(await supabase.from('note_recordings').select('path').eq('note_id', noteId));
  if (rows.length === 0) return;
  unwrap(await supabase.storage.from(BUCKET).remove(rows.map((r) => r.path)));
}

/** Removes every audio file of the signed-in user, before deleting the account. */
export async function removeAllNoteAudio() {
  const rows = unwrap(await supabase.from('note_recordings').select('path'));
  if (rows.length === 0) return;
  unwrap(await supabase.storage.from(BUCKET).remove(rows.map((r) => r.path)));
}
