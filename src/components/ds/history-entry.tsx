import { YStack } from 'tamagui';

import { AppText } from '@/components/ds/text';

/**
 * Figma "HistoryEntry": overline, then a session's exercises (Geist Medium) or a note's own
 * words (Newsreader), then a caption. A note's caption is what the parser picked out, in
 * yellow11.
 */
export function HistoryEntry({
  kind,
  overline,
  title,
  meta,
  onPress,
  divider = false,
}: {
  kind: 'session' | 'note';
  overline: string;
  title: string;
  meta?: string | null;
  onPress?: () => void;
  /** color4 hairline under the entry, between entries of the same day. */
  divider?: boolean;
}) {
  const note = kind === 'note';
  return (
    <YStack
      role="button"
      accessible
      aria-label={`${overline}. ${title}${meta ? `. ${meta}` : ''}`}
      onPress={onPress}
      gap="$1"
      paddingVertical={14}
      borderBottomWidth={divider ? 1 : 0}
      borderColor="$color4"
      opacity={{ default: 1, press: 0.6 }}>
      <AppText variant="overline">{overline}</AppText>
      <AppText variant={note ? 'noteEntry' : 'bodyStrong'} numberOfLines={note ? 3 : 2}>
        {title}
      </AppText>
      {meta ? (
        <AppText variant="caption" color={note ? '$yellow11' : '$colorMuted'} numberOfLines={1}>
          {meta}
        </AppText>
      ) : null}
    </YStack>
  );
}
