import { useIsFocused, useNavigation } from 'expo-router';
import { AppState } from 'react-native';
import { useEffect, useRef } from 'react';

import { type SessionDetail, useDeleteSession } from '@/features/sessions/api';
import { useSeedPauseFromAccount } from '@/features/sessions/pause-sync';
import { useSessionPauseStore } from '@/stores/session-pause-store';

/**
 * What happens around the session screen:
 * - opening an unfinished session continues it (its clock runs again);
 * - leaving it pauses it, so the clock only counts time spent in the session;
 * - the clock also stops while the app is in the background;
 * - leaving a session with no exercises discards it, so empty sessions never reach History.
 *
 * "Leaving" is the screen being removed (back, swipe back), not another screen pushed on top
 * of it such as the camera. Call `skipNextLeave()` before navigating away after finishing or
 * deleting, which already decide what happens to the session.
 */
export function useSessionLifecycle(id: string, session: SessionDetail | undefined) {
  const navigation = useNavigation();
  const deleteSession = useDeleteSession();
  const resume = useSessionPauseStore((s) => s.resume);
  const hydrated = useSessionPauseStore((s) => s.hydrated);
  const latest = useRef(session);
  const skip = useRef(false);
  const deleteRef = useRef(deleteSession.mutate);

  useEffect(() => {
    latest.current = session;
    deleteRef.current = deleteSession.mutate;
  });

  // Before continuing it: a session paused on another phone takes that phone's pauses first.
  useSeedPauseFromAccount(session);

  const live = session?.ended_at === null;
  const focused = useIsFocused();
  useEffect(() => {
    if (hydrated && live && focused) resume(id);
  }, [id, live, focused, hydrated, resume]);

  // The clock also stops while the app is in the background.
  useEffect(() => {
    if (!live) return;
    const subscription = AppState.addEventListener('change', (state) => {
      const store = useSessionPauseStore.getState();
      if (state === 'active') store.resume(id);
      else if (state === 'background') store.pause(id);
    });
    return () => subscription.remove();
  }, [id, live]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        const current = latest.current;
        if (skip.current || !current || current.ended_at !== null) return;
        const store = useSessionPauseStore.getState();
        if (current.session_exercises.length === 0) {
          deleteRef.current(id);
          store.forget(id);
        } else {
          store.pause(id);
        }
      }),
    [navigation, id],
  );

  return {
    skipNextLeave: () => {
      skip.current = true;
    },
  };
}
