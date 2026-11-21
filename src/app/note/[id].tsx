import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { YStack } from 'tamagui';

import { Button } from '@/components/ds/controls';
import { BottomSheet } from '@/components/ds/sheet';
import { AppText } from '@/components/ds/text';
import { useUser } from '@/features/auth/auth-store';
import { type Exercise, useCreateExercise, useExercises } from '@/features/catalog/api';
import { AddExerciseSheet } from '@/features/catalog/components/add-exercise-sheet';
import { time } from '@/features/home/format';
import { useCreateNote, useDeleteNote, useNote, useUpdateNote } from '@/features/notes/api';
import { highlightNote } from '@/features/notes/highlight';
import { NoteScreen } from '@/features/notes/components/note-screen';
import { PickedUpPeek, PickedUpSheet } from '@/features/notes/components/picked-up';
import { useNoteDraft } from '@/features/notes/use-note-draft';
import { cachedNoteReading, useNoteReading } from '@/features/notes/use-note-reading';
import { useNoteVoice } from '@/features/notes/use-note-voice';
import { usePickedUp } from '@/features/notes/use-picked-up';
import { PopoverMenu } from '@/features/sessions/components/session-chrome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/lib/analytics';
import { type ExtractedNote, parseNote } from '@/lib/extraction/parse-note';
import { palette } from '@/theme/tamagui.config';

const NO_EXERCISES: Exercise[] = [];

