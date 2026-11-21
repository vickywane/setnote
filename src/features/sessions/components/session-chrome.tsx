import { type ReactNode, useEffect } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { SetChip, Stat } from '@/components/ds/controls';
import { Icon, type IconName } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';
import { formatElapsed } from '@/features/home/format';
import { MENU_SHADOW, palette } from '@/theme/tamagui.config';

/** The live dot breathes slowly while the session runs. Off with Reduce Motion. */
function LivePulse() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(
      withRepeat(withTiming(0.35, { duration: 1000, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accent9 }, style]}
    />
  );
}

/** Figma "Timer": live elapsed time on an accent pill with a dot; a finished session's length on color3. */
export function TimerPill({ text, live }: { text: string; live: boolean }) {
  return (
    <XStack
      gap={6}
      alignItems="center"
      paddingLeft={live ? 10 : 12}
      paddingRight={12}
      paddingVertical={6}
      borderRadius="$round"
      backgroundColor={live ? '$accent2' : '$color3'}
      accessible
      aria-label={live ? `Session running for ${text}` : `Session lasted ${text}`}>
      {live && <LivePulse />}
      <AppText variant="numeralM" fontWeight="500" color={live ? '$accent11' : '$colorMuted'}>
        {text}
      </AppText>
    </XStack>
  );
}

/**
 * The rest timer between sets: an ink pill counting down, with a fill that drains as the rest
 * runs out. Tap it to skip the rest.
 */
export function RestPill({
  leftMs,
  totalMs,
  onSkip,
}: {
  leftMs: number;
  totalMs: number;
  onSkip: () => void;
}) {
  const share = Math.max(0, Math.min(1, leftMs / totalMs));
  const fill = useSharedValue(share);
  useEffect(() => {
    // Glide to the next second's share rather than stepping once a second.
    fill.set(withTiming(share, { duration: 1000, easing: Easing.linear }));
  }, [fill, share]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  const seconds = Math.ceil(leftMs / 1000);
  const time = formatElapsed(seconds * 1000);
  // The last three seconds: a small beat each second, so you can see it's nearly time without
  // reading the number. Reanimated leaves it still with Reduce Motion.
  const beat = useSharedValue(1);
  useEffect(() => {
    if (seconds > 0 && seconds <= 3) {
      beat.set(withSequence(withTiming(1.08, { duration: 110 }), withTiming(1, { duration: 200 })));
    }
  }, [beat, seconds]);
  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.get() }] }));
  return (
    <Animated.View entering={ZoomIn.duration(200)} style={beatStyle}>
      <XStack
        role="timer"
        accessible
        aria-label={`Rest, ${time} left. Double tap to skip`}
        onPress={onSkip}
        gap={6}
        alignItems="center"
        paddingHorizontal={12}
        paddingVertical={6}
        borderRadius="$round"
        backgroundColor="$color12"
        overflow="hidden"
        opacity={{ default: 1, press: 0.8 }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(255,255,255,0.16)', right: undefined },
            fillStyle,
          ]}
        />
        <AppText variant="caption" fontWeight="500" color="$color4">
          Rest
        </AppText>
        <AppText variant="numeralM" fontWeight="500" color="$color1">
          {time}
        </AppText>
      </XStack>
    </Animated.View>
  );
}

/** Figma "Session header": STARTED 18:05, the session's name and, once it has sets, the stats. */
export function SessionHeader({
  overline,
  name,
  stats,
}: {
  overline: string;
  name: string;
  stats?: { value: string; label: string }[];
}) {
  return (
    <YStack gap="$1" paddingBottom="$4">
      <AppText variant="overline">{overline}</AppText>
      <AppText variant="display" role="heading" numberOfLines={2}>
        {name}
      </AppText>
      {stats && (
        <XStack gap={28} paddingTop={10}>
          {stats.map((s) => (
            <Stat key={s.label} value={s.value} label={s.label} live />
          ))}
        </XStack>
      )}
    </YStack>
  );
}

export type ChipModel = {
  label: string;
  pr: boolean;
  /** Shown before the server has saved it; can't be edited yet. */
  pending?: boolean;
  onPress: () => void;
};

