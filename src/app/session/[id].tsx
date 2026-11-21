import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, ScrollView } from 'react-native';
import Animated, {
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { Button, Divider, RoundIconButton } from '@/components/ds/controls';
import { NavBar } from '@/components/ds/nav-bar';
import { SyncBanner } from '@/components/ds/sync-banner';
import { AppText } from '@/components/ds/text';
import { UndoToast } from '@/components/ds/undo-toast';
import { EQUIPMENT_LABELS, type Exercise, useCreateExercise } from '@/features/catalog/api';
import { AddExerciseSheet } from '@/features/catalog/components/add-exercise-sheet';
import { formatElapsed, time } from '@/features/home/format';
import {
  type ExerciseSet,
  exerciseUsage,
  isPendingSet,
  type SessionDetail,
  type SessionExercise,
  sessionName,
  useAddSessionExercise,
  useAddSet,
  useDeleteSession,
  useDeleteSet,
  useLastPerformances,
  useRemoveSessionExercise,
  useSession,
  useSessions,
  useUpdateSession,
  useUpdateSessionExercise,
  useUpdateSet,
} from '@/features/sessions/api';
import {
  ExerciseOptionsSheet,
  LogSetSheet,
  type SetDraft,
} from '@/features/sessions/components/exercise-sheets';
import {
  ActionBar,
  type ChipModel,
  ExerciseBlock,
  PopoverMenu,
  RestPill,
  SessionHeader,
  TimerPill,
} from '@/features/sessions/components/session-chrome';
import {
  DeleteSessionSheet,
  type PersonalBest,
  RenameSessionSheet,
  WrapUpSheet,
} from '@/features/sessions/components/session-sheets';
import {
  exerciseBlockMeta,
  heaviest,
  isPersonalBest,
  logSetHint,
  setLabel,
} from '@/features/sessions/format';
import { isPlaceholderName, nameFromExercises } from '@/features/sessions/session-name';
import { useSessionLifecycle } from '@/features/sessions/use-session-lifecycle';
import { useUser } from '@/features/auth/auth-store';
import {
  comparableChecks,
  type RecoveryCheck,
  useRecentRecoveryChecks,
  useSessionRecoveryChecks,
} from '@/features/recovery/api';
import { ExerciseFeelRow, SessionFeelCard } from '@/features/recovery/components';
import { useRecoveryConsentStore } from '@/features/recovery/consent-store';
import { recoveryCheckAvailable } from '@/features/recovery/use-vitals-scan';
import { useNow } from '@/hooks/use-now';
import { track } from '@/lib/analytics';
import { feedback } from '@/lib/feedback';
import { formatMinutes, formatNumber, formatWeightValue, totalVolume } from '@/lib/format';
import { usePreferencesStore } from '@/stores/preferences-store';
import { REST_MS, REST_WARNING_MS, restLeft, useRestTimerStore } from '@/stores/rest-timer-store';
import { trainedMs, useSessionPauseStore } from '@/stores/session-pause-store';
import { useUndoStore } from '@/stores/undo-store';
import { palette } from '@/theme/tamagui.config';

const FULL_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
/** Starting values for an exercise with no history. */
const DEFAULT_DRAFT = { kg: 20, lb: 45, reps: 10 };

type LogTarget = { sessionExerciseId: string; setIndex: number | null };

/** The undo toast sits this far above the action bar's top edge. */
const TOAST_GAP = 12;
/** The action bar's height above the home indicator: 12 top padding + a 52pt button. */
const ACTION_BAR_HEIGHT = 64;
/** Blocks close up when one is removed, and slide when one comes back. */
const BLOCK_LAYOUT = LinearTransition.duration(220);
const BLOCK_EXIT = FadeOut.duration(150);

/**
 * The session without the rows waiting to be deleted (they're hidden while Undo shows), so a
 * refetch in the meantime can't bring them back on screen.
 */
function withoutHidden(data: SessionDetail | undefined, hidden: readonly string[]) {
  if (!data || hidden.length === 0) return data;
  const gone = new Set(hidden);
  return {
    ...data,
    session_exercises: data.session_exercises
      .filter((se) => !gone.has(se.id))
      .map((se) => ({ ...se, exercise_sets: se.exercise_sets.filter((s) => !gone.has(s.id)) })),
  };
}

/**
 * The rest countdown for this session: a light tick 10 seconds before the end and a success
 * buzz when it's over (also announced), then the pill goes away.
 */
function useRestCountdown(sessionId: string, now: number) {
  const rest = useRestTimerStore();
  const left = restLeft(rest, sessionId, now);
  const warned = useRef(0);
  const ended = useRef(0);
  const mine = rest.sessionId === sessionId;
  useEffect(() => {
    if (!mine) return;
    const leftNow = rest.endsAt - now;
    if (leftNow <= REST_WARNING_MS && leftNow > 0 && warned.current !== rest.startedAt) {
      warned.current = rest.startedAt;
      feedback.tick('10 seconds of rest left');
    }
    if (leftNow <= 0 && ended.current !== rest.startedAt) {
      ended.current = rest.startedAt;
      // Only buzz if the rest ran out while you could feel it, not long ago in the background.
      if (leftNow > -2_000) feedback.success('Rest over');
      rest.stop();
    }
  }, [mine, now, rest]);
  return { left, total: rest.endsAt - rest.startedAt, skip: rest.stop };
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const user = useUser();
  const unit = usePreferencesStore((state) => state.weightUnit);
  const session = useSession(id);
  const sessions = useSessions();
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();
  const addSessionExercise = useAddSessionExercise();
  const createExercise = useCreateExercise();
  const updateSessionExercise = useUpdateSessionExercise();
  const removeSessionExercise = useRemoveSessionExercise();
  const addSet = useAddSet();
  const updateSet = useUpdateSet();
  const deleteSet = useDeleteSet();
  const hidden = useUndoStore((s) => s.hidden);
  const removeWithUndo = useUndoStore((s) => s.remove);
  const startRest = useRestTimerStore((s) => s.start);
  const stopRest = useRestTimerStore((s) => s.stop);
  const rest = useRestCountdown(id, now);
  // Leaving the screen ends the chance to Undo: delete now, so the toast can't follow you to
  // another session.
  useEffect(() => () => useUndoStore.getState().flush(), []);
  const sessionChecks = useSessionRecoveryChecks(id).data ?? [];
  const recentChecks = useRecentRecoveryChecks().data ?? [];
  const recoveryOff = useRecoveryConsentStore((s) => s.dismissed);
  // "How do you feel?" buttons: on iOS builds with the SDK, unless turned off in Settings.
  const canCheckFeel = recoveryCheckAvailable() && !recoveryOff;
  const checkFeel = (sessionExerciseId?: string) =>
    router.push({
      pathname: '/recovery-check/[sessionId]',
      params: sessionExerciseId
        ? { sessionId: id, exerciseId: sessionExerciseId }
        : { sessionId: id },
    });
  const sessionCheck = sessionChecks.find((c) => c.session_exercise_id === null) ?? null;
  const watchCheck = (check: RecoveryCheck) =>
    router.push({ pathname: '/recovery-video/[checkId]', params: { checkId: check.id } });
  /** A pill with a video offers to watch it or retake; without one it retakes straight away. */
  const openExerciseCheck = (check: RecoveryCheck | null, sessionExerciseId: string) => {
    const retake = canCheckFeel ? () => checkFeel(sessionExerciseId) : null;
    if (!check?.video_path) return retake?.();
    if (!retake) return watchCheck(check);
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Watch video', 'Retake', 'Cancel'], cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) watchCheck(check);
        if (index === 1) retake();
      },
    );
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [wrappingUp, setWrappingUp] = useState(false);
  const [adding, setAdding] = useState(false);
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  // The exercise options sheet keeps showing its exercise while it slides away.
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const openOptions = (sessionExerciseId: string) => {
    setOptionsFor(sessionExerciseId);
    setOptionsOpen(true);
  };
  // A note to open once the sheet on screen has finished closing: right after an exercise is
  // added (Add exercise), or from Edit / the note preview (exercise options).
  const [noteNext, setNoteNext] = useState<string | null>(null);
  const openPendingNote = () => {
    if (!noteNext) return;
    router.push(`/exercise-note/${noteNext}`);
    setNoteNext(null);
  };
  const closeAdd = () => setAdding(false);

  const data = useMemo(() => withoutHidden(session.data, hidden), [session.data, hidden]);
  const pause = useSessionPauseStore((s) => s.sessions[id]);
  const { skipNextLeave } = useSessionLifecycle(id, data);
  const sessionExercises = data?.session_exercises ?? [];
  const lastQueries = useLastPerformances(
    sessionExercises.map((se) => se.exercise_id),
    id,
  );
  const lastFor = (index: number) => lastQueries[index]?.data ?? null;

  if (!data) {
    return (
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        <NavBar onBack={() => router.back()} />
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
          {session.isLoading ? (
            <ActivityIndicator color={palette.color9} />
          ) : (
            <>
              <AppText variant="title">Couldn’t open this session</AppText>
              <AppText color="$colorMuted" textAlign="center">
                {session.error?.message ?? 'It may have been deleted.'}
              </AppText>
              <Button label="Try again" kind="secondary" onPress={() => void session.refetch()} />
            </>
          )}
        </YStack>
      </YStack>
    );
  }

  const live = data.ended_at === null;
  const name = sessionName(data);
  const allSets = sessionExercises.flatMap((se) => se.exercise_sets);
  const volume = formatNumber(totalVolume(allSets, unit));
  // Time trained, without the time the session spent paused.
  const trained = trainedMs(data, pause, now);
  const timer = live ? formatElapsed(trained) : formatMinutes(trained);
  const minutes = String(Math.round(trained / 60_000));

  const best = personalBest(sessionExercises, lastFor);

  const fail = (title: string) => (error: Error) => Alert.alert(title, error.message);

  // Sheets ------------------------------------------------------------------

  const logExercise = logTarget
    ? sessionExercises.find((se) => se.id === logTarget.sessionExerciseId)
    : undefined;
  const logIndex = logExercise ? (logTarget?.setIndex ?? logExercise.exercise_sets.length) : 0;
  const logLast = logExercise ? lastFor(sessionExercises.indexOf(logExercise)) : null;
  const editingSet =
    logExercise && logTarget?.setIndex !== null && logTarget
      ? logExercise.exercise_sets[logTarget.setIndex]
      : undefined;
  const logInitial = draftFor(logExercise, logIndex, editingSet, logLast?.sets, unit);

  /**
   * Log or save a set. The sheet closes and the chip shows straight away; the save happens in
   * the background and is rolled back, with an alert, if it fails.
   */
  const submitSet = (draft: SetDraft) => {
    if (!logExercise) return;
    setLogTarget(null);
    const label = setLabel({ weight: draft.weight, reps: draft.reps, unit: draft.unit });
    const onError = (error: unknown) => {
      feedback.error();
      fail("Couldn't save the set")(error instanceof Error ? error : new Error(String(error)));
    };
    if (editingSet) {
      updateSet.mutate(
        {
          id: editingSet.id,
          sessionId: id,
          weight: draft.weight,
          reps: draft.reps,
          unit: draft.unit,
          set_type: draft.setType,
        },
        { onError },
      );
      feedback.select();
      return;
    }
    const raw = session.data?.session_exercises.find((se) => se.id === logExercise.id);
    addSet.mutate(
      {
        sessionId: id,
        sessionExerciseId: logExercise.id,
        // After every set, hidden ones included, so an Undo can't leave two in one place.
        position: Math.max(-1, ...(raw ?? logExercise).exercise_sets.map((s) => s.position)) + 1,
        weight: draft.weight,
        reps: draft.reps,
        unit: draft.unit,
        setType: draft.setType,
      },
      { onError, onSuccess: () => track('set_logged') },
    );
    if (live) startRest(id);
    const done = `Set ${logIndex + 1} logged, ${label}`;
    // A new best only the first time it's beaten: heavier than last time and than today's sets.
    const newBest =
      !!logLast?.sets.length &&
      isPersonalBest(draft, [...logLast.sets, ...logExercise.exercise_sets]);
    if (newBest) {
      feedback.celebrate(`${done}. New best on ${logExercise.exercise.name}`);
    } else {
      feedback.success(done);
    }
  };

  /** Delete a set with Undo, from its edit sheet. */
  const removeSet = (set: ExerciseSet, exerciseName: string, index: number) => {
    setLogTarget(null);
    const message = `${exerciseName} set ${index + 1} deleted`;
    removeWithUndo({
      message,
      ids: [set.id],
      commit: () => deleteSet.mutateAsync(set.id),
      onError: fail("Couldn't delete the set"),
    });
    feedback.warn(`${message}. Undo available`);
  };

  const optionsExercise = sessionExercises.find((se) => se.id === optionsFor);
  const usage = exerciseUsage(sessions.data ?? []);

  const addExercise = async (exercise: Exercise) => {
    try {
      const added = await addSessionExercise.mutateAsync({
        sessionId: id,
        exerciseId: exercise.id,
        equipment: exercise.equipment[0] ?? null,
        position: sessionExercises.length,
      });
      setNoteNext(added.id);
      closeAdd();
    } catch (error) {
      fail("Couldn't add the exercise")(error as Error);
    }
  };

  const createAndAdd = async (exerciseName: string) => {
    if (!user) return;
    try {
      const exercise = await createExercise.mutateAsync({ name: exerciseName, userId: user.id });
      await addExercise(exercise);
    } catch (error) {
      fail("Couldn't create the exercise")(error as Error);
    }
  };

  const finish = async (notes: string) => {
    try {
      useUndoStore.getState().flush();
      // A session still called by its placeholder is named from what was logged.
      const logged = isPlaceholderName(data?.title)
        ? nameFromExercises(
            sessionExercises.map((se) => ({
              muscleGroup: se.exercise.muscle_group,
              sets: se.exercise_sets.length,
            })),
          )
        : null;
      await updateSession.mutateAsync({
        id,
        ended_at: new Date().toISOString(),
        notes: notes || null,
        ...(logged ? { title: logged } : {}),
      });
      track('session_finished', { exercises: sessionExercises.length, sets: allSets.length });
      stopRest();
      feedback.success(`${logged ?? name} finished`);
      setWrappingUp(false);
      skipNextLeave();
      router.back();
    } catch (error) {
      fail("Couldn't finish the session")(error as Error);
    }
  };

  const remove = async () => {
    try {
      await deleteSession.mutateAsync(id);
      useSessionPauseStore.getState().forget(id);
      stopRest();
      setDeleting(false);
      skipNextLeave();
      router.back();
    } catch (error) {
      fail("Couldn't delete the session")(error as Error);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <NavBar onBack={() => router.back()}>
        {rest.left !== null && (
          <RestPill leftMs={rest.left} totalMs={rest.total || REST_MS} onSkip={rest.skip} />
        )}
        <TimerPill text={timer} live={live} />
        <RoundIconButton
          icon="info"
          iconSize={20}
          label="Session options"
          active={menuOpen}
          onPress={() => setMenuOpen(true)}
        />
      </NavBar>
      <SyncBanner />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 8,
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}>
        {/* What's already there when the screen opens stays still; only new sets pop in. */}
        <LayoutAnimationConfig skipEntering>
          <SessionHeader
            overline={`STARTED ${time(new Date(data.started_at))}`}
            name={name}
            stats={
              sessionExercises.length > 0
                ? [
                    {
                      value: String(sessionExercises.length),
                      label: sessionExercises.length === 1 ? 'exercise' : 'exercises',
                    },
                    { value: String(allSets.length), label: allSets.length === 1 ? 'set' : 'sets' },
                    { value: volume, label: `${unit} lifted` },
                  ]
                : undefined
            }
          />

          {sessionExercises.length === 0 ? (
            // Empty state, centred in the space under the header and greyed out.
            <YStack
              flex={1}
              gap={6}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal="$8"
              paddingBottom="$10">
              {/* A step down from the title and body styles: 20/26 and 14/20. */}
              <AppText
                variant="title"
                fontSize={20}
                lineHeight="26px"
                color="$color9"
                textAlign="center">
                No exercises yet
              </AppText>
              <AppText fontSize={14} lineHeight="20px" color="$color9" textAlign="center">
                Add your first exercise. Sets, reps and equipment go under each exercise.
              </AppText>
            </YStack>
          ) : (
            <>
              <Divider />
              {sessionExercises.map((se, index) => {
                const last = lastFor(index);
                const exerciseCheck =
                  sessionChecks.find((c) => c.session_exercise_id === se.id) ?? null;
                const chips: ChipModel[] = se.exercise_sets.map((set, setIndex) => ({
                  label: setLabel(set),
                  pr: isPersonalBest(set, last?.sets),
                  pending: isPendingSet(set),
                  onPress: () => setLogTarget({ sessionExerciseId: se.id, setIndex }),
                }));
                return (
                  <Animated.View key={se.id} layout={BLOCK_LAYOUT} exiting={BLOCK_EXIT}>
                    <ExerciseBlock
                      name={se.exercise.name}
                      meta={exerciseBlockMeta(
                        se.equipment ? EQUIPMENT_LABELS[se.equipment] : null,
                        last,
                        new Date(now),
                      )}
                      chips={chips}
                      onAddSet={() => setLogTarget({ sessionExerciseId: se.id, setIndex: null })}
                      onOptions={() => openOptions(se.id)}
                      footer={
                        <ExerciseFeelRow
                          check={exerciseCheck}
                          previous={comparableChecks(recentChecks, {
                            exerciseId: se.exercise_id,
                            before: exerciseCheck?.created_at,
                            excludeSessionId: id,
                          })}
                          onPress={
                            canCheckFeel || exerciseCheck?.video_path
                              ? () => openExerciseCheck(exerciseCheck, se.id)
                              : undefined
                          }
                        />
                      }
                    />
                  </Animated.View>
                );
              })}
            </>
          )}

          {sessionExercises.length > 0 && (
            <SessionFeelCard
              check={sessionCheck}
              previous={comparableChecks(recentChecks, {
                exerciseId: null,
                before: sessionCheck?.created_at,
                excludeSessionId: id,
              })}
              onPress={canCheckFeel ? () => checkFeel() : undefined}
              onWatch={sessionCheck ? () => watchCheck(sessionCheck) : undefined}
            />
          )}
        </LayoutAnimationConfig>
      </ScrollView>

      <ActionBar>
        {sessionExercises.length === 0 ? (
          <Button label="Add exercise" flex={1} onPress={() => setAdding(true)} />
        ) : (
          <>
            <Button
              label="Add exercise"
              kind="secondary"
              flex={1}
              onPress={() => setAdding(true)}
            />
            {live ? (
              <Button label="Finish" flex={1} onPress={() => setWrappingUp(true)} />
            ) : (
              <Button
                label="Reopen"
                flex={1}
                loading={updateSession.isPending}
                onPress={() => {
                  // The time between finishing and reopening doesn't count as training.
                  useSessionPauseStore.getState().pause(id, Date.parse(data.ended_at!));
                  updateSession.mutate({ id, ended_at: null });
                }}
              />
            )}
          </>
        )}
      </ActionBar>

      <UndoToast bottom={Math.max(insets.bottom, 12) + ACTION_BAR_HEIGHT + TOAST_GAP} />

      <PopoverMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        top={insets.top + 48}
        right={16}
        items={[
          { label: 'Rename', icon: 'pencil', onPress: () => setRenaming(true) },
          {
            label: 'Delete session',
            icon: 'trash',
            destructive: true,
            onPress: () => setDeleting(true),
          },
        ]}
      />

      <RenameSessionSheet
        open={renaming}
        name={name}
        saving={updateSession.isPending}
        onClose={() => setRenaming(false)}
        onSave={(title) =>
          updateSession
            .mutateAsync({ id, title })
            .then(() => setRenaming(false))
            .catch(fail("Couldn't rename the session"))
        }
      />

      <DeleteSessionSheet
        open={deleting}
        name={name}
        exercises={sessionExercises.length}
        sets={allSets.length}
        deleting={deleteSession.isPending}
        onClose={() => setDeleting(false)}
        onDelete={() => void remove()}
      />

      <WrapUpSheet
        open={wrappingUp}
        minutes={minutes}
        sets={String(allSets.length)}
        volume={volume}
        unit={unit}
        best={best}
        initialNotes={data.notes ?? ''}
        finishing={updateSession.isPending}
        onClose={() => setWrappingUp(false)}
        onFinish={(notes) => void finish(notes)}
        onDiscard={() => {
          setWrappingUp(false);
          setDeleting(true);
        }}
      />

      <AddExerciseSheet
        open={adding}
        busy={addSessionExercise.isPending || createExercise.isPending}
        onClosed={openPendingNote}
        onClose={closeAdd}
        onAdd={(exercise) => void addExercise(exercise)}
        onCreate={(exerciseName) => void createAndAdd(exerciseName)}
      />

      <LogSetSheet
        open={!!logExercise}
        title={logExercise ? `${logExercise.exercise.name} · set ${logIndex + 1}` : ''}
        hint={
          logExercise
            ? logSetHint(logIndex, logLast?.sets, logExercise.exercise_sets[logIndex - 1])
            : ''
        }
        initial={logInitial}
        setNumber={logIndex + 1}
        editing={!!editingSet}
        onClose={() => setLogTarget(null)}
        onSubmit={submitSet}
        onDelete={
          editingSet && logExercise
            ? () => removeSet(editingSet, logExercise.exercise.name, logIndex)
            : undefined
        }
      />

      <ExerciseOptionsSheet
        open={optionsOpen && !!optionsExercise}
        name={optionsExercise?.exercise.name ?? ''}
        equipmentOptions={optionsExercise?.exercise.equipment ?? []}
        equipment={optionsExercise?.equipment ?? null}
        notes={optionsExercise?.notes[0]?.body ?? ''}
        sessionCount={optionsExercise ? (usage.get(optionsExercise.exercise_id)?.count ?? 0) : 0}
        onClose={() => setOptionsOpen(false)}
        onClosed={openPendingNote}
        onEquipment={(equipment) =>
          optionsExercise && updateSessionExercise.mutate({ id: optionsExercise.id, equipment })
        }
        onEditNote={() => {
          if (!optionsExercise) return;
          setNoteNext(optionsExercise.id);
          setOptionsOpen(false);
        }}
        onSeeHistory={() => {
          setOptionsOpen(false);
          router.navigate('/history');
        }}
        onRemove={() => {
          if (!optionsExercise) return;
          const removed = optionsExercise;
          const message = `${removed.exercise.name} removed`;
          setOptionsOpen(false);
          removeWithUndo({
            message,
            ids: [removed.id],
            commit: () => removeSessionExercise.mutateAsync(removed.id),
            onError: fail("Couldn't remove the exercise"),
          });
          feedback.warn(`${message}. Undo available`);
        }}
      />
    </YStack>
  );
}

