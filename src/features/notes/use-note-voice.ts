import { useState } from 'react';
import { Alert } from 'react-native';

import type { Segment } from '@/features/notes/highlight';
import {
  downloadRecording,
  type NoteRecording,
  shareRecording,
  useAddRecording,
  useDeleteRecording,
  useNoteRecordings,
  useUpdateRecordingTranscript,
} from '@/features/notes/recordings';
import { useClipPlayer } from '@/features/notes/use-clip-player';
import { useVoiceNote } from '@/features/notes/use-voice-note';

/** A recording being saved: shown as a clip straight away, before the upload finishes. */
export type PendingRecording = { key: string; durationMs: number };

/**
 * Voice on a note screen (Figma "05 · Voice notes"). What's said lands on the paper as you talk
 * and is added to the note's text, so it's read by the parser like anything typed; the audio is
 * kept on the note as a recording to play back, share, re-transcribe or delete.
 */
export function useNoteVoice({
  body,
  saveNow,
  noteId,
  getNoteId,
  hints,
}: {
  body: string;
  /** Sets and saves the note's text; the note exists once this resolves. */
  saveNow: (text: string) => Promise<void>;
  /** The saved note's id, if it has been saved. */
  noteId: string | null;
  /** The id right now, including a note created moments ago. */
  getNoteId: () => string | null;
  hints: string[];
}) {
  // A note created by speaking into it gets its id after the screen opened.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const id = noteId ?? createdId;
  const recordingsQuery = useNoteRecordings(id);
  const recordings = recordingsQuery.data ?? [];
  const addRecording = useAddRecording();
  const deleteRecording = useDeleteRecording();
  const updateTranscript = useUpdateRecordingTranscript();
  const [pending, setPending] = useState<PendingRecording[]>([]);
  const [menu, setMenu] = useState<{ recording: NoteRecording; top: number } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<NoteRecording | null>(null);
  const [transcribingMs, setTranscribingMs] = useState<number | null>(null);
  const player = useClipPlayer(recordings);

  const voice = useVoiceNote({
    hints,
    onDone: async ({ text, uris, durationMs }) => {
      if (!text.trim()) {
        // Nothing to add to the note, so the audio isn't kept either.
        Alert.alert(
          'Didn’t catch that',
          'Nothing was heard. Try again a little closer to the phone.',
        );
        return;
      }
      const next = joinText(body, text);
      const key = String(Date.now());
      if (uris.length > 0) setPending((p) => [...p, { key, durationMs }]);
      await saveNow(next);
      const savedId = getNoteId();
      if (uris.length === 0) return;
      if (!savedId) {
        setPending((p) => p.filter((r) => r.key !== key));
        Alert.alert('Recording not saved', 'Your words are on the page, but the note didn’t save.');
        return;
      }
      setCreatedId(savedId);
      try {
        await addRecording.mutateAsync({ noteId: savedId, uris, durationMs, transcript: text });
      } catch (error) {
        Alert.alert(
          'Recording not saved',
          `Your words are on the page, but the audio couldn’t be saved. ${(error as Error).message}`,
        );
      } finally {
        setPending((p) => p.filter((r) => r.key !== key));
      }
    },
  });

  const recordingActive = voice.state !== 'idle' && voice.state !== 'transcribing';

  /** The note's words with what's being heard added on, lighter until it's confirmed. */
  const withLiveWords = (segments: Segment[]): Segment[] => {
    if (!recordingActive) return segments;
    const { final, interim } = voice.heard;
    if (!final && !interim) return segments;
    const separator = body.trim() ? '\n' : '';
    const base = body.trim() ? [...trimEnd(segments)] : [];
    return [
      ...base,
      { text: separator + final, picked: false },
      ...(interim ? [{ text: (final ? ' ' : '') + interim, picked: false, pending: true }] : []),
    ];
  };

  /** Re-reads a recording and puts the new words where the old ones were. */
  const retranscribe = async (recording: NoteRecording) => {
    setTranscribingMs(recording.duration_ms);
    try {
      const uri = await downloadRecording(recording);
      const text = await voice.transcribeFile(uri);
      if (!text) {
        Alert.alert('Nothing new heard', 'The recording was read again, but no words came out.');
        return;
      }
      const old = recording.transcript.trim();
      const at = old ? body.indexOf(old) : -1;
      const next =
        at >= 0 ? body.slice(0, at) + text + body.slice(at + old.length) : joinText(body, text);
      await saveNow(next);
      await updateTranscript.mutateAsync({ recording, transcript: text });
    } catch (error) {
      Alert.alert("Couldn't transcribe the recording", (error as Error).message);
    } finally {
      setTranscribingMs(null);
    }
  };

  const share = (recording: NoteRecording) =>
    shareRecording(recording).catch((error: Error) =>
      Alert.alert("Couldn't share the recording", error.message),
    );

  const confirmDelete = async () => {
    const recording = confirmingDelete;
    if (!recording) return;
    try {
      if (player.open?.id === recording.id) player.close();
      await deleteRecording.mutateAsync(recording);
      setConfirmingDelete(null);
    } catch (error) {
      Alert.alert("Couldn't delete the recording", (error as Error).message);
    }
  };

  return {
    voice,
    recordingActive,
    recordings,
    pending,
    player,
    withLiveWords,
    /** "LISTENING" (or "PAUSED") after the overline while recording. */
    listening: recordingActive,
    /** The latest recording's length, for the peek's "from your 0:48 recording". */
    recordingMs: recordings.at(-1)?.duration_ms ?? null,
    transcribingMs:
      transcribingMs ?? (voice.state === 'finishing' ? voice.clock.beforeMs || null : null),
    menu,
    openMenu: (recording: NoteRecording, top: number) => setMenu({ recording, top }),
    closeMenu: () => setMenu(null),
    confirmingDelete,
    askDelete: (recording: NoteRecording) => setConfirmingDelete(recording),
    cancelDelete: () => setConfirmingDelete(null),
    confirmDelete,
    deleting: deleteRecording.isPending,
    retranscribe,
    share,
  };
}

/** Adds spoken words to a note on a new line. */
function joinText(body: string, text: string) {
  return body.trim() ? `${body.trimEnd()}\n${text}` : text;
}

/** Segments with trailing whitespace removed from the last, so live words follow straight on. */
function trimEnd(segments: Segment[]): Segment[] {
  const out = [...segments];
  while (out.length > 0) {
    const last = out[out.length - 1];
    const trimmed = last.text.trimEnd();
    if (trimmed) {
      out[out.length - 1] = { ...last, text: trimmed };
      break;
    }
    out.pop();
  }
  return out;
}
