import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { XStack } from 'tamagui';

import { AppText } from '@/components/ds/text';
import { usePausedSaveCount, useOnline } from '@/hooks/use-online';
import { plural } from '@/lib/format';

/**
 * "Offline · 3 changes will sync when you're back online": a quiet strip under the nav while
 * the device is offline or saves are still waiting, so a change shown on screen is never a
 * silent false success.
 */
export function SyncBanner() {
  const online = useOnline();
  const waiting = usePausedSaveCount();
  if (online && waiting === 0) return null;
  const message = online
    ? `Syncing ${plural(waiting, 'change')}…`
    : waiting > 0
      ? `Offline · ${plural(waiting, 'change')} will sync when you’re back online`
      : 'Offline · changes will sync when you’re back online';
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(250)}>
      <XStack
        role="status"
        aria-live="polite"
        accessible
        aria-label={message}
        paddingHorizontal="$4"
        paddingVertical="$2"
        backgroundColor="$color3"
        borderBottomWidth={1}
        borderColor="$color5">
        <AppText variant="caption" color="$colorMuted">
          {message}
        </AppText>
      </XStack>
    </Animated.View>
  );
}
