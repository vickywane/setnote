import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { Button } from '@/components/ds/controls';
import { AppText } from '@/components/ds/text';
import { EQUIPMENT_LABELS, type Exercise, useExercises } from '@/features/catalog/api';
import { useCreateNote, useDeleteNote, useExerciseNote, useUpdateNote } from '@/features/notes/api';
import { highlightNote } from '@/features/notes/highlight';
import { NoteExerciseHeader, NoteScreen } from '@/features/notes/components/note-screen';
import { PickedUpPeek, PickedUpSheet } from '@/features/notes/components/picked-up';
import { useNoteDraft } from '@/features/notes/use-note-draft';
import { describeSets, setsFromNote, setsToLog } from '@/features/notes/note-sets';
import { cachedNoteReading, useNoteReading } from '@/features/notes/use-note-reading';
import { useNoteVoice } from '@/features/notes/use-note-voice';
import { usePickedUp } from '@/features/notes/use-picked-up';
import {
  sessionName,
  useAddSet,
  useLastPerformance,
  useSessionExercise,
} from '@/features/sessions/api';
import { formatSetList, lastDayLabel } from '@/features/sessions/format';
import { feedback } from '@/lib/feedback';
import { plural } from '@/lib/format';
import { usePreferencesStore } from '@/stores/preferences-store';
import { type ExtractedNote, parseNote } from '@/lib/extraction/parse-note';
import { palette } from '@/theme/tamagui.config';

const NO_EXERCISES: Exercise[] = [];

/**
 * The note writing screen for one exercise in a session (Figma "Note / Exercise note"): the
 * session it belongs to in the back button, the exercise and what you did last time above the
 * paper. Saved in `notes`, linked to the exercise (and so to its session).
 */
