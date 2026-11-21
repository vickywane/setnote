-- RLS smoke test: two throwaway users try to read and change each other's data.
-- Runs in a transaction that is rolled back, so nothing is kept. Expected: B sees 0 rows,
-- B's update/delete affect nothing, the three spoofed inserts fail with RLS errors, A's
-- data is unchanged, and the anon role is denied.
--
-- Run: PGPASSWORD=$SUPABASE_DB_PASSWORD psql "<session pooler URL>" -X -f supabase/tests/rls-smoke.sql

\set ON_ERROR_STOP off
begin;
insert into auth.users (id, aud, role, email, is_anonymous) values
 ('11111111-1111-1111-1111-111111111111','authenticated','authenticated','a@rls.test', false),
 ('22222222-2222-2222-2222-222222222222','authenticated','authenticated', null, true);
-- user A
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select count(*) as catalog_visible_to_a from public.exercises;
insert into public.workout_sessions (id, title) values ('aaaaaaaa-0000-0000-0000-000000000001','A session');
insert into public.session_exercises (id, session_id, exercise_id) select 'aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001', id from public.exercises where name='Bicep curl';
insert into public.exercise_sets (session_exercise_id, weight, reps) values ('aaaaaaaa-0000-0000-0000-000000000002', 32, 10);
insert into public.notes (body) values ('Arm curl 32kg x10');
insert into public.exercises (name, user_id) values ('A private exercise', '11111111-1111-1111-1111-111111111111');
select 'A sees' as who, (select count(*) from public.workout_sessions) s, (select count(*) from public.exercise_sets) sets, (select count(*) from public.notes) n;
-- user B (anonymous guest)
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":true}';
select 'B sees' as who, (select count(*) from public.workout_sessions) s, (select count(*) from public.exercise_sets) sets, (select count(*) from public.notes) n, (select count(*) from public.exercises where user_id is not null) other_exercises;
update public.workout_sessions set title='hacked' where id='aaaaaaaa-0000-0000-0000-000000000001';
delete from public.notes;
savepoint p1;
insert into public.exercise_sets (session_exercise_id, weight, reps) values ('aaaaaaaa-0000-0000-0000-000000000002', 1, 1);
rollback to p1;
insert into public.workout_sessions (user_id, title) values ('11111111-1111-1111-1111-111111111111','spoofed');
rollback to p1;
insert into public.exercises (name, user_id) values ('Global spoof', null);
rollback to p1;
-- back to A: data intact?
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select 'A after B' as who, (select title from public.workout_sessions) title, (select count(*) from public.notes) n;
-- anon role (no sign-in)
set local role anon;
select count(*) from public.exercises;
rollback;
