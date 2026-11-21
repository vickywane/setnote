import { useRef, useState } from 'react';
import { ActivityIndicator, type View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { Icon, type IconName } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';
import { formatElapsed } from '@/features/home/format';
import { type NoteRecording, WAVEFORM_BARS } from '@/features/notes/recordings';
import { LIVE_BARS, type VoiceState } from '@/features/notes/use-voice-note';
import { useNow } from '@/hooks/use-now';
import { palette } from '@/theme/tamagui.config';

/** Waveform bars: 3pt wide, 2pt apart, up to 32pt tall (Figma "Waveform"). */
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const WAVE_HEIGHT = 32;
const MIN_BAR = 4;
/** Figma "Delete action" behind a swiped clip. */
const DELETE_WIDTH = 84;
const SWIPE_OPEN = DELETE_WIDTH + 8;
/** Holding the record button this long makes it push-to-talk: letting go stops. */
const HOLD_TO_TALK_MS = 450;
const DOCK_BORDER = palette.color5;

/** A row of loudness bars. `played` (0–1) colours the bars already heard. */
export function Waveform({
  bars,
  played = 0,
  tone = 'idle',
  align = 'start',
}: {
  bars: number[];
  played?: number;
  /** idle: muted bars; playing: vermilion up to `played`; live: all vermilion. */
  tone?: 'idle' | 'playing' | 'live';
  align?: 'start' | 'center';
}) {
  const playedBars = Math.round(played * bars.length);
  return (
    <XStack
      height={WAVE_HEIGHT}
      gap={BAR_GAP}
      alignItems="center"
      justifyContent={align === 'center' ? 'center' : 'flex-start'}
      overflow="hidden"
      flexShrink={1}
      aria-hidden>
      {bars.map((level, i) => (
        <YStack
          key={i}
          width={BAR_WIDTH}
          height={Math.max(MIN_BAR, Math.round(level * WAVE_HEIGHT))}
          borderRadius={BAR_WIDTH / 2}
          backgroundColor={
            tone === 'live'
              ? '$accent9'
              : tone === 'playing'
                ? i < playedBars
                  ? '$accent9'
                  : '$color6'
                : '$color8'
          }
        />
      ))}
    </XStack>
  );
}

/** Flat bars for a recording without a saved waveform. */
const FLAT_WAVEFORM = Array.from({ length: WAVEFORM_BARS }, (_, i) => 0.3 + 0.2 * Math.sin(i));

/**
 * Figma "AudioClip": the recording at the top of a note. Play/pause, its waveform and length.
 * Swipe left for Delete; long press for its menu.
 */
export function AudioClip({
  recording,
  playing,
  loading,
  positionMs,
  open,
  onToggle,
  onDelete,
  onMenu,
}: {
  recording: NoteRecording;
  playing: boolean;
  loading: boolean;
  positionMs: number;
  /** This recording is the one in the Playback dock. */
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  /** Long press: where the clip is on screen, to place the menu under it. */
  onMenu: (frame: { y: number; height: number }) => void;
}) {
  const ref = useRef<View>(null);
  const offset = useSharedValue(0);
  const [revealed, setRevealed] = useState(false);
  const durationMs = recording.duration_ms;
  const played = open && durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const bars = recording.waveform.length > 0 ? recording.waveform : FLAT_WAVEFORM;
  const time = open
    ? `${formatElapsed(positionMs)} / ${formatElapsed(durationMs)}`
    : formatElapsed(durationMs);

  const settle = (to: number) => {
    'worklet';
    offset.set(withTiming(to, { duration: 180, easing: Easing.out(Easing.cubic) }));
    runOnJS(setRevealed)(to !== 0);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const start = revealed ? -SWIPE_OPEN : 0;
      offset.set(Math.min(0, Math.max(-SWIPE_OPEN - 24, start + e.translationX)));
    })
    .onEnd((e) => {
      const open = offset.get() < -SWIPE_OPEN / 2 || e.velocityX < -600;
      settle(open ? -SWIPE_OPEN : 0);
    });

  const [height, setHeight] = useState(60);
  const menuAt = (top: number) => onMenu({ y: top, height });
  const longPress = Gesture.LongPress()
    .minDuration(400)
    .onStart((e) => {
      // The clip's top on screen: where the finger is, less how far into the clip it is.
      runOnJS(menuAt)(e.absoluteY - e.y);
    });

  const clipStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <YStack marginHorizontal={-4}>
      {revealed && (
        <XStack
          role="button"
          accessible
          aria-label="Delete recording"
          onPress={() => {
            offset.set(withTiming(0));
            setRevealed(false);
            onDelete();
          }}
          position="absolute"
          right={0}
          top={0}
          bottom={0}
          width={DELETE_WIDTH}
          borderRadius="$4"
          backgroundColor="$red9"
          alignItems="center"
          justifyContent="center">
          <YStack alignItems="center" gap={2}>
            <Icon name="trash" size={20} color="color1" />
            <AppText variant="caption" color="$color1">
              Delete
            </AppText>
          </YStack>
        </XStack>
      )}
      <GestureDetector gesture={Gesture.Exclusive(pan, longPress)}>
        <Animated.View
          ref={ref}
          style={clipStyle}
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
          <XStack
            gap="$3"
            alignItems="center"
            paddingLeft={10}
            paddingRight={14}
            paddingVertical={10}
            borderRadius="$4"
            borderWidth={1}
            borderColor="$borderColor"
            backgroundColor="$color2"
            accessible
            aria-label={`Voice recording, ${formatElapsed(durationMs)}`}
            accessibilityActions={[
              { name: 'activate', label: playing ? 'Pause' : 'Play' },
              { name: 'delete', label: 'Delete recording' },
              { name: 'menu', label: 'More options' },
            ]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'activate') onToggle();
              if (e.nativeEvent.actionName === 'delete') onDelete();
              if (e.nativeEvent.actionName === 'menu') {
                ref.current?.measureInWindow((_x, y, _w, h) => onMenu({ y, height: h }));
              }
            }}>
            <XStack
              role="button"
              accessible
              aria-label={playing ? 'Pause recording' : 'Play recording'}
              onPress={onToggle}
              width={40}
              height={40}
              borderRadius="$round"
              backgroundColor="$color12"
              alignItems="center"
              justifyContent="center"
              opacity={{ default: 1, press: 0.8 }}>
              {loading ? (
                <ActivityIndicator color={palette.color1} />
              ) : (
                <Icon name={playing ? 'pause' : 'play'} size={18} color="color1" />
              )}
            </XStack>
            <XStack flex={1}>
              <Waveform bars={bars} played={played} tone={open ? 'playing' : 'idle'} />
            </XStack>
            <AppText variant="numeralM" fontVariant={['tabular-nums']} numberOfLines={1}>
              {time}
            </AppText>
          </XStack>
        </Animated.View>
      </GestureDetector>
    </YStack>
  );
}

