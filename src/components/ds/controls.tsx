import { forwardRef, type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TextInput, type TextInputProps } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { XStack, type XStackProps, YStack } from 'tamagui';

import { Icon, type IconName } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';
import { palette } from '@/theme/tamagui.config';

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'lg' | 'md';

const BUTTON_FRAME: Record<ButtonKind, XStackProps> = {
  primary: { backgroundColor: '$color12' },
  secondary: { backgroundColor: '$color1', borderWidth: 1, borderColor: '$borderColor' },
  ghost: {},
  destructive: { backgroundColor: '$red2' },
};
const BUTTON_TEXT: Record<ButtonKind, string> = {
  primary: '$color1',
  secondary: '$color12',
  ghost: '$color12',
  destructive: '$red9',
};

type ButtonProps = Omit<XStackProps, 'children'> & {
  label: string;
  kind?: ButtonKind;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
};

/**
 * Figma "Button": primary = ink, secondary = outlined, ghost = chromeless, destructive = red.
 * lg is 52pt tall with radius 14, md is 44pt with radius 10.
 */
export function Button({
  label,
  kind = 'primary',
  size = 'lg',
  loading,
  disabled,
  icon,
  onPress,
  ...rest
}: ButtonProps) {
  const lg = size === 'lg';
  const inactive = disabled || loading;
  return (
    <XStack
      role="button"
      accessible
      aria-label={label}
      aria-disabled={inactive}
      onPress={inactive ? undefined : onPress}
      height={lg ? 52 : 44}
      paddingHorizontal={lg ? '$6' : '$4'}
      borderRadius={lg ? '$4' : '$3'}
      gap="$2"
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.4 : { default: 1, press: 0.8 }}
      scale={inactive ? 1 : { default: 1, press: 0.98 }}
      {...BUTTON_FRAME[kind]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? palette.color1 : palette.color12} />
      ) : (
        <>
          {icon && <Icon name={icon} size={20} color={kind === 'primary' ? 'color1' : 'color12'} />}
          <AppText
            variant={lg ? 'bodyStrong' : 'label'}
            color={BUTTON_TEXT[kind]}
            numberOfLines={1}>
            {label}
          </AppText>
        </>
      )}
    </XStack>
  );
}

/** 32pt round icon button on color3, used for sheet close and the session options. */
export function RoundIconButton({
  icon,
  label,
  onPress,
  size = 32,
  iconSize = 16,
  active = false,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  /** Pressed-open state, e.g. while its menu shows (Figma: rgba(27,26,23,0.08)). */
  active?: boolean;
}) {
  return (
    <XStack
      role="button"
      accessible
      aria-label={label}
      onPress={onPress}
      width={size}
      height={size}
      borderRadius="$round"
      backgroundColor={active ? 'rgba(27,26,23,0.08)' : { default: '$color3', press: '$color4' }}
      alignItems="center"
      justifyContent="center"
      hitSlop={(44 - size) / 2}>
      <Icon name={icon} size={iconSize} />
    </XStack>
  );
}

type SetChipState = 'done' | 'pr' | 'add';

/** Figma "SetChip": one logged set (weight × reps), a personal record, or "+ Set". */
export function SetChip({
  value,
  state = 'done',
  pending = false,
  onPress,
  label,
}: {
  value: string;
  state?: SetChipState;
  /** Logged but not saved yet: faded until the server has it. */
  pending?: boolean;
  onPress?: () => void;
  label?: string;
}) {
  const add = state === 'add';
  return (
    <XStack
      role="button"
      accessible
      aria-label={label ?? value}
      onPress={onPress}
      gap="$1"
      alignItems="center"
      paddingHorizontal={12}
      paddingVertical={add ? 6 : 7}
      borderRadius="$round"
      {...(add
        ? { borderWidth: 1, borderStyle: 'dashed', borderColor: '$borderColorStrong' }
        : { backgroundColor: state === 'pr' ? '$accent2' : '$color3' })}
      opacity={pending ? 0.55 : { default: 1, press: 0.7 }}>
      {add ? (
        <>
          <Icon name="plus" size={14} color="color11" />
          <AppText variant="label" color="$colorMuted">
            {value}
          </AppText>
        </>
      ) : (
        <AppText
          variant="numeralM"
          fontWeight="500"
          color={state === 'pr' ? '$accent11' : '$color'}>
          {value}
        </AppText>
      )}
    </XStack>
  );
}

const TAG_TONES = {
  neutral: { bg: '$color3', fg: '$colorMuted' },
  warning: { bg: '$yellow2', fg: '$yellow11' },
  accent: { bg: '$accent2', fg: '$accent11' },
} as const;

