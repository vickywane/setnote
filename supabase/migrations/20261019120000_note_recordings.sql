-- Voice recordings on notes. Speaking into a note transcribes it on the device into the
-- note's text (so it's parsed like anything typed); the audio is kept here so it can be
-- played back. A note can hold several recordings.
--
-- Audio files live in the private `note-audio` bucket at <user_id>/<note_id>/<time>-<random>.wav.
-- Deleting a note deletes its rows here; the app removes the files first (Storage objects
-- can't be deleted from SQL).

create table public.note_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  -- Object path in the note-audio bucket.
  path text not null unique check (char_length(path) <= 512),
  duration_ms integer not null check (duration_ms >= 0),
  -- Loudness in 32 slices (0-1), for the clip's waveform bars.
  waveform real[] not null default '{}' check (cardinality(waveform) <= 64),
  -- What was heard, as it was added to the note.
  transcript text not null default '' check (char_length(transcript) <= 20000),
  created_at timestamptz not null default now()
);

create index note_recordings_note_idx on public.note_recordings (note_id, created_at);
create index note_recordings_user_idx on public.note_recordings (user_id);

alter table public.note_recordings enable row level security;

create policy "Read own recordings" on public.note_recordings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Create own recordings" on public.note_recordings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notes n
      where n.id = note_id and n.user_id = (select auth.uid())
    )
    -- The file must be in the user's own folder.
    and split_part(path, '/', 1) = (select auth.uid())::text
  );

-- Re-transcribing replaces the transcript.
create policy "Update own recordings" on public.note_recordings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Delete own recordings" on public.note_recordings
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Storage ----------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-audio', 'note-audio', false, 52428800, array['audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;

create policy "Read own note audio" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'note-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Upload own note audio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'note-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Delete own note audio" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'note-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
