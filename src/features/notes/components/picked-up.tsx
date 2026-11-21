import { Keyboard, ScrollView, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { Button, Tag } from '@/components/ds/controls';
import { BottomSheet, Grabber } from '@/components/ds/sheet';
import { AppText } from '@/components/ds/text';
import { formatElapsed } from '@/features/home/format';
import { pickedDetails, pickedTags, type Question } from '@/features/notes/picked-up';
import type { ExtractedExercise } from '@/lib/extraction/parse-note';
import { SHEET_SHADOW } from '@/theme/tamagui.config';

export type PeekState =
  | { kind: 'empty' }
  | { kind: 'detecting' }
  | { kind: 'nothing' }
  | { kind: 'ready'; names: string[]; questions: number; refining?: boolean };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Figma "Sheet · Picked up (collapsed)": a 14% peek under the paper so the writing stays front
 * and centre. Tap it, or swipe it up, to open the full summary.
 */
export function PickedUpPeek({
  state,
  onOpen,
  recordingMs = null,
  transcribingMs = null,
}: {
  state: PeekState;
  onOpen: () => void;
  /** The note's recording, if it has one: the caption says what was picked up came from it. */
  recordingMs?: number | null;
  /** While a recording is being read (Figma "Voice / Transcribing"). */
  transcribingMs?: number | null;
}) {
  const insets = useSafeAreaInsets();

  let title: string;
  let caption: string;
  let tag: { text: string; tone: 'neutral' | 'warning' } | null = null;
  switch (state.kind) {
    case 'empty':
      title = 'Nothing picked up yet';
      caption = 'Exercises, weights and reps you write show up here';
      break;
    case 'detecting':
      title = 'Reading your note…';
      caption = 'Picking up exercises, weights and reps';
      tag = { text: 'Detecting', tone: 'neutral' };
      break;
    case 'nothing':
      title = 'Nothing picked up yet';
      caption = 'Try a weight and reps, like “80kg 8, 8, 6”';
      break;
    case 'ready':
      title = `Picked up ${plural(state.names.length, 'exercise')}`;
      caption = state.names.join(' · ');
      // Questions wait for Claude's reading, which often answers them.
      if (state.refining) tag = { text: 'Reading…', tone: 'neutral' };
      else if (state.questions > 0)
        tag = { text: plural(state.questions, 'question'), tone: 'warning' };
      break;
  }
  if (state.kind === 'ready' && recordingMs !== null) {
    caption = `${caption} · from your ${formatElapsed(recordingMs)} recording`;
  }
  if (transcribingMs !== null) {
    title = 'Transcribing your recording…';
    caption = 'Then we’ll pick out exercises, weights and reps';
    tag = { text: formatElapsed(transcribingMs), tone: 'neutral' };
  }
  const openable = state.kind === 'ready' && transcribingMs === null;
  // Touching the peek puts the keyboard away, so the summary (or the peek) isn't hidden by it.
  const open = () => {
    Keyboard.dismiss();
    if (openable) onOpen();
  };
  const swipeUp = Gesture.Pan()
    .activeOffsetY(-12)
    .onEnd((e) => {
      if (e.translationY < -24) runOnJS(open)();
    });

  return (
    <GestureDetector gesture={swipeUp}>
      <YStack
        role="button"
        accessible
        aria-label={`${title}. ${caption}${openable ? '. Open summary' : ''}`}
        onPress={open}
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        gap="$3"
        alignItems="center"
        paddingTop="$2"
        paddingBottom={Math.max(insets.bottom, 12) + 12}
        backgroundColor="$background"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
        boxShadow={SHEET_SHADOW}>
        <Grabber />
        <XStack alignSelf="stretch" gap={10} alignItems="center" paddingHorizontal="$5">
          <YStack flex={1} gap={2}>
            <AppText variant="heading" numberOfLines={1}>
              {title}
            </AppText>
            <AppText variant="caption" color="$colorMuted" numberOfLines={1}>
              {caption}
            </AppText>
          </YStack>
          {tag && <Tag text={tag.text} tone={tag.tone} />}
        </XStack>
      </YStack>
    </GestureDetector>
  );
}

export type PickedExercise = { exercise: ExtractedExercise; question: Question | null };

/**
 * Figma "Sheet · Picked up": what the parser understood per exercise, follow-up questions in
 * place, and "Looks right" (or "Log 2 sets" when the note's sets can go into the session). The
 * sheet is as tall as what it shows; a long list scrolls.
 */
export function PickedUpSheet({
  open,
  items,
  onClose,
  onAnswer,
  onConfirm,
  confirmLabel = 'Looks right',
  confirmHint = 'Tap any underlined word in your note to correct it',
}: {
  open: boolean;
  items: PickedExercise[];
  onClose: () => void;
  onAnswer: (index: number, question: Question, value: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmHint?: string;
}) {
  const { height } = useWindowDimensions();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Picked up ${plural(items.length, 'exercise')}`}
      bodyProps={{ gap: 0, paddingTop: '$1', paddingHorizontal: 0 }}>
      <ScrollView
        style={{ flexGrow: 0, maxHeight: Math.round(height * 0.55) }}
        contentContainerStyle={{ paddingHorizontal: 20 }}>
        {items.map(({ exercise, question }, index) => (
          <PickedExerciseBlock
            key={`${exercise.name}-${index}`}
            exercise={exercise}
            question={question}
            onAnswer={(value) => question && onAnswer(index, question, value)}
          />
        ))}
      </ScrollView>
      <YStack gap="$2" paddingTop="$3" paddingHorizontal="$5">
        <Button label={confirmLabel} onPress={onConfirm} />
        <AppText variant="caption" color="$color9" textAlign="center">
          {confirmHint}
        </AppText>
      </YStack>
    </BottomSheet>
  );
}

function PickedExerciseBlock({
  exercise,
  question,
  onAnswer,
}: {
  exercise: ExtractedExercise;
  question: Question | null;
  onAnswer: (value: string) => void;
}) {
  const tags = pickedTags(exercise);
  const details = pickedDetails(exercise);
  return (
    <YStack
      gap={10}
      paddingTop={14}
      paddingBottom="$4"
      borderBottomWidth={1}
      borderColor="$borderColor">
      <AppText variant="heading">{exercise.name}</AppText>
      {tags.length > 0 && (
        <XStack flexWrap="wrap" gap={6}>
          {/* Each value fades in after the one before, as if read off the note. */}
          {tags.map((tag, i) => (
            <Animated.View key={tag.text} entering={FadeIn.duration(180).delay(i * 60)}>
              <Tag text={tag.text} tone={tag.tone} />
            </Animated.View>
          ))}
        </XStack>
      )}
      {details.map((row) => (
        <XStack key={row.label} gap="$2">
          <AppText variant="caption" color="$color9" width={52}>
            {row.label}
          </AppText>
          <AppText variant="caption" flex={1}>
            {row.text}
          </AppText>
        </XStack>
      ))}
      {question && (
        <YStack
          gap="$2"
          paddingTop={10}
          paddingBottom="$3"
          paddingHorizontal="$3"
          borderRadius="$3"
          backgroundColor="$yellow2">
          <AppText variant="label" color="$yellow11">
            {question.text}
          </AppText>
          <XStack gap="$2" flexWrap="wrap">
            {question.options.map((option) => (
              <XStack
                key={option.value}
                role="button"
                accessible
                aria-label={option.label}
                onPress={() => onAnswer(option.value)}
                paddingHorizontal="$3"
                paddingVertical={7}
                borderRadius="$round"
                borderWidth={1}
                borderColor="$borderColor"
                backgroundColor={{ default: '$background', press: '$color2' }}>
                <AppText variant="label">{option.label}</AppText>
              </XStack>
            ))}
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