/** Figma "Tag": small label, neutral / warning / accent. */
export function Tag({
  text,
  tone = 'neutral',
  ...rest
}: { text: string; tone?: keyof typeof TAG_TONES } & Omit<XStackProps, 'children'>) {
  return (
    <XStack
      alignSelf="flex-start"
      paddingHorizontal="$2"
      paddingVertical={3}
      borderRadius="$2"
      backgroundColor={TAG_TONES[tone].bg}
      {...rest}>
      <AppText variant="caption" fontWeight="500" color={TAG_TONES[tone].fg}>
        {text}
      </AppText>
    </XStack>
  );
}

/** Figma "ListRow": 52pt settings row with a value and chevron, or a destructive label. */
export function ListRow({
  label,
  value,
  tone = 'default',
  onPress,
  last = false,
  plain = false,
}: {
  label: string;
  value?: string;
  tone?: 'default' | 'destructive';
  onPress?: () => void;
  /** Leaves out the bottom hairline. */
  last?: boolean;
  /** No side padding or hairline, for rows inside a sheet body. */
  plain?: boolean;
}) {
  return (
    <XStack
      role="button"
      accessible
      aria-label={value ? `${label}, ${value}` : label}
      onPress={onPress}
      height={52}
      gap="$2"
      alignItems="center"
      paddingHorizontal={plain ? 0 : '$4'}
      borderBottomWidth={last || plain ? 0 : 1}
      borderColor="$borderColor"
      backgroundColor={plain ? undefined : { default: 'transparent', press: '$backgroundHover' }}
      opacity={plain ? { default: 1, press: 0.6 } : undefined}>
      <AppText flex={1} color={tone === 'destructive' ? '$red9' : '$color'}>
        {label}
      </AppText>
      {value !== undefined && <AppText color="$color9">{value}</AppText>}
      {tone === 'default' && <Icon name="chevron-right" size={18} color="color9" />}
    </XStack>
  );
}

/** Hairline divider in theme/borderColor. */
export function Divider(props: XStackProps) {
  return <XStack height={1} alignSelf="stretch" backgroundColor="$borderColor" {...props} />;
}

/** A changed number rolls up into place, like a counter ticking over. */
const ROLL_UP = FadeInDown.duration(200);
const ROLL_DOWN = FadeInUp.duration(200);
const STEP_UP = FadeInDown.duration(120).withInitialValues({ transform: [{ translateY: 10 }] });
const STEP_DOWN = FadeInUp.duration(120).withInitialValues({ transform: [{ translateY: -10 }] });

/**
 * Number over a caption, e.g. "2,880 / kg lifted" (v2/Numeral L + v2/Caption). With `live`, a
 * new value rolls in (up when it grew), so a logged set visibly adds to the totals. Reanimated
 * skips the roll with Reduce Motion.
 */
export function Stat({
  value,
  label,
  live = false,
}: {
  value: string;
  label: string;
  live?: boolean;
}) {
  // Whether the value went up since the last render that showed a different one.
  const [shown, setShown] = useState({ value, grew: true });
  if (shown.value !== value) {
    setShown({ value, grew: parseNumber(value) >= parseNumber(shown.value) });
  }
  const grew = shown.value !== value ? parseNumber(value) >= parseNumber(shown.value) : shown.grew;
  if (live) {
    return (
      <YStack>
        <Animated.View key={value} entering={grew ? ROLL_UP : ROLL_DOWN}>
          <AppText variant="numeralL">{value}</AppText>
        </Animated.View>
        <AppText variant="caption" color="$color9">
          {label}
        </AppText>
      </YStack>
    );
  }
  return (
    <YStack>
      <AppText variant="numeralL">{value}</AppText>
      <AppText variant="caption" color="$color9">
        {label}
      </AppText>
    </YStack>
  );
}

/** "2,880" → 2880; anything unreadable counts as 0. */
function parseNumber(text: string) {
  const n = Number(text.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

type SearchFieldProps = Omit<TextInputProps, 'style'> & { trailing?: ReactNode };

/** Figma "SearchField": 44pt, color3 fill, radius 10, search icon. */
export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { trailing, ...props },
  ref,
) {
  return (
    <XStack
      height={44}
      gap="$2"
      alignItems="center"
      paddingHorizontal="$3"
      borderRadius="$3"
      backgroundColor="$color3">
      <Icon name="search" size={18} color="color9" />
      <TextInput
        ref={ref}
        placeholderTextColor={palette.color9}
        selectionColor={palette.color12}
        autoCorrect={false}
        returnKeyType="search"
        style={{
          flex: 1,
          fontFamily: 'Geist-Regular',
          fontSize: 16,
          color: palette.color12,
          paddingVertical: 0,
        }}
        {...props}
      />
      {trailing}
    </XStack>
  );
});

