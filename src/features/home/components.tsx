import { type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { XStack, type XStackProps, YStack } from 'tamagui';

import { Button } from '@/components/ds/controls';
import { Icon, type IconName } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';

/** Overline and Newsreader display title at the top of a tab ("FRI 16 OCT" / "Today"). */
export function ScreenHeader({
  overline,
  title,
  ...rest
}: { overline: string; title: string } & Omit<XStackProps, 'children'>) {
  return (
    <YStack gap="$1" {...rest}>
      <AppText variant="overline">{overline}</AppText>
      <AppText variant="display" role="heading" aria-level={1}>
        {title}
      </AppText>
    </YStack>
  );
}

/** 8pt vermilion dot: the accent is reserved for "live". */
export function LiveDot({ size = 8 }: { size?: number }) {
  return <YStack width={size} height={size} borderRadius="$round" backgroundColor="$accent9" />;
}

/** Two short bars: the neutral "paused" mark (vermilion is reserved for live). */
export function PausedMark() {
  return (
    <XStack width={8} height={8} gap={2} justifyContent="center">
      <YStack width={2.5} height={8} borderRadius={1} backgroundColor="$color9" />
      <YStack width={2.5} height={8} borderRadius={1} backgroundColor="$color9" />
    </XStack>
  );
}

/**
 * Figma "Session in progress" card on the Notes home. Leaving a session pauses it, so here it
 * shows the time trained so far (not a running clock) and Continue.
 */
export function PausedSessionCard({
  trained,
  name,
  summary,
  onContinue,
}: {
  trained: string;
  name: string;
  summary: string;
  onContinue: () => void;
}) {
  return (
    <YStack
      gap="$3"
      paddingHorizontal="$4"
      paddingVertical="$4"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$borderColor">
      <XStack gap="$2" alignItems="center">
        <PausedMark />
        <AppText variant="overline" flex={1}>
          PAUSED · {trained}
        </AppText>
      </XStack>
      <YStack gap={2}>
        <AppText variant="title" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color="$colorMuted" numberOfLines={2}>
          {summary}
        </AppText>
      </YStack>
      <Button label="Continue session" size="md" onPress={onContinue} />
    </YStack>
  );
}

/** How far (or how fast) a card has to be swiped before letting go hides it. */
const SWIPE_DISMISS_DISTANCE = 96;
const SWIPE_DISMISS_VELOCITY = 800;
const SLIDE_OUT = { duration: 180, easing: Easing.in(Easing.cubic) };
const COLLAPSE = { duration: 200, easing: Easing.out(Easing.cubic) };

/**
 * Swipe the child left or right to hide it: it slides off, the space it took closes up, then
 * `onDismiss` runs. A short swipe springs back. Vertical drags are left to the scroll view.
 * `gap` is the parent's gap after this item, closed up along with it.
 */
export function SwipeToDismiss({
  onDismiss,
  gap = 0,
  children,
}: {
  onDismiss: () => void;
  gap?: number;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const offset = useSharedValue(0);
  const height = useSharedValue(0);
  // 0 while on screen, 1 once the space has closed up.
  const collapse = useSharedValue(0);

  const dismiss = (direction: number) => {
    'worklet';
    offset.set(
      withTiming(direction * width, SLIDE_OUT, (slid) => {
        if (!slid) return;
        collapse.set(
          withTiming(1, COLLAPSE, (collapsed) => {
            if (collapsed) runOnJS(onDismiss)();
          }),
        );
      }),
    );
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      offset.set(e.translationX);
    })
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > SWIPE_DISMISS_DISTANCE;
      const fast = Math.abs(e.velocityX) > SWIPE_DISMISS_VELOCITY;
      if (far || fast) dismiss(Math.sign(e.velocityX || e.translationX) || 1);
      else offset.set(withTiming(0, COLLAPSE));
    });

  const style = useAnimatedStyle(() => {
    const c = collapse.get();
    return {
      transform: [{ translateX: offset.get() }],
      opacity: 1 - Math.min(1, Math.abs(offset.get()) / width),
      ...(c > 0 && {
        height: height.get() * (1 - c),
        marginBottom: -gap * c,
        overflow: 'hidden' as const,
      }),
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={style}
        onLayout={(e) => {
          if (collapse.get() === 0) height.set(e.nativeEvent.layout.height);
        }}
        accessibilityActions={[{ name: 'dismiss', label: 'Hide' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'dismiss') onDismiss();
        }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

type TileTone = 'ink' | 'outline' | 'soft';

/** One of the "Ways to log" tiles: an icon, a heading and a caption. */
export function WayToLogTile({
  icon,
  title,
  caption,
  tone,
  onPress,
}: {
  icon: IconName;
  title: string;
  caption: string;
  tone: TileTone;
  onPress: () => void;
}) {
  const ink = tone === 'ink';
  return (
    <YStack
      role="button"
      accessible
      aria-label={`${title}. ${caption}`}
      onPress={onPress}
      flex={1}
      gap={10}
      paddingHorizontal="$4"
      paddingVertical="$4"
      borderRadius="$4"
      {...(tone === 'ink' && { backgroundColor: '$color12' })}
      {...(tone === 'soft' && { backgroundColor: '$color2' })}
      {...(tone === 'outline' && { borderWidth: 1, borderColor: '$borderColor' })}
      opacity={{ default: 1, press: 0.8 }}
      scale={{ default: 1, press: 0.98 }}>
      <Icon name={icon} size={24} color={ink ? 'color1' : 'color12'} />
      <YStack gap={2}>
        <AppText variant="heading" color={ink ? '$color1' : '$color'}>
          {title}
        </AppText>
        <AppText variant="caption" color={ink ? '$color4' : '$colorMuted'}>
          {caption}
        </AppText>
      </YStack>
    </YStack>
  );
}

/** Section heading row: "This week · 3 sessions", "Recent notes · See all". */
export function SectionHead({
  title,
  trailing,
  onTrailingPress,
  onSearch,
}: {
  title: string;
  trailing?: string;
  onTrailingPress?: () => void;
  /** Shows a search icon before the trailing link. */
  onSearch?: () => void;
}) {
  return (
    <XStack alignItems="center" gap="$4">
      <AppText variant="label" flex={1} role="heading">
        {title}
      </AppText>
      {onSearch && (
        <YStack
          role="button"
          accessible
          aria-label="Search notes"
          onPress={onSearch}
          hitSlop={12}
          opacity={{ default: 1, press: 0.5 }}>
          <Icon name="search" size={18} color="color9" />
        </YStack>
      )}
      {trailing && (
        <AppText
          variant="label"
          color="$color9"
          role={onTrailingPress ? 'link' : undefined}
          onPress={onTrailingPress}
          hitSlop={12}>
          {trailing}
        </AppText>
      )}
    </XStack>
  );
}

const SAMPLE_LINES = ['Bench 80kg 8, 8, 6', 'Squat 3x5 100kg', 'RDL 70kg x10 — felt easy'];

/** Figma "Sample note" on the first run: a few lines on ruled paper with a margin rule. */
export function SampleNote() {
  return (
    <YStack
      height={152}
      borderRadius="$4"
      backgroundColor="$color2"
      overflow="hidden"
      aria-label={`Example note: ${SAMPLE_LINES.join('. ')}`}
      accessible>
      {[46, 76, 106, 136].map((top) => (
        <YStack
          key={top}
          position="absolute"
          top={top}
          left={0}
          right={0}
          height={1}
          backgroundColor="$color4"
        />
      ))}
      <YStack
        position="absolute"
        top={0}
        bottom={0}
        left={36}
        width={1}
        backgroundColor="$accent4"
      />
      <YStack position="absolute" top={22} left={48} right={22}>
        {SAMPLE_LINES.map((line) => (
          <AppText key={line} variant="note" numberOfLines={1}>
            {line}
          </AppText>
        ))}
      </YStack>
    </YStack>
  );
}

/** Figma "Create session": 52pt ink button with a plus, floating over the tab bar. */
export function CreateSessionFab({
  onPress,
  bottom,
  busy = false,
}: {
  onPress: () => void;
  bottom: number;
  busy?: boolean;
}) {
  return (
    <XStack
      role="button"
      accessible
      aria-label="Create session"
      aria-busy={busy}
      onPress={busy ? undefined : onPress}
      position="absolute"
      right={20}
      bottom={bottom}
      width={52}
      height={52}
      borderRadius="$round"
      backgroundColor="$color12"
      alignItems="center"
      justifyContent="center"
      boxShadow="0px 6px 8px rgba(27, 26, 23, 0.18)"
      scale={{ default: 1, press: 0.96 }}>
      <Icon name="plus" size={24} color="color1" />
    </XStack>
  );
}
