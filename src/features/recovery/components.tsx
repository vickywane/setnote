import { XStack, YStack } from 'tamagui';

import { Stat } from '@/components/ds/controls';
import { Icon } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';

import type { RecoveryCheck } from './api';
import { comparedWithUsual, formatRate, type RecoverySummary } from './summary';

/** Shown on every result: these are readings, not medical measurements. */
export const WELLNESS_NOTE =
  'For general wellness only. Not a medical device, and not for diagnosing or treating anything.';

const COMPARE_LABEL = {
  higher: 'above your usual',
  lower: 'below your usual',
  usual: 'about your usual',
} as const;

/** Pulse, breathing and HRV side by side, each with how it compares with earlier checks. */
export function RecoveryStats({
  summary,
  previous = [],
}: {
  summary: RecoverySummary;
  previous?: RecoveryCheck[];
}) {
  const rows = [
    {
      key: 'pulse',
      value: formatRate(summary.pulseBpm),
      label: 'pulse bpm',
      compare: comparedWithUsual(
        summary.pulseBpm,
        previous.map((c) => c.pulse_bpm),
      ),
    },
    {
      key: 'breathing',
      value: formatRate(summary.breathingBpm),
      label: 'breaths/min',
      compare: comparedWithUsual(
        summary.breathingBpm,
        previous.map((c) => c.breathing_bpm),
      ),
    },
    {
      key: 'hrv',
      value: formatRate(summary.hrvMs),
      label: 'HRV ms',
      compare: comparedWithUsual(
        summary.hrvMs,
        previous.map((c) => c.hrv_ms),
      ),
    },
  ];
  return (
    <XStack gap={28}>
      {rows.map((row) => (
        <YStack key={row.key} gap={2}>
          <Stat value={row.value} label={row.label} />
          {row.compare && (
            <AppText variant="caption" color="$color9">
              {COMPARE_LABEL[row.compare]}
            </AppText>
          )}
        </YStack>
      ))}
    </XStack>
  );
}

export const summaryOf = (check: RecoveryCheck): RecoverySummary => ({
  pulseBpm: check.pulse_bpm,
  breathingBpm: check.breathing_bpm,
  hrvMs: check.hrv_ms,
  confidence: check.confidence,
});

const ARROW = { higher: ' ↑', lower: ' ↓', usual: '' } as const;

/**
 * "Pulse 112 ↑ · 18 breaths/min · HRV 34 ms ↓", for the compact exercise row. The arrows
 * compare with your usual after this exercise (once there are three earlier checks); no
 * arrow means about the same. A comparison, not a judgement, so no colours.
 */
export function readingLine(check: RecoveryCheck, previous: RecoveryCheck[] = []): string {
  const mark = (value: number | null, past: (number | null)[]) => {
    const compare = comparedWithUsual(value, past);
    return compare ? ARROW[compare] : '';
  };
  const parts = [
    check.pulse_bpm !== null &&
      `Pulse ${formatRate(check.pulse_bpm)}${mark(
        check.pulse_bpm,
        previous.map((c) => c.pulse_bpm),
      )}`,
    check.breathing_bpm !== null &&
      `${formatRate(check.breathing_bpm)} breaths/min${mark(
        check.breathing_bpm,
        previous.map((c) => c.breathing_bpm),
      )}`,
    check.hrv_ms !== null &&
      `HRV ${formatRate(check.hrv_ms)} ms${mark(
        check.hrv_ms,
        previous.map((c) => c.hrv_ms),
      )}`,
  ].filter(Boolean);
  return parts.join(' · ');
}

/** The same reading for screen readers: "pulse 112, above your usual; …". */
function readingSpoken(check: RecoveryCheck, previous: RecoveryCheck[]): string {
  const spoken = (label: string, value: number | null, past: (number | null)[]) => {
    if (value === null) return null;
    const compare = comparedWithUsual(value, past);
    return `${label} ${formatRate(value)}${compare ? `, ${COMPARE_LABEL[compare]}` : ''}`;
  };
  return [
    spoken(
      'pulse',
      check.pulse_bpm,
      previous.map((c) => c.pulse_bpm),
    ),
    spoken(
      'breaths per minute',
      check.breathing_bpm,
      previous.map((c) => c.breathing_bpm),
    ),
    spoken(
      'HRV milliseconds',
      check.hrv_ms,
      previous.map((c) => c.hrv_ms),
    ),
  ]
    .filter(Boolean)
    .join('; ');
}

/**
 * Under an exercise: a "How do you feel?" button, or the reading taken after it (tap to
 * retake).
 */
export function ExerciseFeelRow({
  check,
  previous = [],
  onPress,
}: {
  check: RecoveryCheck | null;
  /** Earlier checks after the same exercise, for the arrows. */
  previous?: RecoveryCheck[];
  onPress?: () => void;
}) {
  if (!check && !onPress) return null;
  return (
    <XStack
      role="button"
      accessible
      aria-label={
        check
          ? `How you felt: ${readingSpoken(check, previous)}.${check.video_path ? ' Has a video.' : ''}`
          : 'How do you feel?'
      }
      onPress={onPress}
      alignSelf="flex-start"
      gap="$2"
      alignItems="center"
      paddingHorizontal={12}
      height={32}
      borderRadius="$round"
      backgroundColor={check ? '$green2' : '$color3'}
      opacity={{ default: 1, press: 0.6 }}>
      <Icon name="heart" size={16} color={check ? 'green9' : 'color12'} />
      <AppText variant="label" color={check ? '$green9' : '$color'} numberOfLines={1}>
        {check ? readingLine(check, previous) : 'How do you feel?'}
      </AppText>
      {check?.video_path && <Icon name="play" size={14} color="green9" />}
    </XStack>
  );
}

/** The session's own check: a button to take it, or the reading with retake and watch links. */
export function SessionFeelCard({
  check,
  previous,
  onPress,
  onWatch,
}: {
  check: RecoveryCheck | null;
  previous: RecoveryCheck[];
  onPress?: () => void;
  /** Opens the check's video, when it has one. */
  onWatch?: () => void;
}) {
  if (!check && !onPress) return null;
  return (
    <YStack gap="$3" padding="$4" marginTop="$4" borderRadius="$4" backgroundColor="$color3">
      <AppText variant="overline">HOW YOU FEEL · WHOLE SESSION</AppText>
      {check ? (
        <RecoveryStats summary={summaryOf(check)} previous={previous} />
      ) : (
        <AppText variant="body" color="$colorMuted">
          A 45-second camera check of your pulse, breathing and HRV, saved with this session.
        </AppText>
      )}
      <XStack gap="$5">
        {onPress && (
          <AppText variant="label" role="button" onPress={onPress} hitSlop={12}>
            {check ? 'Retake' : 'Check how you feel'}
          </AppText>
        )}
        {check?.video_path && onWatch && (
          <AppText variant="label" role="button" onPress={onWatch} hitSlop={12}>
            Watch video
          </AppText>
        )}
      </XStack>
    </YStack>
  );
}