/** Plain text field: color3 fill, radius 10, 48pt (Figma "Session name field"). */
export const TextField = forwardRef<TextInput, TextInputProps>(function TextField(
  { style, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={palette.color9}
      selectionColor={palette.color12}
      style={[
        {
          minHeight: 48,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: palette.color3,
          fontFamily: 'Geist-Regular',
          fontSize: 16,
          lineHeight: 21,
          color: palette.color12,
        },
        style,
      ]}
      {...props}
    />
  );
});

/**
 * Figma "Stepper": overline label, ± round buttons and a big Geist Mono value. Tap ± for one
 * step; long-press repeats.
 */
export function Stepper({
  label,
  value,
  unit,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  unit: string;
  /** `repeating` is true for the steps a long press repeats. */
  onDecrement: (repeating: boolean) => void;
  onIncrement: (repeating: boolean) => void;
}) {
  // Which way the last tap moved the value: the new number slides in from that side. Nothing
  // moves when the sheet opens, nor while a long press races through values.
  const [step, setStep] = useState<'up' | 'down' | null>(null);
  const entering = step === 'up' ? STEP_UP : step === 'down' ? STEP_DOWN : undefined;
  return (
    <YStack flex={1} gap="$2" alignItems="center">
      <AppText variant="overline">{label}</AppText>
      <XStack alignSelf="stretch" alignItems="center" justifyContent="space-between">
        <StepButton
          icon="minus"
          label={`Decrease ${label.toLowerCase()}`}
          onPress={(repeating) => {
            setStep(repeating ? null : 'down');
            onDecrement(repeating);
          }}
        />
        <YStack alignItems="center">
          <Animated.View key={value} entering={entering}>
            <AppText variant="numeralXL">{value}</AppText>
          </Animated.View>
          <AppText variant="caption" color="$color9">
            {unit}
          </AppText>
        </YStack>
        <StepButton
          icon="plus"
          label={`Increase ${label.toLowerCase()}`}
          onPress={(repeating) => {
            setStep(repeating ? null : 'up');
            onIncrement(repeating);
          }}
        />
      </XStack>
    </YStack>
  );
}

/** Long-press repeat: starts at this interval and speeds up to the fastest. */
const REPEAT_START_MS = 150;
const REPEAT_FASTEST_MS = 45;
const REPEAT_SPEEDUP = 0.88;

function StepButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: (repeating: boolean) => void;
}) {
  // Long-press repeats the step, faster the longer it's held, until released.
  const repeat = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(onPress);
  useEffect(() => {
    latest.current = onPress;
  });
  const stop = () => {
    if (repeat.current) clearTimeout(repeat.current);
    repeat.current = null;
  };
  useEffect(() => stop, []);
  const run = (delay: number) => {
    repeat.current = setTimeout(() => {
      latest.current(true);
      run(Math.max(REPEAT_FASTEST_MS, delay * REPEAT_SPEEDUP));
    }, delay);
  };

  return (
    <XStack
      role="button"
      accessible
      aria-label={label}
      onPress={() => onPress(false)}
      onLongPress={() => {
        stop();
        latest.current(true);
        run(REPEAT_START_MS);
      }}
      onPressOut={stop}
      width={40}
      height={40}
      borderRadius="$round"
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor={{ default: 'transparent', press: '$color3' }}
      scale={{ default: 1, press: 0.94 }}
      alignItems="center"
      justifyContent="center"
      hitSlop={4}>
      <Icon name={icon} size={18} />
    </XStack>
  );
}

/**
 * Selectable pill: ink when selected, outlined otherwise. `md` is the equipment picker
 * (14 × 9 padding), `sm` the set type (12 × 8).
 */
export function ChoiceChip({
  label,
  selected,
  onPress,
  size = 'md',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: 'sm' | 'md';
}) {
  const md = size === 'md';
  return (
    <XStack
      role="radio"
      accessible
      aria-label={label}
      aria-checked={selected}
      onPress={onPress}
      paddingHorizontal={md ? 14 : 12}
      paddingVertical={selected ? (md ? 9 : 8) : md ? 8 : 7}
      borderRadius="$round"
      {...(selected
        ? { backgroundColor: '$color12' }
        : { borderWidth: 1, borderColor: '$borderColor' })}
      opacity={{ default: 1, press: 0.7 }}>
      <AppText variant="label" color={selected ? '$color1' : '$colorMuted'}>
        {label}
      </AppText>
    </XStack>
  );
}

/** "Browse all 39 exercises ›": a label row with a chevron (Figma "Browse all"). */
export function ChevronLink({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <XStack
      role="button"
      accessible
      aria-label={label}
      onPress={onPress}
      alignItems="center"
      paddingTop="$1"
      minHeight={32}
      opacity={{ default: 1, press: 0.6 }}>
      <AppText variant="label" flex={1}>
        {label}
      </AppText>
      <Icon name="chevron-right" size={18} color="color9" />
    </XStack>
  );
}
