import { create } from 'zustand';

/** Rest between sets, as the Log set sheet promises ("Rest timer starts when you log · 1:30"). */
export const REST_MS = 90_000;
/** A light tick this long before the rest runs out, so you can pick the bar up. */
export const REST_WARNING_MS = 10_000;

type RestTimerStore = {
  /** The session the rest belongs to; the timer only shows on that session's screen. */
  sessionId: string | null;
  startedAt: number;
  endsAt: number;
  start: (sessionId: string, at?: number, durationMs?: number) => void;
  stop: () => void;
};

/**
 * The rest timer between sets. Logging a set (re)starts it; finishing or deleting the session,
 * or skipping it from the pill, stops it. It runs on wall-clock time, so it stays right if the
 * app goes to the background, and isn't persisted: after a relaunch the rest is long over.
 */
export const useRestTimerStore = create<RestTimerStore>()((set) => ({
  sessionId: null,
  startedAt: 0,
  endsAt: 0,
  start: (sessionId, at = Date.now(), durationMs = REST_MS) =>
    set({ sessionId, startedAt: at, endsAt: at + durationMs }),
  stop: () => set({ sessionId: null, startedAt: 0, endsAt: 0 }),
}));

/** Milliseconds of rest left for `sessionId` at `now`, or null when it isn't resting. */
export function restLeft(
  state: Pick<RestTimerStore, 'sessionId' | 'startedAt' | 'endsAt'>,
  sessionId: string,
  now: number,
) {
  if (state.sessionId !== sessionId) return null;
  const left = state.endsAt - now;
  // `now` is a clock that ticks once a second, so it can be just before the rest started.
  return left > 0 ? Math.min(left, state.endsAt - state.startedAt) : null;
}
