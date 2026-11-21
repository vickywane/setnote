import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { Button, ChevronLink, SearchField } from '@/components/ds/controls';
import { BottomSheet } from '@/components/ds/sheet';
import { AppText } from '@/components/ds/text';
import {
  EQUIPMENT_LABELS,
  type Exercise,
  searchExercises,
  useExercises,
} from '@/features/catalog/api';
import { ExerciseRow } from '@/features/catalog/components/exercise-row';
import { type ExerciseUsage, exerciseUsage, useSessions } from '@/features/sessions/api';
import { relativeDays } from '@/features/sessions/format';

/** Suggested before the user has any history, in this order. */
const STARTERS = ['Bench press', 'Squat', 'Romanian deadlift', 'Lat pulldown'];
const OFTEN_LIMIT = 4;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Dumbbell, barbell, cable · Arms · last Mon" */
export function exerciseCaption(exercise: Exercise, usage: ExerciseUsage | undefined, now: Date) {
  const equipment = exercise.equipment
    .map((e, i) => (i === 0 ? EQUIPMENT_LABELS[e] : EQUIPMENT_LABELS[e].toLowerCase()))
    .join(', ');
  return [
    equipment,
    exercise.muscle_group && capitalize(exercise.muscle_group),
    usage && relativeDays(usage.lastAt, now),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Figma "Sheet · Add exercise" (590pt): search, what you do often,
 * search results, and creating your own exercise when nothing matches.
 */
export function AddExerciseSheet({
  open,
  busy,
  autoFocusSearch = false,
  onClose,
  onClosed,
  onAdd,
  onCreate,
  title = 'Add exercise',
}: {
  open: boolean;
  busy: boolean;
  /** Focus the search field on open ("Type instead" from the camera). */
  autoFocusSearch?: boolean;
  onClose: () => void;
  /** After the sheet has animated out. */
  onClosed?: () => void;
  onAdd: (exercise: Exercise) => void;
  onCreate: (name: string) => void;
  title?: string;
}) {
  const exercises = useExercises();
  const sessions = useSessions();
  const [query, setQuery] = useState('');
  const [browseAll, setBrowseAll] = useState(false);
  const now = new Date();

  const catalog = useMemo(() => exercises.data ?? [], [exercises.data]);
  const usage = useMemo(() => exerciseUsage(sessions.data ?? []), [sessions.data]);
  const often = useMemo(() => {
    const used = catalog
      .filter((e) => usage.has(e.id))
      .sort((a, b) => {
        const ua = usage.get(a.id)!;
        const ub = usage.get(b.id)!;
        return ub.count - ua.count || ub.lastAt.localeCompare(ua.lastAt);
      });
    if (used.length > 0) return used.slice(0, OFTEN_LIMIT);
    const byName = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));
    return STARTERS.map((n) => byName.get(n.toLowerCase())).filter((e): e is Exercise => !!e);
  }, [catalog, usage]);

  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed ? searchExercises(catalog, trimmed) : []),
    [catalog, trimmed],
  );

  const close = () => {
    setQuery('');
    setBrowseAll(false);
    onClose();
  };

  const rows = (list: readonly Exercise[]) =>
    list.map((exercise) => (
      <ExerciseRow
        key={exercise.id}
        name={exercise.name}
        meta={exerciseCaption(exercise, usage.get(exercise.id), now)}
        disabled={busy}
        onAdd={() => onAdd(exercise)}
      />
    ));

  let body;
  if (trimmed && results.length === 0) {
    body = (
      <YStack gap="$2" paddingTop="$6">
        <AppText variant="title">No match for “{trimmed}”</AppText>
        <AppText color="$colorMuted">
          Add it as your own exercise. You can set its equipment and body part later.
        </AppText>
        <Button label={`Create “${trimmed}”`} loading={busy} onPress={() => onCreate(trimmed)} />
      </YStack>
    );
  } else if (trimmed) {
    body = (
      <>
        <AppText variant="overline">
          {results.length} {results.length === 1 ? 'MATCH' : 'MATCHES'}
        </AppText>
        <YStack>{rows(results)}</YStack>
        <ChevronLink
          label="Can’t find it? Create your own exercise"
          onPress={() => onCreate(trimmed)}
        />
      </>
    );
  } else if (browseAll) {
    body = (
      <>
        <AppText variant="overline">ALL EXERCISES</AppText>
        <YStack>{rows(catalog)}</YStack>
      </>
    );
  } else {
    body = (
      <>
        <AppText variant="overline">
          {usage.size > 0 ? 'YOU DO THESE OFTEN' : 'GOOD PLACES TO START'}
        </AppText>
        <YStack>{rows(often)}</YStack>
        {catalog.length > 0 && (
          <ChevronLink
            label={`Browse all ${catalog.length} exercises`}
            onPress={() => setBrowseAll(true)}
          />
        )}
      </>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      onClosed={onClosed}
      title={title}
      designHeight={590}
      bodyProps={{ gap: '$3', paddingHorizontal: 0 }}>
      <XStack gap="$2" paddingHorizontal="$5">
        <YStack flex={1}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search, or type “db curl”"
            accessibilityLabel="Search exercises"
            autoCapitalize="none"
            autoFocus={autoFocusSearch}
          />
        </YStack>
      </XStack>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {body}
      </ScrollView>
    </BottomSheet>
  );
}
