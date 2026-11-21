import { XStack } from 'tamagui';

import { Icon } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';

/**
 * Top right of the Notes home: who's logged in, and the way to the account. A signed-in user
 * sees the first letter of their email on ink; a guest sees an outline person on paper.
 */
export function ProfileButton({ email, onPress }: { email: string | null; onPress: () => void }) {
  const initial = email?.trim().charAt(0).toUpperCase() || null;
  return (
    <XStack
      role="button"
      accessible
      aria-label={initial ? `Account, signed in as ${email}` : 'Account, using as a guest'}
      onPress={onPress}
      hitSlop={8}
      width={36}
      height={36}
      borderRadius="$round"
      alignItems="center"
      justifyContent="center"
      backgroundColor={initial ? '$color12' : '$color3'}
      opacity={{ default: 1, press: 0.7 }}>
      {initial ? (
        <AppText variant="bodyStrong" color="$color1">
          {initial}
        </AppText>
      ) : (
        <Icon name="user" size={20} />
      )}
    </XStack>
  );
}
