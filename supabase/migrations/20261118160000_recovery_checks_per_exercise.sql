-- Recovery checks are now taken on demand: one for the whole session and/or one per exercise
-- in it ("how do you feel after this?"). A check with session_exercise_id belongs to that
-- exercise; one without belongs to the session. Retaking replaces the earlier check for the
-- same target, so each target still has at most one.

alter table public.recovery_checks drop constraint recovery_checks_session_id_key;

alter table public.recovery_checks
  add column session_exercise_id uuid references public.session_exercises (id) on delete cascade;

-- At most one session-level check per session, and one per exercise.
create unique index recovery_checks_session_level_key
  on public.recovery_checks (session_id) where session_exercise_id is null;
create unique index recovery_checks_exercise_key
  on public.recovery_checks (session_exercise_id) where session_exercise_id is not null;

create index recovery_checks_session_idx on public.recovery_checks (session_id);

-- The exercise must be in the same session and belong to the user.
drop policy "Create own recovery checks" on public.recovery_checks;
create policy "Create own recovery checks" on public.recovery_checks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
    and (
      session_exercise_id is null
      or exists (
        select 1 from public.session_exercises se
        where se.id = session_exercise_id
          and se.session_id = recovery_checks.session_id
          and se.user_id = (select auth.uid())
      )
    )
  );
