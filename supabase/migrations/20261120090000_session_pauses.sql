-- Session pauses follow the account across phones. Until now they lived only on the device
-- (src/stores/session-pause-store.ts); the app still keeps a local copy for instant reads and
-- writes these columns through when a session is paused or continued.
--
-- paused_at: when the session was paused, or null while it's running.
-- paused_ms: total time spent paused before paused_at.

alter table public.workout_sessions
  add column paused_at timestamptz,
  add column paused_ms bigint not null default 0,
  add constraint workout_sessions_paused_ms_non_negative check (paused_ms >= 0);
-- No ordering check against started_at: pause times come from the phone's clock, which can
-- be a little behind the server's.

-- Existing RLS policies on workout_sessions already scope these columns to auth.uid().
