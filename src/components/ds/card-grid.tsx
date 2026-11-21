import { Children, type ReactNode, useState } from 'react';
import { XStack, YStack } from 'tamagui';

/** Narrowest a card reads well at; two fit side by side only when both get this much. */
const MIN_CARD_WIDTH = 320;
const GAP = 12;

/**
 * Lays cards out in one column, or two when the available width fits two at their minimum
 * width (for example the iPhone Duo inner display). Columns come from the space the grid is
 * given, not the device type or orientation, and stay even.
 */
export function CardGrid({ children, gap = GAP }: { children: ReactNode; gap?: number }) {
  const [width, setWidth] = useState(0);
  const columns = width >= MIN_CARD_WIDTH * 2 + gap ? 2 : 1;
  const items = Children.toArray(children);

  if (columns === 1) {
    return (
      <YStack gap={gap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {items}
      </YStack>
    );
  }

  const itemWidth = (width - gap) / 2;
  return (
    <XStack flexWrap="wrap" gap={gap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {items.map((item, index) => (
        <YStack key={index} width={itemWidth}>
          {item}
        </YStack>
      ))}
    </XStack>
  );
}