/** Figma "Note / Writing", "Note / Empty", "Note / Detecting": a written note on lined paper. */
export default function NoteWritingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const insets = useSafeAreaInsets();
  const user = useUser();
  const note = useNote(isNew ? null : id);
  const exercises = useExercises();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const createExercise = useCreateExercise();
  const catalog = exercises.data ?? NO_EXERCISES;

  const noteId = useRef<string | null>(isNew ? null : id);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  const draft = useNoteDraft({
    initial: note.data?.body,
    ready: isNew || !!note.data,
    save: async (text) => {
      // Claude's reading if it's already in for this text; otherwise the on-device parse, which
      // the reading replaces when it arrives (below).
      const extracted = cachedNoteReading(text, catalog) ?? parseNote(text, catalog);
      if (noteId.current) {
        await updateNote.mutateAsync({ id: noteId.current, body: text, extracted });
      } else {
        const created = await createNote.mutateAsync({ body: text, extracted });
        noteId.current = created.id;
        track('note_saved');
      }
    },
    // Notes never keep empty text.
    onLeaveEmpty: () => {
      if (noteId.current) deleteNote.mutate(noteId.current);
    },
  });

  const reading = useNoteReading(draft.detected, catalog);
  const parsed = useMemo(() => parseNote(draft.detected, catalog), [draft.detected, catalog]);
  const extracted = reading.data ?? parsed;
  // When Claude's reading arrives for the saved text, save it with the note.
  const savedReading = useRef<ExtractedNote | null>(null);
  useEffect(() => {
    const data = reading.data;
    if (!data || savedReading.current === data || !noteId.current) return;
    if (draft.detected !== draft.body) return; // Still typing; the next save picks it up.
    savedReading.current = data;
    updateNote.mutate({ id: noteId.current, body: draft.body, extracted: data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading.data, draft.detected, draft.body]);
  const segments = useMemo(() => highlightNote(draft.body, catalog), [draft.body, catalog]);
  const picked = usePickedUp({
    extracted,
    catalog,
    hasText: draft.body.trim() !== '',
    detecting: draft.body !== draft.detected || exercises.isLoading,
    refining: reading.isFetching,
  });
  const hints = useMemo(() => catalog.map((e) => e.name), [catalog]);
  const voice = useNoteVoice({
    body: draft.body,
    saveNow: draft.saveNow,
    noteId: isNew ? null : id,
    getNoteId: () => noteId.current,
    hints,
  });

  if (!isNew && !note.data) {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$3"
        padding="$6"
        paddingTop={insets.top}>
        {note.isLoading ? (
          <ActivityIndicator color={palette.color9} />
        ) : (
          <>
            <AppText variant="title">Couldn’t open this note</AppText>
            <AppText color="$colorMuted" textAlign="center">
              {note.error?.message ?? 'It may have been deleted.'}
            </AppText>
            <Button label="Back to Notes" kind="secondary" onPress={() => router.back()} />
          </>
        )}
      </YStack>
    );
  }

  const createdAt = note.data?.created_at;
  const spoken = voice.recordings.length > 0 || voice.pending.length > 0;
  const overline = createdAt
    ? `${time(new Date(createdAt))} · ${spoken ? 'VOICE NOTE' : 'WRITTEN NOTE'}`
    : spoken
      ? 'NEW VOICE NOTE'
      : 'NEW NOTE';

  const remove = async () => {
    try {
      if (noteId.current) await deleteNote.mutateAsync(noteId.current);
      noteId.current = null;
      draft.setBody('');
      setConfirmingDelete(false);
      router.back();
    } catch (error) {
      Alert.alert("Couldn't delete the note", (error as Error).message);
    }
  };

  /** "Pick an exercise": write the chosen name over the one the parser didn't know. */
  const pickExercise = (exercise: Exercise) => {
    if (!picking) return;
    const at = draft.body.toLowerCase().indexOf(picking.toLowerCase());
    if (at >= 0) {
      draft.setBody(
        draft.body.slice(0, at) + exercise.name + draft.body.slice(at + picking.length),
      );
    }
    setPicking(null);
  };

  return (
    <NoteScreen
      backLabel="Notes"
      onBack={() => router.back()}
      saveState={draft.saveState}
      onMore={() => setMenuOpen(true)}
      overline={overline}
      segments={segments}
      onChangeText={draft.setBody}
      placeholder={'What did you do today?\nTry “Bench 80kg 8, 8, 6”, or just write how it felt.'}
      footer={
        <PickedUpPeek
          state={picked.peek}
          onOpen={() => setSummaryOpen(true)}
          recordingMs={voice.recordingMs}
          transcribingMs={voice.transcribingMs}
        />
      }
      voice={voice}>
      <PickedUpSheet
        open={summaryOpen}
        items={picked.items}
        onClose={() => setSummaryOpen(false)}
        onAnswer={(index, question, value) => {
          const name = picked.items[index]?.exercise.name;
          if (question.kind === 'new-exercise') {
            if (value === 'pick' && name) {
              setSummaryOpen(false);
              setPicking(name);
            } else if (value === 'add' && name && user) {
              createExercise
                .mutateAsync({ name, userId: user.id })
                .catch((error: Error) => Alert.alert("Couldn't add the exercise", error.message));
            }
            return;
          }
          picked.answer(index, question, value);
        }}
        onConfirm={() => {
          setSummaryOpen(false);
          if (noteId.current) {
            updateNote.mutate({ id: noteId.current, body: draft.body, extracted: picked.reviewed });
          }
        }}
      />
      <AddExerciseSheet
        open={picking !== null}
        title="Pick an exercise"
        busy={false}
        onClose={() => setPicking(null)}
        onAdd={pickExercise}
        onCreate={() => setPicking(null)}
      />
      <PopoverMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        top={insets.top + 48}
        right={16}
        items={[
          {
            label: 'Delete note',
            icon: 'trash',
            destructive: true,
            onPress: () => setConfirmingDelete(true),
          },
        ]}
      />
      <BottomSheet
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this note?"
        designHeight={360}>
        <AppText color="$colorMuted">
          The note and what was picked up from it are removed. This can’t be undone.
        </AppText>
        <Button
          label="Delete note"
          kind="destructive"
          loading={deleteNote.isPending}
          onPress={() => void remove()}
        />
        <Button label="Keep note" kind="ghost" onPress={() => setConfirmingDelete(false)} />
      </BottomSheet>
    </NoteScreen>
  );
}
