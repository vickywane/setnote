-- Notes belong to a session, to one exercise in a session, or to neither (a one-off note).
--
--   session_id   session_exercise_id   what it is
--   null         null                  one-off note, written outside a session
--   set          null                  note written during a session
--   set          set                   note about one exercise in that session
--
-- Exercise notes used to live in session_exercises.notes. They move here so every note,
-- whatever it belongs to, is listed the same way (Recent notes, History) and is parsed the
-- same way (`extracted`). Notes never hold empty text.

-- 1. The exercise a note is about. Deleting the exercise (or its session) deletes its note.
alter table public.notes
  add column session_exercise_id uuid references public.session_exercises (id) on delete cascade;

-- An exercise has at most one note.
create unique index notes_session_exercise_key
  on public.notes (session_exercise_id)
  where session_exercise_id is not null;

-- An exercise note always belongs to that exercise's session; keep session_id in step.
create function public.notes_sync_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.session_exercise_id is not null then
    select se.session_id into new.session_id
    from public.session_exercises se
    where se.id = new.session_exercise_id;
  end if;
  return new;
end;
$$;

create trigger notes_sync_session
  before insert or update of session_exercise_id, session_id on public.notes
  for each row execute function public.notes_sync_session();

alter table public.notes
  add constraint notes_exercise_note_has_session
  check (session_exercise_id is null or session_id is not null);

-- 2. Move existing exercise notes over, then drop the old column.
insert into public.notes (user_id, session_id, session_exercise_id, body, created_at)
select se.user_id, se.session_id, se.id, btrim(se.notes), se.created_at
from public.session_exercises se
where se.notes is not null and btrim(se.notes) <> '';

alter table public.session_exercises drop column notes;

-- 3. No empty notes.
delete from public.notes where btrim(body) = '';
alter table public.notes alter column body drop default;
alter table public.notes
  add constraint notes_body_not_empty check (btrim(body) <> '');

-- 4. Row-level security: the exercise must be yours too.
drop policy "Create own notes" on public.notes;
drop policy "Update own notes" on public.notes;

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
    and (
      session_exercise_id is null
      or exists (
        select 1 from public.session_exercises se
        where se.id = session_exercise_id and se.user_id = (select auth.uid())
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
    and (
      session_exercise_id is null
      or exists (
        select 1 from public.session_exercises se
        where se.id = session_exercise_id and se.user_id = (select auth.uid())
      )
    )
  );
