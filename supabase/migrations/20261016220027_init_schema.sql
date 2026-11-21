-- Core data model for Gym Notes (VIC-57, VIC-58).
--
-- Both input modes write to the same data: structured logging creates
-- workout_sessions -> session_exercises -> exercise_sets, and free-text notes are
-- stored in `notes` with their extracted values (VIC-62).
--
-- Every user-owned table carries user_id so row-level security can check ownership
-- without joins. Child rows are also checked against their parent's owner on write.
-- Deleting an auth user removes all of their data (account deletion, VIC-60).

-- Types -------------------------------------------------------------------------

create type public.equipment_type as enum (
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'kettlebell',
  'band',
  'bodyweight',
  'smith_machine',
  'other'
);

create type public.weight_unit as enum ('kg', 'lb');

create type public.set_type as enum ('normal', 'warmup', 'drop', 'failure', 'cluster');

-- Helpers -----------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Exercise catalog (VIC-59) -----------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  -- null for the built-in catalog; set for exercises a user created.
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  muscle_group text check (muscle_group is null or char_length(muscle_group) <= 50),
  -- Equipment this exercise can be done with; the first entry is the default.
  equipment public.equipment_type[] not null default '{}',
  -- Lower-case shorthand used to match free text ("db curl" -> Bicep curl).
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index exercises_name_per_owner_idx
  on public.exercises (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index exercises_user_id_idx on public.exercises (user_id);

-- Structured logging (VIC-61) ---------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 100),
  notes text check (notes is null or char_length(notes) <= 5000),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_ended_after_started check (ended_at is null or ended_at >= started_at)
);

create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);

create trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  equipment public.equipment_type,
  position integer not null default 0 check (position >= 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index session_exercises_session_idx on public.session_exercises (session_id, position);
create index session_exercises_user_exercise_idx on public.session_exercises (user_id, exercise_id);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  weight numeric(6, 2) check (weight is null or weight between 0 and 2000),
  unit public.weight_unit not null default 'kg',
  reps integer check (reps is null or reps between 0 and 1000),
  set_type public.set_type not null default 'normal',
  -- Effort as RPE (1-10).
  rpe numeric(3, 1) check (rpe is null or rpe between 1 and 10),
  created_at timestamptz not null default now()
);

create index exercise_sets_session_exercise_idx on public.exercise_sets (session_exercise_id, position);
create index exercise_sets_user_idx on public.exercise_sets (user_id);

-- Free-text notes (VIC-62) ------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid references public.workout_sessions (id) on delete set null,
  body text not null default '' check (char_length(body) <= 20000),
  -- Values extracted from `body` (exercises, weights, reps, ...); recomputed on save.
  extracted jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_created_idx on public.notes (user_id, created_at desc);
create index notes_session_idx on public.notes (session_id);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Row-level security ------------------------------------------------------------
-- Anonymous (guest) users have the `authenticated` role too, so these policies cover
-- guests and permanent accounts alike.

alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.notes enable row level security;

-- exercises: everyone signed in reads the built-in catalog; users manage their own.
create policy "Read built-in and own exercises" on public.exercises
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

create policy "Create own exercises" on public.exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Update own exercises" on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Delete own exercises" on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- workout_sessions
create policy "Read own sessions" on public.workout_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Create own sessions" on public.workout_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Update own sessions" on public.workout_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Delete own sessions" on public.workout_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- session_exercises: the session must be yours, and the exercise must be visible to you.
create policy "Read own session exercises" on public.session_exercises
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Create own session exercises" on public.session_exercises
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid()))
    )
  );

create policy "Update own session exercises" on public.session_exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid()))
    )
  );

create policy "Delete own session exercises" on public.session_exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- exercise_sets: the parent session exercise must be yours.
create policy "Read own sets" on public.exercise_sets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Create own sets" on public.exercise_sets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.session_exercises se
      where se.id = session_exercise_id and se.user_id = (select auth.uid())
    )
  );

create policy "Update own sets" on public.exercise_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.session_exercises se
      where se.id = session_exercise_id and se.user_id = (select auth.uid())
    )
  );

create policy "Delete own sets" on public.exercise_sets
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- notes: a linked session, if any, must be yours.
create policy "Read own notes" on public.notes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Create own notes" on public.notes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      session_id is null
      or exists (
        select 1 from public.workout_sessions s
        where s.id = session_id and s.user_id = (select auth.uid())
      )
    )
  );

create policy "Update own notes" on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      session_id is null
      or exists (
        select 1 from public.workout_sessions s
        where s.id = session_id and s.user_id = (select auth.uid())
      )
    )
  );

create policy "Delete own notes" on public.notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Data API access: only signed-in users (including guests) get table privileges.
revoke all on public.exercises, public.workout_sessions, public.session_exercises,
  public.exercise_sets, public.notes from anon;
