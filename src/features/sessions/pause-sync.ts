import { useEffect } from 'react';

import { queryClient, unwrap } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { useSessionPauseStore } from '@/stores/session-pause-store';

/**
 * Keeps session pauses on the account (`workout_sessions.paused_at` / `paused_ms`) so the
 * session clock is right on any phone. The device store stays the fast copy the screens read;
 * every pause or continue is written through, and a phone without its own copy of a session's
 * pauses takes the account's.
 */

type PauseRow = { id: string; paused_at: string | null; paused_ms: number };

const PAUSE_KEY = ['sessions', 'pause'] as const;

const savePause = async ({ id, paused_at, paused_ms }: PauseRow) =>
  unwrap(
    await supabase
      .from('workout_sessions')
      .update({ paused_at, paused_ms })
      .eq('id', id)
      .is('ended_at', null),
  );

// A registered mutationFn lets a write made offline run after an app restart.
queryClient.setMutationDefaults(PAUSE_KEY, { mutationFn: savePause, retry: 2 });

function pushPause(row: PauseRow) {
  queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: PAUSE_KEY })
    .execute(row)
    // Best effort: the device copy is still right here, and the next pause writes again.
    .catch(() => undefined);
}

let started = false;

/** Writes each pause or continue through to the account. Call once at startup. */
export function startPauseSync() {
  if (started) return;
  started = true;
  useSessionPauseStore.subscribe((state, previous) => {
    if (!state.hydrated) return;
    for (const [id, pause] of Object.entries(state.sessions)) {
      const before = previous.sessions[id];
      if (before && before.pausedAt === pause.pausedAt && before.pausedMs === pause.pausedMs) {
        continue;
      }
      pushPause({
        id,
        paused_at: pause.pausedAt === null ? null : new Date(pause.pausedAt).toISOString(),
        paused_ms: Math.round(pause.pausedMs),
      });
    }
  });
}

type SessionPauseColumns = {
  id: string;
  ended_at: string | null;
  paused_at?: string | null;
  paused_ms?: number;
};

/**
 * A session started or paused on another phone: take its pauses from the account when this
 * phone has none of its own, so the clock doesn't count the time it sat paused there.
 */
export function useSeedPauseFromAccount(session: SessionPauseColumns | null | undefined) {
  const hydrated = useSessionPauseStore((s) => s.hydrated);
  const known = useSessionPauseStore((s) => (session ? !!s.sessions[session.id] : true));
  const id = session?.id;
  const pausedAt = session?.paused_at ?? null;
  const pausedMs = session?.paused_ms ?? 0;
  const live = session?.ended_at === null;
  useEffect(() => {
    if (!id || !hydrated || known || !live) return;
    if (pausedAt === null && pausedMs === 0) return;
    useSessionPauseStore.getState().seed(id, {
      pausedAt: pausedAt === null ? null : Date.parse(pausedAt),
      pausedMs,
    });
  }, [id, hydrated, known, live, pausedAt, pausedMs]);
}
