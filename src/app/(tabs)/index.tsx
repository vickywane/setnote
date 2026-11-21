import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { DayGroup } from '@/components/ds/day-group';
import { HistoryEntry } from '@/components/ds/history-entry';
import { AppText } from '@/components/ds/text';
import { groupByDay, noteMetaLine } from '@/features/history/format';
import {
  PausedSessionCard,
  CreateSessionFab,
  SampleNote,
  ScreenHeader,
  SectionHead,
  SwipeToDismiss,
  WayToLogTile,
} from '@/features/home/components';
import { DayEntries } from '@/features/home/day-entries';
import { ProfileButton } from '@/features/home/profile-button';
import { SearchNotesSheet } from '@/features/home/search-notes-sheet';
import {
  formatElapsed,
  homeOverline,
  noteOverline,
  noteQuote,
  sessionSummary,
  startOfDay,
} from '@/features/home/format';
import { WeekStrip, type WeekStripHandle } from '@/features/home/week-strip';
import {
  historyStart,
  mondayOf,
  sessionCalendar,
  stripDays,
  weekTitle,
} from '@/features/home/weeks';
import { isGuest, useUser } from '@/features/auth/auth-store';
import { noteHref, useNotes } from '@/features/notes/api';
import {
  sessionName,
  useActiveSession,
  useSessionStartTimes,
  useSessions,
  useStartSession,
} from '@/features/sessions/api';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { track } from '@/lib/analytics';
import { feedback } from '@/lib/feedback';
import { plural } from '@/lib/format';
import { trainedMs, useSessionPauseStore } from '@/stores/session-pause-store';
import { useSeedPauseFromAccount } from '@/features/sessions/pause-sync';

const RECENT_NOTES = 3;
/** The Create session button sits 16pt above the tab bar. */
const FAB_GAP_ABOVE_TAB_BAR = 16;
/** Space between the home sections. */
const SECTION_GAP = 24;