/** A recording still uploading: the clip without controls. */
export function PendingClip({ durationMs }: { durationMs: number }) {
  return (
    <XStack
      marginHorizontal={-4}
      gap="$3"
      alignItems="center"
      paddingLeft={10}
      paddingRight={14}
      paddingVertical={10}
      borderRadius="$4"
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$color2"
      opacity={0.7}
      aria-label="Saving recording">
      <XStack
        width={40}
        height={40}
        borderRadius="$round"
        backgroundColor="$color12"
        alignItems="center"
        justifyContent="center">
        <ActivityIndicator color={palette.color1} />
      </XStack>
      <XStack flex={1}>
        <Waveform bars={FLAT_WAVEFORM} />
      </XStack>
      <AppText variant="numeralM">{formatElapsed(durationMs)}</AppText>
    </XStack>
  );
}

/** Figma "Timer" pill in the nav while recording: vermilion dot and the time so far. */
export function RecordingTimer({
  clock,
  paused,
}: {
  clock: { since: number | null; beforeMs: number };
  paused: boolean;
}) {
  const now = useNow(250);
  const ms = clock.beforeMs + (clock.since ? now - clock.since : 0);
  return (
    <XStack
      gap={6}
      alignItems="center"
      paddingLeft={10}
      paddingRight={12}
      paddingVertical={6}
      borderRadius="$round"
      backgroundColor={paused ? '$color3' : '$accent2'}
      aria-label={`${paused ? 'Paused' : 'Recording'}, ${formatElapsed(ms)}`}>
      {paused ? (
        <Icon name="pause" size={12} color="color9" />
      ) : (
        <YStack width={7} height={7} borderRadius="$round" backgroundColor="$accent9" />
      )}
      <AppText
        variant="numeralM"
        fontWeight="500"
        color={paused ? '$color11' : '$accent11'}
        fontVariant={['tabular-nums']}>
        {formatElapsed(ms)}
      </AppText>
    </XStack>
  );
}

/** A 48pt round control with a caption under it (Type, Discard, Pause). */
function DockButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <YStack
      role="button"
      accessible
      aria-label={label}
      aria-disabled={disabled}
      onPress={disabled ? undefined : onPress}
      width={48}
      gap={6}
      alignItems="center"
      opacity={disabled ? 0.4 : { default: 1, press: 0.7 }}>
      <XStack
        width={48}
        height={48}
        borderRadius="$round"
        backgroundColor="$color3"
        alignItems="center"
        justifyContent="center">
        <Icon name={icon} size={22} />
      </XStack>
      <AppText variant="caption" color="$colorMuted" numberOfLines={1}>
        {label}
      </AppText>
    </YStack>
  );
}

