import { ActivityIndicator } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { Button } from '@/components/ds/controls';
import { AppText } from '@/components/ds/text';

/** Shared query states used by history and selected-day results. */
export function LoadingState() {
  return (
    <YStack
      minHeight={88}
      alignItems="center"
      justifyContent="center"
      accessibilityRole="progressbar">
      <ActivityIndicator />
    </YStack>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <YStack gap="$3" paddingVertical="$4" accessibilityRole="alert">
      <AppText color="$colorMuted">Couldn&apos;t load this yet. {message}</AppText>
      <XStack>
        <Button label="Try again" kind="secondary" size="md" onPress={onRetry} />
      </XStack>
    </YStack>
  );
}
