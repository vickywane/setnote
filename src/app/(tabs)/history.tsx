import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { DayGroup } from '@/components/ds/day-group';
import { HistoryEntry } from '@/components/ds/history-entry';
import { AppText } from '@/components/ds/text';
import { ErrorState, LoadingState } from '@/components/ui';
import {
  groupByDay,
  type HistoryDay,
  type HistoryItem,
  historyNoteOverline,
  historyOverline,
  noteMetaLine,
  sessionExercises,
  sessionMeta,
  sessionOverline,
} from '@/features/history/format';
import { ScreenHeader } from '@/features/home/components';
import { noteQuote } from '@/features/home/format';
import { noteHref, useNotes } from '@/features/notes/api';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { type SessionSummary, useSessions } from '@/features/sessions/api';
import { usePreferencesStore, type WeightUnit } from '@/stores/preferences-store';

/** Figma "History / Journal": a day column (date, weekday) beside that day's entries. */
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const sessions = useSessions();
  const notes = useNotes();
  const unit = usePreferencesStore((s) => s.weightUnit);
  const [today, setToday] = useState(() => new Date());

  // Keep the month in the overline current when returning to the tab.
  useFocusEffect(useCallback(() => setToday(new Date()), []));

  const allSessions = sessions.data ?? [];
  const days = groupByDay(allSessions, notes.data ?? [], today);
  const isLoading = sessions.isLoading || notes.isLoading;
  const error = sessions.error ?? notes.error;
  const refetch = () => {
    void sessions.refetch();
    void notes.refetch();
  };
  const pull = usePullToRefresh(() => Promise.all([sessions.refetch(), notes.refetch()]));

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}
        refreshControl={<RefreshControl {...pull} />}>
        <ScreenHeader overline={historyOverline(days, today)} title="History" paddingBottom={20} />

        {isLoading && <LoadingState />}
        {error && <ErrorState message={error.message} onRetry={refetch} />}
        {!isLoading && !error && days.length === 0 && (
          <AppText color="$colorMuted">
            Nothing here yet. Sessions and notes you log show up here, day by day.
          </AppText>
        )}

        {days.map((day) => (
          <Day key={day.day} day={day} sessions={allSessions} unit={unit} />
        ))}
      </ScrollView>
      {/* Content scrolls under the status bar; keep it on white like the page. */}
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        height={insets.top}
        backgroundColor="$background"
      />
    </YStack>
  );
}

function Day({
  day,
  sessions,
  unit,
}: {
  day: HistoryDay;
  sessions: readonly SessionSummary[];
  unit: WeightUnit;
}) {
  return (
    <>
      {day.monthHeading && (
        <AppText variant="overline" paddingTop={28} paddingBottom={10}>
          {day.monthHeading}
        </AppText>
      )}
      <DayGroup date={day.date} weekday={day.weekday}>
        {day.items.map((item, i) => (
          <Entry
            key={`${item.kind}-${item.kind === 'session' ? item.session.id : item.note.id}`}
            item={item}
            sessions={sessions}
            unit={unit}
            divider={i < day.items.length - 1}
          />
        ))}
      </DayGroup>
    </>
  );
}

function Entry({
  item,
  sessions,
  unit,
  divider,
}: {
  item: HistoryItem;
  sessions: readonly SessionSummary[];
  unit: WeightUnit;
  divider: boolean;
}) {
  if (item.kind === 'session') {
    const { session } = item;
    return (
      <HistoryEntry
        kind="session"
        overline={sessionOverline(session)}
        title={sessionExercises(session)}
        meta={sessionMeta(session, sessions, unit)}
        divider={divider}
        onPress={() => router.push(`/session/${session.id}`)}
      />
    );
  }
  const { note } = item;
  return (
    <HistoryEntry
      kind="note"
      overline={historyNoteOverline(note.created_at)}
      title={noteQuote(note.body)}
      meta={noteMetaLine(note)}
      divider={divider}
      onPress={() => router.push(noteHref(note))}
    />
  );
}