export default function NotesHomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const active = useActiveSession();
  const sessions = useSessions();
  const notes = useNotes();
  const startSession = useStartSession();
  const [today, setToday] = useState(() => new Date());
  const pauses = useSessionPauseStore((s) => s.sessions);
  const pauseSession = useSessionPauseStore((s) => s.pause);
  const pausesLoaded = useSessionPauseStore((s) => s.hydrated);

  // Keep "Today", the week strip and "Yesterday" labels current when returning to the tab,
  // or to the app (it may have sat in the background past midnight).
  useFocusEffect(useCallback(() => setToday(new Date()), []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(new Date());
    });
    return () => subscription.remove();
  }, []);

  // Swiping the paused card away only hides it while you stay here; it's back next visit.
  const [pausedCardHidden, setPausedCardHidden] = useState(false);
  const [searching, setSearching] = useState(false);
  useFocusEffect(useCallback(() => () => setPausedCardHidden(false), []));

  const activeSession = active.data;

  // A session in progress isn't on screen here, so it's paused (e.g. after the app was closed
  // from the session screen).
  const activeId = activeSession?.id;
  useSeedPauseFromAccount(activeSession);
  useFocusEffect(
    useCallback(() => {
      if (activeId && pausesLoaded) pauseSession(activeId);
    }, [activeId, pausesLoaded, pauseSession]),
  );
  const recentNotes = (notes.data ?? []).filter((n) => n.body.trim()).slice(0, RECENT_NOTES);
  const loading = notes.isLoading || active.isLoading || sessions.isLoading;

  // "This week": a row of days that scrolls back to the day the account started.
  const startTimes = useSessionStartTimes();
  const calendar = useMemo(() => sessionCalendar(startTimes.data ?? []), [startTimes.data]);
  const todayStart = startOfDay(today);
  const firstDay = historyStart(user?.created_at, calendar.first);
  const days = useMemo(() => stripDays(new Date(todayStart), firstDay), [todayStart, firstDay]);
  const pull = usePullToRefresh(() =>
    Promise.all([startTimes.refetch(), active.refetch(), notes.refetch(), sessions.refetch()]),
  );
  const strip = useRef<WeekStripHandle>(null);
  // Monday of the week in the middle of the strip; null until it reports, which is this week.
  const [weekInView, setWeekInView] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const thisWeek = mondayOf(todayStart);
  const shownWeek = weekInView ?? thisWeek;
  const weekSessions = plural(calendar.perWeek.get(shownWeek) ?? 0, 'session');
  const toggleDay = useCallback(
    (day: number) => setSelectedDay((current) => (current === day ? null : day)),
    [],
  );

  // Another account (sign in / sign out): its history starts elsewhere; start over.
  const userId = user?.id;
  const [weekUser, setWeekUser] = useState(userId);
  if (weekUser !== userId) {
    setWeekUser(userId);
    setSelectedDay(null);
    setWeekInView(null);
  }

  /** "Log sets": back into the session in progress, or a new one. */
  const logSets = async () => {
    if (activeSession) {
      router.push(`/session/${activeSession.id}`);
      return;
    }
    if (startSession.isPending) return;
    try {
      const session = await startSession.mutateAsync();
      track('session_started', { ended_previous: false });
      router.push(`/session/${session.id}`);
    } catch (error) {
      Alert.alert("Couldn't start a session", (error as Error).message);
    }
  };

  const writeNote = () => router.push('/note/new');

  /** Create session: a new session. With one paused, ask first: starting ends it. */
  const createSession = () => {
    if (startSession.isPending) return;
    if (!activeSession) {
      void startNewSession();
      return;
    }
    feedback.select();
    Alert.alert(
      `End ${sessionName(activeSession)}?`,
      'Starting a new session finishes the paused one. It stays in History as it is.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue it', onPress: () => router.push(`/session/${activeSession.id}`) },
        { text: 'End and start new', onPress: () => void startNewSession() },
      ],
    );
  };

  const startNewSession = async () => {
    try {
      const session = await startSession.mutateAsync();
      track('session_started', { ended_previous: !!activeSession });
      router.push(`/session/${session.id}`);
    } catch (error) {
      Alert.alert("Couldn't start a session", (error as Error).message);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 52 + FAB_GAP_ABOVE_TAB_BAR + 24,
          gap: SECTION_GAP,
        }}
        refreshControl={<RefreshControl {...pull} />}>
        <XStack alignItems="flex-end" gap="$3">
          <ScreenHeader overline={homeOverline(today)} title="Today" flex={1} />
          <YStack paddingBottom={4}>
            <ProfileButton
              email={user && !isGuest(user) ? (user.email ?? null) : null}
              onPress={() => router.navigate('/settings')}
            />
          </YStack>
        </XStack>

        {activeSession && pausesLoaded && !pausedCardHidden && (
          <SwipeToDismiss gap={SECTION_GAP} onDismiss={() => setPausedCardHidden(true)}>
            <PausedSessionCard
              trained={formatElapsed(trainedMs(activeSession, pauses[activeSession.id]))}
              name={sessionName(activeSession)}
              summary={sessionSummary(
                activeSession.session_exercises.map((se) => se.exercise.name),
                activeSession.session_exercises.reduce((n, se) => n + se.exercise_sets.length, 0),
              )}
              onContinue={() => router.push(`/session/${activeSession.id}`)}
            />
          </SwipeToDismiss>
        )}

        <XStack gap="$3">
          <WayToLogTile
            tone="soft"
            icon="dumbbell"
            title="Log sets"
            caption="Set by set, prefilled from last time"
            onPress={() => void logSets()}
          />
          <WayToLogTile
            tone="soft"
            icon="note"
            title="Write it down"
            caption="Like your notebook. We pick out the numbers"
            onPress={writeNote}
          />
        </XStack>

        <YStack gap={10}>
          {shownWeek === thisWeek ? (
            <SectionHead title="This week" trailing={weekSessions} />
          ) : (
            <SectionHead
              title={`${weekTitle(shownWeek, today)} · ${weekSessions}`}
              trailing="This week"
              onTrailingPress={() => strip.current?.scrollToToday()}
            />
          )}
          <WeekStrip
            key={userId}
            ref={strip}
            days={days}
            trained={calendar.days}
            today={todayStart}
            selectedDay={selectedDay}
            onSelectDay={toggleDay}
            onWeekChange={setWeekInView}
          />
        </YStack>

        {selectedDay !== null ? (
          <DayEntries day={selectedDay} now={today} onClose={() => setSelectedDay(null)} />
        ) : recentNotes.length > 0 ? (
          <YStack gap={10}>
            <SectionHead
              title="Recent notes"
              trailing="See all"
              onTrailingPress={() => router.navigate('/history')}
              onSearch={() => setSearching(true)}
            />
            <YStack gap={10}>
              {groupByDay([], recentNotes, today).map((day) => (
                <DayGroup key={day.day} size="small" date={day.date} weekday={day.weekday}>
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
                          onPress={() => router.push(noteHref(item.note))}
                        />
                      ),
                  )}
                </DayGroup>
              ))}
            </YStack>
          </YStack>
        ) : (
          !loading && (
            // Nothing written yet: show what a note looks like where the notes will be.
            <YStack gap="$3">
              <SectionHead title="Recent notes" />
              <AppText color="$colorMuted">
                Write your workout the way you would on paper. We’ll pick out the exercises, weights
                and reps.
              </AppText>
              <SampleNote />
            </YStack>
          )
        )}
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

      <CreateSessionFab
        bottom={FAB_GAP_ABOVE_TAB_BAR}
        busy={startSession.isPending}
        onPress={createSession}
      />
      <SearchNotesSheet open={searching} onClose={() => setSearching(false)} />
    </YStack>
  );
}
