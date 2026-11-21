import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack, type YStackProps } from 'tamagui';

import { RoundIconButton } from '@/components/ds/controls';
import { AppText } from '@/components/ds/text';
import { SCRIM, SHEET_SHADOW, palette } from '@/theme/tamagui.config';

/** The frames in Figma are 874pt tall; sheet heights are given as a share of that. */
export const DESIGN_SCREEN_HEIGHT = 874;

/** How long a sheet takes to slide up. */
export const SHEET_OPEN_MS = 280;
const OPEN = { duration: SHEET_OPEN_MS, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) };
const DISMISS_DISTANCE = 80;

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Height in design points on the 874pt Figma frame; scaled to the device. Omit to fit content. */
  designHeight?: number;
  children: ReactNode;
  /** Overrides for the body container (default: 20pt sides, 12pt top, 16pt gap). */
  bodyProps?: YStackProps;
  /** Replaces the default title header (the grabber stays). */
  header?: ReactNode;
  /** Called once the sheet has animated out, e.g. to open another sheet after this one. */
  onClosed?: () => void;
};

/**
 * Half-screen sheet from the design (Figma "Sheet · …" frames, a Tamagui-style <Sheet> with a
 * snap point): the screen stays visible under a 32% ink scrim, the sheet has a 22pt top radius
 * and a SheetHeader. Drag the header down, tap the scrim or ✕ to dismiss.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  designHeight,
  children,
  bodyProps,
  header,
  onClosed,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Stays mounted after `open` turns false until the sheet has animated out.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const sheetHeight = designHeight
    ? Math.round((designHeight / DESIGN_SCREEN_HEIGHT) * windowHeight)
    : undefined;

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <SheetContent
          open={open}
          onExited={() => {
            setMounted(false);
            onClosed?.();
          }}
          height={sheetHeight}
          windowHeight={windowHeight}
          topInset={insets.top}
          bottomInset={insets.bottom}
          onClose={onClose}
          title={title}
          header={header}
          bodyProps={bodyProps}>
          {children}
        </SheetContent>
      </GestureHandlerRootView>
    </Modal>
  );
}

function SheetContent({
  open,
  onExited,
  height,
  windowHeight,
  topInset,
  bottomInset,
  onClose,
  title,
  header,
  bodyProps,
  children,
}: {
  open: boolean;
  onExited: () => void;
  height?: number;
  windowHeight: number;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
  title?: string;
  header?: ReactNode;
  bodyProps?: YStackProps;
  children: ReactNode;
}) {
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  // Animate in on open; animate out, then let the parent unmount.
  useEffect(() => {
    if (open) {
      drag.set(0);
      progress.set(withTiming(1, OPEN));
    } else {
      progress.set(
        withTiming(0, CLOSE, (finished) => {
          if (finished) runOnJS(onExited)();
        }),
      );
    }
  }, [open, progress, drag, onExited]);

  const keyboard = useAnimatedKeyboard();

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      drag.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        drag.set(withTiming(0, OPEN));
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => {
    const keyboardHeight = keyboard.height.get();
    // With the keyboard up, the sheet sits on it and shrinks to stay below the status bar.
    const room = windowHeight - keyboardHeight - topInset - 8;
    return {
      height: height === undefined ? undefined : Math.min(height, room),
      paddingBottom: keyboardHeight > 0 ? 8 : bottomInset,
      transform: [
        {
          translateY: (1 - progress.get()) * (height ?? windowHeight) + drag.get() - keyboardHeight,
        },
      ],
    };
  });

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, { boxShadow: SHEET_SHADOW }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <YStack>{header ?? <SheetHeader title={title ?? ''} onClose={onClose} />}</YStack>
        </GestureDetector>
        <YStack
          flex={height ? 1 : undefined}
          gap="$4"
          paddingTop="$3"
          paddingHorizontal="$5"
          {...bodyProps}>
          {children}
        </YStack>
      </Animated.View>
    </>
  );
}

/** Figma "SheetHeader": grabber, Newsreader title and the ✕ close button. 60pt tall. */
export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <YStack height={60} gap={10} alignItems="center" paddingTop="$2" paddingHorizontal="$5">
      <Grabber />
      <XStack alignSelf="stretch" alignItems="center">
        <AppText variant="title" flex={1} role="heading" numberOfLines={1}>
          {title}
        </AppText>
        <RoundIconButton icon="x" label="Close" onPress={onClose} />
      </XStack>
    </YStack>
  );
}

export function Grabber() {
  return <YStack width={36} height={5} borderRadius={3} backgroundColor="$color6" />;
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.color1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
});