/** Prefill: the set being edited, else the previous set, else the same set last time. */
function draftFor(
  sessionExercise: SessionExercise | undefined,
  index: number,
  editing: ExerciseSet | undefined,
  lastSets: ExerciseSet[] | undefined,
  unit: 'kg' | 'lb',
): SetDraft {
  const source =
    editing ?? sessionExercise?.exercise_sets[index - 1] ?? lastSets?.[index] ?? lastSets?.at(-1);
  return {
    weight: source?.weight ?? DEFAULT_DRAFT[source?.unit ?? unit],
    reps: source?.reps ?? DEFAULT_DRAFT.reps,
    unit: source?.unit ?? unit,
    setType: editing?.set_type ?? 'normal',
  };
}

/** The first set in the session heavier than anything last time, for the wrap-up. */
function personalBest(
  sessionExercises: SessionExercise[],
  lastFor: (index: number) => { startedAt: string; sets: ExerciseSet[] } | null,
): PersonalBest | null {
  for (const [index, se] of sessionExercises.entries()) {
    const last = lastFor(index);
    const top = [...se.exercise_sets]
      .filter((s) => isPersonalBest(s, last?.sets))
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
    if (top && last && top.weight !== null) {
      const before = heaviest(last.sets, top.unit) ?? 0;
      const day = FULL_WEEKDAYS[new Date(last.startedAt).getDay()];
      return {
        exercise: se.exercise.name,
        detail: `${formatWeightValue(top.weight)} ${top.unit} × ${top.reps ?? '–'} — up ${formatWeightValue(top.weight - before)} ${top.unit} from ${day}`,
      };
    }
  }
  return null;
}
