import { SymbolView } from 'expo-symbols';
import { Fragment, useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { AppText } from '@/components/ds/text';
import {
  EFFORT_LABELS,
  exerciseMeta,
  groupSets,
  noteTips,
  setCount,
} from '@/features/notes/details';
import type { ExtractedExercise } from '@/lib/extraction/parse-note';
import { tamaguiConfig } from '@/theme/tamagui.config';

const color = tamaguiConfig.tokens.color;

export type NoteDetailsState = 'empty' | 'detecting' | 'ready';
export type NoteDetailsStatus = { label: string; tone: 'primary' | 'success' | 'danger' };

/**
 * "Note details" card under the note (Figma: Note details card). Empty until something is
 * written, Detecting while the note is being read, then one section per exercise found.
 */
export function NoteDetailsCard({
  state,
  hasText,
  exercises,
  status,
}: {
  state: NoteDetailsState;
  /** Whether the note has any text; changes the empty message. */
  hasText: boolean;
  exercises: ExtractedExercise[];
  /** Save state chip; hidden when null. "Detecting" replaces it while reading. */
  status: NoteDetailsStatus | null;
}) {
  const chip = state === 'detecting' ? { label: 'DETECTING', tone: 'primary' as const } : status;
  return (
    <YStack
      backgroundColor="$surface"
      borderRadius={20}
      padding="$4"
      gap="$3"
      aria-busy={state === 'detecting'}>
      <XStack alignItems="center" gap={10}>
        <YStack
          width={32}
          height={32}
          borderRadius={16}
          backgroundColor="$primary"
          alignItems="center"
          justifyContent="center">
          <SymbolView
            name={{ ios: 'sparkles', android: 'auto_awesome' }}
            size={18}
            tintColor={color.color1.val}
          />
        </YStack>
        <AppText flex={1} fontSize={20} lineHeight="25px" fontWeight="600" role="heading">
          Note details
        </AppText>
        {chip && <StatusChip {...chip} />}
      </XStack>

      {state === 'empty' && <EmptyMessage hasText={hasText} />}
      {state === 'detecting' && <DetectingSkeleton />}
      {state === 'ready' &&
        exercises.map((exercise, index) => (
          <Fragment key={`${exercise.name}-${index}`}>
            {index > 0 && <YStack height={StyleSheet.hairlineWidth} backgroundColor="$separator" />}
            <ExerciseDetails exercise={exercise} />
          </Fragment>
        ))}
    </YStack>
  );
}

function StatusChip({ label, tone }: NoteDetailsStatus) {
  return (
    <YStack
      backgroundColor="$background"
      borderRadius={999}
      paddingHorizontal={10}
      paddingVertical={4}>
      <AppText
        fontSize={12}
        lineHeight="16px"
        fontWeight="600"
        letterSpacing={0.7}
        color={`$${tone}`}>
        {label}
      </AppText>
    </YStack>
  );
}

function Tile({ children, ...props }: React.ComponentProps<typeof YStack>) {
  return (
    <YStack
      backgroundColor="$background"
      borderRadius={12}
      paddingHorizontal={14}
      paddingVertical="$3"
      gap="$1"
      {...props}>
      {children}
    </YStack>
  );
}

function Label({
  children,
  color: labelColor = '$textSecondary',
}: {
  children: string;
  color?: string;
}) {
  return (
    <AppText
      fontSize={12}
      lineHeight="16px"
      fontWeight="600"
      letterSpacing={0.5}
      color={labelColor}>
      {children}
    </AppText>
  );
}

function EmptyMessage({ hasText }: { hasText: boolean }) {
  return (
    <Tile
      alignItems="center"
      gap={6}
      paddingVertical="$5"
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$border">
      <AppText fontSize={15} lineHeight="20px" fontWeight="600" textAlign="center">
        Nothing to show yet
      </AppText>
      <AppText variant="emptyBody">
        {hasText
          ? 'No exercises found yet. Add a weight and reps, like “Bench 80kg 8, 8, 6”.'
          : 'Write an exercise, weight and reps, like “Bench 80kg 8, 8, 6”, and the details show up here.'}
      </AppText>
    </Tile>
  );
}

function DetectingSkeleton() {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  const bar = (width: number, height: number) => (
    <YStack
      width={width}
      height={height}
      borderRadius={height / 2}
      backgroundColor="$surfaceSelected"
    />
  );

  return (
    <YStack gap="$3">
      <Animated.View style={{ gap: 8, opacity }}>
        <Tile gap="$2">
          {bar(110, 10)}
          {bar(180, 16)}
        </Tile>
        <XStack gap="$2">
          {[0, 1].map((key) => (
            <Tile key={key} flex={1} gap="$2">
              {bar(80, 10)}
              {bar(64, 28)}
            </Tile>
          ))}
        </XStack>
      </Animated.View>
      <AppText variant="emptyBody">Reading your note…</AppText>
    </YStack>
  );
}

function ExerciseDetails({ exercise }: { exercise: ExtractedExercise }) {
  const meta = exerciseMeta(exercise);
  const groups = groupSets(exercise.reps);
  const tips = noteTips(exercise);
  const effortColor =
    exercise.effort === 'high' ? '$warning' : exercise.effort === 'low' ? '$success' : '$text';

  return (
    <YStack gap="$2">
      <Tile>
        <Label>DETECTED EXERCISE</Label>
        <AppText fontSize={17} lineHeight="22px" fontWeight="600">
          {exercise.name}
        </AppText>
        <AppText
          fontSize={13}
          lineHeight="18px"
          fontWeight="500"
          color={meta.warning ? '$warning' : '$textSecondary'}>
          {meta.text}
        </AppText>
      </Tile>

      <XStack gap="$2">
        <Tile flex={1} gap={2}>
          <Label>WORKING LOAD</Label>
          {exercise.weight ? (
            <XStack alignItems="baseline" gap="$1">
              <AppText fontSize={30} lineHeight="36px" fontWeight="700" color="$primary">
                {Number.isInteger(exercise.weight.value)
                  ? exercise.weight.value
                  : exercise.weight.value.toFixed(1)}
              </AppText>
              <AppText fontSize={15} lineHeight="20px" fontWeight="600" color="$textSecondary">
                {exercise.weight.unit}
              </AppText>
            </XStack>
          ) : (
            <Missing />
          )}
        </Tile>
        <Tile flex={1} gap={2}>
          <Label>EFFORT</Label>
          {exercise.effort ? (
            <AppText fontSize={30} lineHeight="36px" fontWeight="700" color={effortColor}>
              {EFFORT_LABELS[exercise.effort]}
            </AppText>
          ) : (
            <Missing />
          )}
        </Tile>
      </XStack>

      <Tile gap={10}>
        <XStack justifyContent="space-between" alignItems="center">
          <Label>SETS</Label>
          <AppText fontSize={13} lineHeight="16px" fontWeight="600" color="$primary">
            {setCount(exercise)}
          </AppText>
        </XStack>
        {groups.length > 0 && (
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            {groups.map((group, index) => (
              <Fragment key={group.range}>
                {index > 0 && (
                  <AppText fontSize={15} fontWeight="600" color="$textSecondary">
                    +
                  </AppText>
                )}
                <YStack
                  flex={1}
                  minWidth={96}
                  backgroundColor="$surface"
                  borderRadius={10}
                  paddingVertical="$2"
                  paddingHorizontal="$3"
                  alignItems="center"
                  gap={2}>
                  <AppText
                    fontSize={12}
                    lineHeight="16px"
                    fontWeight="500"
                    color={group.dropped ? '$warning' : '$textSecondary'}>
                    {group.dropped ? `${group.range} · dropped` : group.range}
                  </AppText>
                  <AppText
                    fontSize={22}
                    lineHeight="28px"
                    fontWeight="700"
                    color={group.dropped ? '$warning' : '$text'}>
                    {group.value}
                  </AppText>
                </YStack>
              </Fragment>
            ))}
          </XStack>
        )}
      </Tile>

      {(tips || exercise.bodyNotes.length > 0) && (
        <XStack
          backgroundColor="$background"
          borderRadius={12}
          paddingHorizontal={14}
          paddingVertical="$3"
          gap={10}>
          <SymbolView
            name={{ ios: 'lightbulb', android: 'lightbulb' }}
            size={22}
            tintColor={color.color12.val}
          />
          <YStack flex={1} gap="$1">
            <Label color="$primary">FROM YOUR NOTE</Label>
            {tips !== '' && (
              <AppText fontSize={15} lineHeight="21px">
                {tips}
              </AppText>
            )}
            {exercise.bodyNotes.map((note) => (
              <AppText key={note} fontSize={15} lineHeight="21px" fontWeight="500" color="$danger">
                Body: {note}
              </AppText>
            ))}
          </YStack>
        </XStack>
      )}
    </YStack>
  );
}

function Missing() {
  return (
    <AppText
      fontSize={30}
      lineHeight="36px"
      fontWeight="700"
      color="$textSecondary"
      aria-label="Not stated">
      —
    </AppText>
  );
}
