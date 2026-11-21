import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';

import { AppText } from '@/components/ds/text';

/**
 * Figma day group (History / Journal): a hairline, then the date and weekday in a column beside
 * that day's entries. `small` is the Recent notes size on the Notes home: a 32pt column,
 * Newsreader 20/24 date and Geist Mono 10/12 weekday.
 */
export function DayGroup({
  date,
  weekday,
  size = 'default',
  children,
}: {
  /** "16" */
  date: string;
  /** "FRI" */
  weekday: string;
  size?: 'default' | 'small';
  children: ReactNode;
}) {
  const small = size === 'small';
  return (
    <XStack gap={small ? '$3' : '$4'} borderTopWidth={1} borderColor="$borderColor">
      <YStack width={small ? 32 : 44} paddingTop={small ? 14 : 12}>
        {small ? (
          <>
            <AppText
              fontFamily="$heading"
              fontSize={20}
              lineHeight="24px"
              fontWeight="500"
              letterSpacing={-0.2}>
              {date}
            </AppText>
            <AppText variant="overline" fontSize={10} lineHeight="12px" letterSpacing={0.6}>
              {weekday}
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="title">{date}</AppText>
            <AppText variant="overline">{weekday}</AppText>
          </>
        )}
      </YStack>
      <YStack flex={1} minWidth={0}>
        {children}
      </YStack>
    </XStack>
  );
}
