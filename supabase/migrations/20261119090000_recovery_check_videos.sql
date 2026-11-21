-- Optional video of a recovery check, to rewatch. Off unless the user turns on "Save check
-- videos" in Settings and leaves "Save a video of this check" on for that check.
--
-- Where the file lives depends on the account:
-- - 'cloud': signed-in (email) users. The private `recovery-videos` bucket at
--   <user_id>/<check_id>.mp4.
-- - 'device': guests. The app's documents folder on that phone; video_path is relative to it
--   (recovery-videos/<check_id>.mp4), since the absolute app path changes between installs.
--
-- Deleting a check (a retake, removing the exercise, deleting the session or the account)
-- deletes its row; the app removes the file first (Storage objects can't be deleted from SQL).

alter table public.recovery_checks
  add column video_path text check (char_length(video_path) <= 512),
  add column video_location text check (video_location in ('cloud', 'device')),
  add constraint recovery_checks_video_check
    check ((video_path is null) = (video_location is null)),
  -- A cloud video must be in the user's own folder.
  add constraint recovery_checks_video_folder_check
    check (video_location is distinct from 'cloud' or split_part(video_path, '/', 1) = user_id::text);

-- Storage ----------------------------------------------------------------------

-- 45 seconds at about 1.5 Mbit/s is under 10 MB; 50 MB leaves room.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recovery-videos', 'recovery-videos', false, 52428800, array['video/mp4'])
on conflict (id) do nothing;

create policy "Read own recovery videos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recovery-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Upload own recovery videos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recovery-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Delete own recovery videos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recovery-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