/** The record and stop button, 56pt: big enough to hit without dominating the note. */
const RECORD_SIZE = 56;

/**
 * Figma "RecordButton". Ready is ink with a mic; Recording is white with a vermilion ring
 * and stop square. Tap to start or stop; hold to talk and let go to stop.
 */
function RecordButton({
  recording,
  busy,
  onTap,
  onHoldEnd,
}: {
  recording: boolean;
  busy: boolean;
  onTap: () => void;
  onHoldEnd: () => void;
}) {
  const pressedAt = useRef(0);
  const startedByPress = useRef(false);
  return (
    <XStack
      role="button"
      accessible
      aria-label={recording ? 'Stop recording' : 'Record'}
      aria-busy={busy}
      onPressIn={() => {
        pressedAt.current = Date.now();
        startedByPress.current = !recording;
        if (!recording && !busy) onTap();
      }}
      onPressOut={() => {
        const held = Date.now() - pressedAt.current >= HOLD_TO_TALK_MS;
        // Push-to-talk: letting go of a long press stops the recording it started.
        if (startedByPress.current && held) onHoldEnd();
        else if (!startedByPress.current && recording) onTap();
        startedByPress.current = false;
      }}
      width={RECORD_SIZE}
      height={RECORD_SIZE}
      borderRadius="$round"
      backgroundColor={recording ? '$color1' : '$color12'}
      borderWidth={recording ? 3 : 0}
      borderColor="$accent9"
      alignItems="center"
      justifyContent="center"
      scale={{ default: 1, press: 0.96 }}>
      {busy ? (
        <ActivityIndicator color={recording ? palette.accent9 : palette.color1} />
      ) : recording ? (
        <YStack width={18} height={18} borderRadius={4} backgroundColor="$accent9" />
      ) : (
        <Icon name="mic" size={24} color="color1" />
      )}
    </XStack>
  );
}

function Dock({ children, gap }: { children: React.ReactNode; gap: number }) {
  const insets = useSafeAreaInsets();
  return (
    <YStack
      position="absolute"
      left={0}
      right={0}
      bottom={0}
      gap={gap}
      paddingTop={14}
      paddingHorizontal={28}
      paddingBottom={Math.max(insets.bottom, 12) + 10}
      backgroundColor="$background"
      borderTopWidth={1}
      borderColor={DOCK_BORDER}>
      {children}
    </YStack>
  );
}

/**
 * Figma "Record dock": everything you touch while recording, in thumb reach. Ready (an empty
 * note) shows just the mic; recording shows the live waveform, Discard, Stop and Pause (Resume once paused).
 */
export function RecordDock({
  state,
  levels,
  onRecord,
  onStop,
  onPause,
  onDiscard,
}: {
  state: VoiceState;
  levels: number[];
  onRecord: () => void;
  onStop: () => void;
  onPause: () => void;
  onDiscard: () => void;
}) {
  const ready = state === 'idle' || state === 'transcribing';
  const paused = state === 'paused';
  const live = !ready;
  const bars = [...Array.from({ length: LIVE_BARS - levels.length }, () => 0.12), ...levels];

  const hint = ready
    ? 'Tap to record · hold to talk'
    : paused
      ? 'Paused · tap Resume to keep going, or stop to save'
      : state === 'finishing'
        ? 'Adding your words to the note…'
        : 'Tap to stop · your words appear as you talk';

  return (
    <Dock gap={10}>
      {live && <Waveform bars={bars} tone={paused ? 'idle' : 'live'} align="center" />}
      <XStack alignItems="center" justifyContent="space-between">
        {ready ? (
          <YStack width={48} />
        ) : (
          <DockButton
            icon="x"
            label="Discard"
            onPress={onDiscard}
            disabled={state === 'finishing'}
          />
        )}
        <RecordButton
          recording={live}
          busy={state === 'starting' || state === 'finishing' || state === 'pausing'}
          onTap={live ? onStop : onRecord}
          onHoldEnd={onStop}
        />
        {ready ? (
          <YStack width={48} />
        ) : paused ? (
          <DockButton icon="play" label="Resume" onPress={onRecord} />
        ) : (
          <DockButton
            icon="pause"
            label="Pause"
            onPress={onPause}
            disabled={state !== 'listening'}
          />
        )}
      </XStack>
      <AppText variant="caption" color="$colorMuted" textAlign="center">
        {hint}
      </AppText>
    </Dock>
  );
}

/** A 48pt round control in the Playback dock: speed, −10, +10, share. */
function RoundControl({
  label,
  text,
  icon,
  onPress,
}: {
  label: string;
  text?: string;
  icon?: IconName;
  onPress: () => void;
}) {
  return (
    <XStack
      role="button"
      accessible
      aria-label={label}
      onPress={onPress}
      width={48}
      height={48}
      borderRadius="$round"
      backgroundColor={{ default: '$color3', press: '$color4' }}
      alignItems="center"
      justifyContent="center">
      {icon ? <Icon name={icon} size={22} /> : <AppText variant="numeralM">{text}</AppText>}
    </XStack>
  );
}

