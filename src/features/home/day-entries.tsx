import { router } from 'expo-router';
import { YStack } from 'tamagui';

import { DayGroup } from '@/components/ds/day-group';
import { HistoryEntry } from '@/components/ds/history-entry';
import { AppText } from '@/components/ds/text';
import { ErrorState, LoadingState } from '@/components/ui';
import {
  groupByDay,
  historyNoteOverline,
  noteMetaLine,
  sessionExercises,
  sessionMeta,
  sessionOverline,
} from '@/features/history/format';
import { SectionHead } from '@/features/home/components';
import { noteQuote, startOfDay, weekdayShort } from '@/features/home/format';
import { dayTitle } from '@/features/home/weeks';
import { noteHref, useNotesOnDay } from '@/features/notes/api';
import { useSessions, useSessionsOnDay } from '@/features/sessions/api';
import { usePreferencesStore } from '@/stores/preferences-store';

/**
 * What was logged on a day picked in the week strip: its sessions and notes, newest first,
 * laid out like Recent notes. Replaces Recent notes until it's closed.
 */
export function DayEntries({ day, now, onClose }: { day: number; now: Date; onClose: () => void }) {
  const sessions = useSessionsOnDay(day);
  const notes = useNotesOnDay(day);
  // Every loaded session, so "new best" can compare with earlier ones.
  const allSessions = useSessions();
  const unit = usePreferencesStore((s) => s.weightUnit);

  const items = groupByDay(sessions.data ?? [], notes.data ?? [], now).flatMap((d) => d.items);
  const date = new Date(day);
  const loading = sessions.isLoading || notes.isLoading;
  const error = sessions.error ?? notes.error;
  const retry = () => {
    void sessions.refetch();
    void notes.refetch();
  };
  const isToday = day === startOfDay(now);

  return (
    <YStack gap={10}>
      <SectionHead title={dayTitle(day, now)} trailing="Close" onTrailingPress={onClose} />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={retry} />
      ) : items.length === 0 ? (
        <AppText color="$colorMuted">
          {isToday ? 'Nothing logged yet today.' : 'Nothing logged on this day.'}
        </AppText>
      ) : (
        <DayGroup size="small" date={String(date.getDate())} weekday={weekdayShort(date)}>
          {items.map((item, i) => {
            const divider = i < items.length - 1;
            if (item.kind === 'session') {
              const { session } = item;
              return (
                <HistoryEntry
                  key={`session-${session.id}`}
                  kind="session"
                  overline={sessionOverline(session)}
                  title={sessionExercises(session)}
                  meta={sessionMeta(session, allSessions.data ?? sessions.data ?? [], unit)}
                  divider={divider}
                  onPress={() => router.push(`/session/${session.id}`)}
                />
              );
            }
            const { note } = item;
            return (
              <HistoryEntry
                key={`note-${note.id}`}
                kind="note"
                overline={historyNoteOverline(note.created_at)}
                title={noteQuote(note.body)}
                meta={noteMetaLine(note)}
                divider={divider}
                onPress={() => router.push(noteHref(note))}
              />
            );
          })}
        </DayGroup>
      )}
    </YStack>
  );
}
