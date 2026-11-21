-- Recovery check: an optional camera reading of pulse, breathing rate and HRV taken right
-- after finishing a session (Presage SmartSpectra SDK, on the phone). One per session;
-- retaking it replaces the reading. For general wellness only, never a diagnosis.
--
-- Only the summary numbers are stored, never video or images. Deleting the session or the
-- account deletes the reading.

create table public.recovery_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null unique references public.workout_sessions (id) on delete cascade,
  -- Beats per minute, breaths per minute, HRV RMSSD in ms. Null when there was no good reading.
  pulse_bpm real check (pulse_bpm is null or pulse_bpm between 20 and 250),
  breathing_bpm real check (breathing_bpm is null or breathing_bpm between 2 and 80),
  hrv_ms real check (hrv_ms is null or hrv_ms between 0 and 1000),
  -- Average SDK confidence (0-100) of the samples kept, and how long the scan ran.
  confidence real check (confidence is null or confidence between 0 and 100),
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index recovery_checks_user_created_idx on public.recovery_checks (user_id, created_at desc);

alter table public.recovery_checks enable row level security;

create policy "Read own recovery checks" on public.recovery_checks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Create own recovery checks" on public.recovery_checks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

create policy "Update own recovery checks" on public.recovery_checks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Delete own recovery checks" on public.recovery_checks
  for delete to authenticated
  using (user_id = (select auth.uid()));
