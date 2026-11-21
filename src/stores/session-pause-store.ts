import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getAppStorage } from '@/lib/persist-storage';

export type PauseState = {
  /** When the session was paused, or null while it's running. */
  pausedAt: number | null;
  /** Total time spent paused before `pausedAt`. */
  pausedMs: number;
};

type SessionPauseStore = {
  /** False until the saved pauses have loaded; don't read or change pauses before that. */
  hydrated: boolean;
  sessions: Record<string, PauseState>;
  pause: (id: string, at?: number) => void;
  resume: (id: string, at?: number) => void;
  forget: (id: string) => void;
  /** Takes pauses from elsewhere (the account) for a session this device has none for. */
  seed: (id: string, pause: PauseState) => void;
};

/**
 * Pauses for sessions in progress. Leaving the session screen pauses it, so the clock only
 * counts time spent in the session; Continue picks it up again.
 *
 * The device copy is what screens read. `features/sessions/pause-sync.ts` writes each change
 * through to `workout_sessions` (paused_at, paused_ms) and seeds sessions paused on another
 * phone, so pauses follow the account.
 */
export const useSessionPauseStore = create<SessionPauseStore>()(
  persist(
    (set) => ({
      hydrated: false,
      sessions: {},
      pause: (id, at = Date.now()) =>
        set((state) => {
          const current = state.sessions[id] ?? { pausedAt: null, pausedMs: 0 };
          if (current.pausedAt !== null) return state;
          return { sessions: { ...state.sessions, [id]: { ...current, pausedAt: at } } };
        }),
      resume: (id, at = Date.now()) =>
        set((state) => {
          const current = state.sessions[id];
          if (!current || current.pausedAt === null) return state;
          const pausedMs = current.pausedMs + Math.max(0, at - current.pausedAt);
          return { sessions: { ...state.sessions, [id]: { pausedAt: null, pausedMs } } };
        }),
      seed: (id, pause) =>
        set((state) =>
          state.sessions[id] ? state : { sessions: { ...state.sessions, [id]: pause } },
        ),
      forget: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.sessions;
          return { sessions: rest };
        }),
    }),
    {
      name: 'session-pauses',
      storage: createJSONStorage(getAppStorage),
      partialize: (state) => ({ sessions: state.sessions }),
      // Pausing before the saved state has loaded would overwrite it (and lose paused time).
      onRehydrateStorage: () => () => useSessionPauseStore.setState({ hydrated: true }),
    },
  ),
);

type SessionTimes = { id: string; started_at: string; ended_at: string | null };

/**
 * Time actually trained: from the start to the end (or to now, or to the pause), minus time
 * spent paused. Pure, so it can be used with any snapshot of the store.
 */
export function trainedMs(
  session: SessionTimes,
  pause: PauseState | undefined,
  now: number = Date.now(),
) {
  const start = Date.parse(session.started_at);
  // A session ended while paused (e.g. a new one was started) stopped counting at the pause.
  const stop = session.ended_at ? Date.parse(session.ended_at) : now;
  const end = pause?.pausedAt != null ? Math.min(stop, pause.pausedAt) : stop;
  return Math.max(0, end - start - (pause?.pausedMs ?? 0));
}

export function isPaused(session: SessionTimes, pause: PauseState | undefined) {
  return session.ended_at === null && pause?.pausedAt != null;
}
