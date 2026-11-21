import { useEffect } from 'react';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { XStack } from 'tamagui';

import { AppText } from '@/components/ds/text';
import { useUndoStore } from '@/stores/undo-store';

const ENTER = FadeInDown.duration(220);
const EXIT = FadeOutDown.duration(160);

/**
 * "Bench press removed · Undo": an ink pill above the screen's bottom chrome while a removal can
 * still be undone (see useUndoStore). It slides up from below; with Reduce Motion it just
 * appears. A hairline along its bottom shrinks as the time to undo runs out. The message is also
 * announced, so the toast is never the only signal.
 */
export function UndoToast({ bottom }: { bottom: number }) {
  const pending = useUndoStore((s) => s.pending);
  const undo = useUndoStore((s) => s.undo);
  if (!pending) return null;
  return (
    <Animated.View
      key={pending.key}
      entering={ENTER}
      exiting={EXIT}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom }}>
      <XStack
        alignItems="center"
        gap="$3"
        minHeight={48}
        paddingLeft="$4"
        paddingRight="$2"
        borderRadius="$4"
        overflow="hidden"
        backgroundColor="$color12"
        role="alert">
        <AppText flex={1} color="$color1" numberOfLines={2}>
          {pending.message}
        </AppText>
        <XStack
          role="button"
          accessible
          aria-label={`Undo: ${pending.message}`}
          onPress={undo}
          height={40}
          paddingHorizontal="$3"
          borderRadius="$3"
          alignItems="center"
          backgroundColor={{ default: 'transparent', press: 'rgba(255,255,255,0.12)' }}
          hitSlop={6}>
          <AppText variant="bodyStrong" color="$color1">
            Undo
          </AppText>
        </XStack>
        <Countdown durationMs={pending.durationMs} />
      </XStack>
    </Animated.View>
  );
}

/** The time left to undo, as a bar that empties. Left out with Reduce Motion. */
function Countdown({ durationMs }: { durationMs: number }) {
  const reduceMotion = useReducedMotion();
  const left = useSharedValue(1);
  useEffect(() => {
    left.set(withTiming(0, { duration: durationMs, easing: Easing.linear }));
  }, [left, durationMs]);
  const style = useAnimatedStyle(() => ({ width: `${left.get() * 100}%` }));
  if (reduceMotion) return null;
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        { position: 'absolute', left: 0, bottom: 0, height: 2 },
        { backgroundColor: 'rgba(255,255,255,0.35)' },
        style,
      ]}
    />
  );
}
