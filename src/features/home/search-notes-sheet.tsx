import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { SearchField } from '@/components/ds/controls';
import { DayGroup } from '@/components/ds/day-group';
import { Icon } from '@/components/ds/icon';
import { HistoryEntry } from '@/components/ds/history-entry';
import { BottomSheet } from '@/components/ds/sheet';
import { AppText } from '@/components/ds/text';
import { groupByDay, noteMetaLine } from '@/features/history/format';
import { noteOverline, noteQuote } from '@/features/home/format';
import { noteHref, useSearchNotes } from '@/features/notes/api';
import { sessionName } from '@/features/sessions/api';
import { palette } from '@/theme/tamagui.config';

/** Wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 250;

/**
 * "Search notes": slides up from the search icon beside Recent notes. Searches the text of
 * every note (not just the recent ones) and lists matches by day, like History.
 */
export function SearchNotesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearched(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useSearchNotes(searched);
  const notes = searched ? (results.data ?? []) : [];
  const days = groupByDay([], notes, new Date());
  const typing = query.trim() !== searched;

  const openNote = (href: ReturnType<typeof noteHref>) => {
    onClose();
    router.push(href);
  };

  let body;
  if (!query.trim()) {
    body = (
      <AppText color="$colorMuted">
        Find a note by anything you wrote in it: an exercise, a weight, how it felt.
      </AppText>
    );
  } else if (results.isError) {
    body = (
      <AppText color="$colorMuted">Couldn’t search your notes. Check your connection.</AppText>
    );
  } else if (notes.length > 0) {
    // While the next search runs, the last results stay up.
    body = <Results days={days} count={notes.length} onOpen={openNote} />;
  } else if (typing || results.isFetching) {
    body = (
      <YStack paddingTop="$4" alignItems="center">
        <ActivityIndicator color={palette.color9} />
      </YStack>
    );
  } else {
    body = <AppText color="$colorMuted">No notes with “{searched}”.</AppText>;
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={() => setQuery('')}
      title="Search notes"
      designHeight={760}
      bodyProps={{ gap: '$3', paddingHorizontal: 0 }}>
      <XStack paddingHorizontal="$5">
        <YStack flex={1}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Bench, 80kg, felt easy…"
            accessibilityLabel="Search notes"
            autoCapitalize="none"
            autoFocus
            trailing={
              query ? (
                // iOS-style clear button: a filled grey circle, so it shows on the grey field.
                <YStack
                  role="button"
                  accessible
                  aria-label="Clear search"
                  onPress={() => setQuery('')}
                  width={18}
                  height={18}
                  borderRadius="$round"
                  backgroundColor={{ default: '$color8', press: '$color9' }}
                  alignItems="center"
                  justifyContent="center"
                  hitSlop={13}>
                  <Icon name="x" size={10} color="color1" />
                </YStack>
              ) : undefined
            }
          />
        </YStack>
      </XStack>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {body}
      </ScrollView>
    </BottomSheet>
  );
}

function Results({
  days,
  count,
  onOpen,
}: {
  days: ReturnType<typeof groupByDay>;
  count: number;
  onOpen: (href: ReturnType<typeof noteHref>) => void;
}) {
  return (
    <>
      <AppText variant="overline">
        {count} {count === 1 ? 'NOTE' : 'NOTES'}
      </AppText>
      <YStack>
        {days.map((day) => (
          <YStack key={day.day}>
            {day.monthHeading && (
              <AppText variant="overline" paddingTop={16} paddingBottom={10}>
                {day.monthHeading}
              </AppText>
            )}
            <DayGroup size="small" date={day.date} weekday={day.weekday}>
              {day.items.map(
                (item, i) =>
                  item.kind === 'note' && (
                    <HistoryEntry
                      key={item.note.id}
                      kind="note"
                      overline={noteOverline(
                        item.note.created_at,
                        item.note.session ? sessionName(item.note.session) : null,
                      )}
                      title={noteQuote(item.note.body)}
                      meta={noteMetaLine(item.note)}
                      divider={i < day.items.length - 1}
                      onPress={() => onOpen(noteHref(item.note))}
                    />
                  ),
              )}
            </DayGroup>
          </YStack>
        ))}
      </YStack>
    </>
  );
}
