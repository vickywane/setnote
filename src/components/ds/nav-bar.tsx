import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

import { Icon } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';

/** Figma "Nav" row (44pt): back to Notes, then trailing items. */
export function NavBar({
  backLabel = 'Notes',
  onBack,
  children,
}: {
  backLabel?: string;
  onBack: () => void;
  children?: ReactNode;
}) {
  return (
    <XStack height={44} gap="$2" alignItems="center" paddingLeft="$2" paddingRight="$4">
      <XStack
        role="button"
        accessible
        aria-label={`Back to ${backLabel}`}
        onPress={onBack}
        gap={2}
        alignItems="center"
        height={44}
        opacity={{ default: 1, press: 0.6 }}>
        <Icon name="chevron-left" size={24} />
        <AppText>{backLabel}</AppText>
      </XStack>
      <YStack flex={1} />
      {children}
    </XStack>
  );
}