/** A set that was just logged pops in; a new best pops in with a little more spring. */
const CHIP_ENTER = ZoomIn.duration(180);
const PR_CHIP_ENTER = ZoomIn.springify().damping(11).mass(0.7).stiffness(260);

/**
 * Figma "ExerciseBlock": name, equipment and last time, ⋯ for exercise options, and the sets
 * as chips with "+ Set" at the end.
 */
export function ExerciseBlock({
  name,
  meta,
  chips,
  onAddSet,
  onOptions,
  footer,
}: {
  name: string;
  meta: string;
  chips: ChipModel[];
  onAddSet: () => void;
  onOptions: () => void;
  /** Under the sets, e.g. the exercise's recovery check. */
  footer?: ReactNode;
}) {
  return (
    <YStack gap="$3" paddingVertical={18} borderBottomWidth={1} borderColor="$borderColor">
      {/* Tapping the exercise (its name row or ⋯) opens its options. */}
      <XStack
        gap="$2"
        alignItems="center"
        role="button"
        accessible
        aria-label={`${name} options`}
        onPress={onOptions}
        opacity={{ default: 1, press: 0.6 }}>
        <YStack flex={1} gap={2}>
          <AppText variant="heading" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="caption" color="$color9" numberOfLines={1}>
            {meta}
          </AppText>
        </YStack>
        <XStack hitSlop={10}>
          <Icon name="more" size={24} />
        </XStack>
      </XStack>
      <XStack flexWrap="wrap" gap="$2">
        {chips.map((chip, i) => (
          // Keyed by position, so a pending set turning into the saved one doesn't pop in again.
          <Animated.View key={i} entering={chip.pr ? PR_CHIP_ENTER : CHIP_ENTER}>
            <SetChip
              value={chip.label}
              state={chip.pr ? 'pr' : 'done'}
              pending={chip.pending}
              label={`Set ${i + 1}: ${chip.label}${chip.pr ? ', new best' : ''}${chip.pending ? ', saving' : '. Edit'}`}
              onPress={chip.pending ? undefined : chip.onPress}
            />
          </Animated.View>
        ))}
        <SetChip value="Set" state="add" label={`Log a set of ${name}`} onPress={onAddSet} />
      </XStack>
      {footer}
    </YStack>
  );
}

/** Figma "Action bar": hairline on top, buttons in thumb reach above the home indicator. */
export function ActionBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <YStack
      backgroundColor="$background"
      borderTopWidth={1}
      borderColor="$borderColor"
      paddingTop="$3"
      paddingHorizontal="$4"
      paddingBottom={Math.max(insets.bottom, 12)}>
      <XStack gap="$3">{children}</XStack>
    </YStack>
  );
}

export type MenuItem = {
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * Popover menu from the design ("Session options menu", "Recording menu"): white, hairline
 * border, radius 14, 48pt rows with a trailing icon. Tapping outside closes it.
 */
export function PopoverMenu({
  open,
  onClose,
  items,
  top,
  left,
  right,
  width = 220,
  scrim = false,
}: {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  top: number;
  left?: number;
  right?: number;
  width?: number;
  /** Dims the screen behind the menu (the long-press menu does; the options menu doesn't). */
  scrim?: boolean;
}) {
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[StyleSheet.absoluteFill, scrim && { backgroundColor: 'rgba(27, 26, 23, 0.32)' }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      />
      <YStack
        position="absolute"
        top={top}
        left={left}
        right={right}
        width={width}
        backgroundColor="$color1"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$4"
        overflow="hidden"
        boxShadow={MENU_SHADOW}
        role="menu">
        {items.map((item, i) => (
          <XStack
            key={item.label}
            role="menuitem"
            accessible
            aria-label={item.label}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            height={48}
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$4"
            borderBottomWidth={i < items.length - 1 ? 1 : 0}
            borderColor="$borderColor"
            backgroundColor={{ default: 'transparent', press: '$backgroundHover' }}>
            <AppText color={item.destructive ? '$red9' : '$color'}>{item.label}</AppText>
            <Icon name={item.icon} size={20} color={item.destructive ? 'red9' : 'color12'} />
          </XStack>
        ))}
      </YStack>
    </Modal>
  );
}