export default function ExerciseNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const sessionExercise = useSessionExercise(id);
  const exercises = useExercises();
  const note = useExerciseNote(id);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const noteId = useRef<string | null>(null);
  useEffect(() => {
    if (note.data && !noteId.current) noteId.current = note.data.id;
  }, [note.data]);
  const catalog = exercises.data ?? NO_EXERCISES;
  const data = sessionExercise.data;
  const last = useLastPerformance(data?.exercise_id ?? '', data?.session_id ?? '');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const unit = usePreferencesStore((state) => state.weightUnit);
  const addSet = useAddSet();
  // Sets logged from the note that this screen's copy of the exercise doesn't have yet; cleared
  // once it refetches, so reopening the sheet can't log them twice.
  const loggedCount = sessionExercise.data?.exercise_sets.length;
  const [extra, setExtra] = useState({ base: loggedCount, sets: 0 });
  if (extra.base !== loggedCount) setExtra({ base: loggedCount, sets: 0 });
  const justLogged = extra.base === loggedCount ? extra.sets : 0;

  const draft = useNoteDraft({
    initial: note.data?.body ?? '',
    ready: !!data && note.isFetched,
    save: async (text) => {
      const withName = `${data?.exercise.name ?? ''}\n${text}`;
      const parsedText = withKnownEquipment(
        cachedNoteReading(withName, catalog) ?? parseNote(withName, catalog),
        data?.equipment ?? null,
      );
      if (noteId.current) {
        await updateNote.mutateAsync({ id: noteId.current, body: text, extracted: parsedText });
      } else {
        const created = await createNote.mutateAsync({
          body: text,
          extracted: parsedText,
          sessionExerciseId: id,
          sessionId: data?.session_id,
        });
        noteId.current = created.id;
      }
    },
    // Notes never hold empty text: an emptied note is deleted.
    onLeaveEmpty: () => {
      if (noteId.current) deleteNote.mutate(noteId.current);
    },
  });

  // Read the note as if it starts with the exercise's name, so lines like "80kg 8, 8, 6" belong
  // to it; the equipment is already known from the session.
  const name = data?.exercise.name ?? '';
  const knownEquipment = data?.equipment ?? null;
  const withName = `${name}\n${draft.detected}`;
  const reading = useNoteReading(draft.detected.trim() ? withName : '', catalog);
  const extracted = withKnownEquipment(
    reading.data ?? parseNote(withName, catalog),
    knownEquipment,
  );
  // When Claude's reading arrives for the saved text, save it with the note.
  const savedReading = useRef<ExtractedNote | null>(null);
  useEffect(() => {
    if (!reading.data || savedReading.current === reading.data || !noteId.current) return;
    if (draft.detected !== draft.body) return;
    savedReading.current = reading.data;
    updateNote.mutate({ id: noteId.current, body: draft.body, extracted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading.data, draft.detected, draft.body]);
  const segments = useMemo(() => highlightNote(draft.body, catalog), [draft.body, catalog]);
  const hasText = draft.body.trim() !== '';
  const picked = usePickedUp({
    extracted: hasText ? extracted : { version: 1, exercises: [] },
    catalog,
    hasText,
    detecting: draft.body !== draft.detected || exercises.isLoading,
    refining: reading.isFetching,
  });
  const hints = useMemo(() => catalog.map((e) => e.name), [catalog]);
  const voice = useNoteVoice({
    body: draft.body,
    saveNow: draft.saveNow,
    noteId: note.data?.id ?? null,
    getNoteId: () => noteId.current,
    hints,
  });

  if (!data) {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$3"
        padding="$6"
        paddingTop={insets.top}>
        {sessionExercise.isLoading ? (
          <ActivityIndicator color={palette.color9} />
        ) : (
          <>
            <AppText variant="title">Couldn’t open this note</AppText>
            <AppText color="$colorMuted" textAlign="center">
              {sessionExercise.error?.message ?? 'The exercise may have been removed.'}
            </AppText>
            <Button label="Back" kind="secondary" onPress={() => router.back()} />
          </>
        )}
      </YStack>
    );
  }

  // The sets the note describes for this exercise that aren't in the session yet: "Looks right"
  // becomes "Log 2 sets" and adds them, so writing it down counts as logging it.
  const mine = picked.items[0]?.exercise;
  const isThisExercise =
    !!mine && (mine.exerciseId === data.exercise_id || mine.name === data.exercise.name);
  const newSets = isThisExercise
    ? setsToLog(setsFromNote(mine, unit), data.exercise_sets.length + justLogged)
    : [];
  const logNoteSets = () => {
    const start = Math.max(-1, ...data.exercise_sets.map((s) => s.position)) + 1 + justLogged;
    setExtra((e) => ({ ...e, sets: e.sets + newSets.length }));
    newSets.forEach((set, i) =>
      addSet.mutate(
        {
          sessionId: data.session_id,
          sessionExerciseId: data.id,
          position: start + i,
          weight: set.weight,
          reps: set.reps,
          unit: set.unit,
        },
        { onError: () => feedback.error("Couldn't log the sets from your note") },
      ),
    );
    feedback.success(`${plural(newSets.length, 'set')} logged to ${name}`);
  };

  // "Last Fri: 32 × 10, 10, 8": what you did last time, for context while you write.
  const lastDay = last.data ? lastDayLabel(last.data.startedAt, new Date()) : null;
  const lastTime =
    last.data && lastDay
      ? `${lastDay.charAt(0).toUpperCase()}${lastDay.slice(1)}: ${formatSetList(last.data.sets)}`
      : null;

  return (
    <NoteScreen
      backLabel={sessionName(data.session)}
      onBack={() => router.back()}
      saveState={draft.saveState}
      header={
        <NoteExerciseHeader
          name={name}
          equipment={data.equipment ? EQUIPMENT_LABELS[data.equipment] : null}
          lastTime={lastTime}
        />
      }
      segments={segments}
      onChangeText={draft.setBody}
      placeholder="How did it go? Grip, seat height, what to try next time."
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
        onAnswer={(index, question, value) => picked.answer(index, question, value)}
        confirmLabel={newSets.length > 0 ? `Log ${plural(newSets.length, 'set')}` : undefined}
        confirmHint={
          newSets.length > 0
            ? `Adds ${describeSets(newSets)} to ${name} in this session`
            : undefined
        }
        onConfirm={() => {
          setSummaryOpen(false);
          if (newSets.length > 0) logNoteSets();
        }}
      />
    </NoteScreen>
  );
}

/** The note is about one exercise whose equipment the session already knows. */
function withKnownEquipment(note: ExtractedNote, equipment: string | null): ExtractedNote {
  if (!equipment) return note;
  return {
    ...note,
    exercises: note.exercises.map((e, i) =>
      i === 0 ? { ...e, equipment, missing: e.missing.filter((m) => m !== 'equipment') } : e,
    ),
  };
}