/**
 * Figma "Playback dock": scrubber, speed, −10, play/pause, +10 and share, while a recording is
 * playing (or paused part way).
 */
export function PlaybackDock({
  playing,
  loading,
  positionMs,
  durationMs,
  rate,
  onToggle,
  onSeek,
  onBack,
  onForward,
  onRate,
  onShare,
}: {
  playing: boolean;
  loading: boolean;
  positionMs: number;
  durationMs: number;
  rate: number;
  onToggle: () => void;
  onSeek: (fraction: number) => void;
  onBack: () => void;
  onForward: () => void;
  onRate: () => void;
  onShare: () => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const played = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const seekAt = (x: number) => {
    if (trackWidth > 0) onSeek(x / trackWidth);
  };
  const scrub = Gesture.Pan()
    .minDistance(0)
    .onStart((e) => runOnJS(seekAt)(e.x))
    .onUpdate((e) => runOnJS(seekAt)(e.x));

  return (
    <Dock gap={14}>
      <XStack gap={10} alignItems="center">
        <AppText variant="numeralM" fontVariant={['tabular-nums']} width={40}>
          {formatElapsed(positionMs)}
        </AppText>
        <GestureDetector gesture={scrub}>
          <YStack
            flex={1}
            height={24}
            justifyContent="center"
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            accessible
            accessibilityRole="adjustable"
            aria-label="Position"
            aria-valuetext={`${formatElapsed(positionMs)} of ${formatElapsed(durationMs)}`}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) =>
              e.nativeEvent.actionName === 'increment' ? onForward() : onBack()
            }>
            <YStack height={4} borderRadius={2} backgroundColor="$color4">
              <YStack
                height={4}
                borderRadius={2}
                width={`${played * 100}%`}
                backgroundColor="$accent9"
              />
            </YStack>
            <YStack
              position="absolute"
              left={Math.max(0, played * trackWidth - 7)}
              width={14}
              height={14}
              borderRadius="$round"
              backgroundColor="$accent9"
            />
          </YStack>
        </GestureDetector>
        <AppText
          variant="numeralM"
          color="$colorMuted"
          fontVariant={['tabular-nums']}
          width={40}
          textAlign="right">
          {formatElapsed(durationMs)}
        </AppText>
      </XStack>
      <XStack alignItems="center" justifyContent="space-between">
        <RoundControl label={`Speed ${rate}×`} text={`${rate}×`} onPress={onRate} />
        <RoundControl label="Back 10 seconds" text="−10" onPress={onBack} />
        <XStack
          role="button"
          accessible
          aria-label={playing ? 'Pause' : 'Play'}
          onPress={onToggle}
          width={68}
          height={68}
          borderRadius="$round"
          backgroundColor="$color12"
          alignItems="center"
          justifyContent="center"
          scale={{ default: 1, press: 0.96 }}>
          {loading ? (
            <ActivityIndicator color={palette.color1} />
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size={28} color="color1" />
          )}
        </XStack>
        <RoundControl label="Forward 10 seconds" text="+10" onPress={onForward} />
        <RoundControl label="Share audio" icon="share" onPress={onShare} />
      </XStack>
    </Dock>
  );
}

/** Where the Picked up peek and docks start; the mic button floats just above it. */
const PEEK_BODY_HEIGHT = 8 + 5 + 12 + 41;

/**
 * The way into voice once a note has writing: a round mic floating above the Picked up peek.
 * Starts recording; the Record dock takes the foot of the screen until it stops.
 */
export function VoiceButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <XStack
      role="button"
      accessible
      aria-label="Speak a note"
      onPress={onPress}
      position="absolute"
      right={20}
      bottom={PEEK_BODY_HEIGHT + Math.max(insets.bottom, 12) + 12 + 16}
      width={52}
      height={52}
      borderRadius="$round"
      backgroundColor="$color12"
      alignItems="center"
      justifyContent="center"
      boxShadow="0px 6px 8px rgba(27, 26, 23, 0.18)"
      scale={{ default: 1, press: 0.96 }}>
      <Icon name="mic" size={24} color="color1" />
    </XStack>
  );
}

/** Room the Record dock (with its waveform) or Playback dock takes at the foot of the screen. */
export function useDockHeight(kind: 'record-live' | 'playback' | null) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12) + 10;
  if (kind === 'record-live') return 14 + 32 + 10 + RECORD_SIZE + 10 + 17 + bottom;
  if (kind === 'playback') return 16 + 24 + 14 + 68 + bottom;
  return 0;
}
