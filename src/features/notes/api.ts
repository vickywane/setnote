import { useMutation, useQuery } from '@tanstack/react-query';
import type { Href } from 'expo-router';

import { dayRange, fromList } from '@/features/home/weeks';
import { removeNoteAudio } from '@/features/notes/recordings';
import { sessionKeys } from '@/features/sessions/api';
import type { ExtractedNote } from '@/lib/extraction/parse-note';
import { queryClient, unwrap } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { Json, Tables } from '@/types/database';

/**
 * A note belongs to a session, to one exercise in a session, or to neither (a one-off note,
 * written outside a session). See supabase/migrations/20261019090000_notes_belong_to_sessions.sql.
 */
export type Note = Omit<Tables<'notes'>, 'extracted'> & { extracted: ExtractedNote | null };

/** A note with what it belongs to, for lists (Recent notes, History). */
export type NoteListItem = Note & {
  session: { id: string; title: string | null } | null;
  session_exercise: {
    id: string;
    equipment: Tables<'session_exercises'>['equipment'];
    exercise: { name: string };
  } | null;
};

const LIST_SELECT =
  '*, session:workout_sessions(id, title), session_exercise:session_exercises(id, equipment, exercise:exercises(name))';

/** The notes list holds the newest this many. */
const LIST_LIMIT = 100;

export const noteKeys = {
  all: ['notes'] as const,
  list: () => [...noteKeys.all, 'list'] as const,
  detail: (id: string) => [...noteKeys.all, 'detail', id] as const,
  onDay: (day: number) => [...noteKeys.all, 'day', day] as const,
  search: (query: string) => [...noteKeys.all, 'search', query] as const,
  forExercise: (sessionExerciseId: string) =>
    [...noteKeys.all, 'exercise', sessionExerciseId] as const,
};

const invalidateNotes = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: noteKeys.all }),
    // Sessions show their exercises' notes.
    queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
  ]);

/** Where tapping a note goes: an exercise note opens on its exercise, any other note on its own. */
export function noteHref(note: Pick<Note, 'id' | 'session_exercise_id'>): Href {
  return note.session_exercise_id
    ? `/exercise-note/${note.session_exercise_id}`
    : `/note/${note.id}`;
}

export function useNotes() {
  return useQuery({
    queryKey: noteKeys.list(),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('notes')
          .select(LIST_SELECT)
          .order('created_at', { ascending: false })
          .limit(LIST_LIMIT),
      ) as unknown as NoteListItem[],
  });
}

/**
 * Notes written on `day` (local midnight, ms), newest first. Shown straight away from the
 * notes list when that list reaches back to the day, then refreshed like any query.
 */
export function useNotesOnDay(day: number | null) {
  return useQuery({
    queryKey: noteKeys.onDay(day ?? 0),
    enabled: day !== null,
    queryFn: async () => {
      const { from, to } = dayRange(day ?? 0);
      return unwrap(
        await supabase
          .from('notes')
          .select(LIST_SELECT)
          .gte('created_at', from)
          .lt('created_at', to)
          .order('created_at', { ascending: false }),
      ) as unknown as NoteListItem[];
    },
    initialData: () => {
      if (day === null) return undefined;
      const list = queryClient.getQueryData<NoteListItem[]>(noteKeys.list());
      return list ? fromList(list, day, LIST_LIMIT, (n) => n.created_at) : undefined;
    },
    initialDataUpdatedAt: () => queryClient.getQueryState(noteKeys.list())?.dataUpdatedAt,
  });
}

/** A search query as an `ilike` pattern: matches anywhere, with `%`, `_` and `\` taken literally. */
export function notesSearchPattern(query: string) {
  return `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Notes whose text contains `query`, newest first. Idle while the query is blank. */
export function useSearchNotes(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: noteKeys.search(trimmed),
    enabled: trimmed.length > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('notes')
          .select(LIST_SELECT)
          .ilike('body', notesSearchPattern(trimmed))
          .order('created_at', { ascending: false })
          .limit(LIST_LIMIT),
      ) as unknown as NoteListItem[],
    // Keep the last results up while the next query loads, so the list doesn't flash empty.
    placeholderData: (previous) => previous,
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? 'new'),
    enabled: id !== null,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('notes')
          .select(LIST_SELECT)
          .eq('id', id ?? '')
          .single(),
      ) as unknown as NoteListItem,
  });
}

/** The note about one exercise in a session, or null if there isn't one yet. */
export function useExerciseNote(sessionExerciseId: string) {
  return useQuery({
    queryKey: noteKeys.forExercise(sessionExerciseId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('notes')
          .select('*')
          .eq('session_exercise_id', sessionExerciseId)
          .maybeSingle(),
      ) as unknown as Note | null,
  });
}

type CreateNoteInput = {
  body: string;
  extracted: ExtractedNote;
  /** The session it was written in; omit for a one-off note. */
  sessionId?: string | null;
  /** The exercise it's about; its session is filled in by the database. */
  sessionExerciseId?: string | null;
};

export function useCreateNote() {
  return useMutation({
    mutationFn: async (input: CreateNoteInput) =>
      unwrap(
        await supabase
          .from('notes')
          .insert({
            body: input.body,
            extracted: input.extracted as unknown as Json,
            session_id: input.sessionId ?? null,
            session_exercise_id: input.sessionExerciseId ?? null,
          })
          .select()
          .single(),
      ) as unknown as Note,
    onSuccess: invalidateNotes,
  });
}

export function useUpdateNote() {
  return useMutation({
    mutationFn: async ({
      id,
      body,
      extracted,
    }: {
      id: string;
      body: string;
      extracted: ExtractedNote;
    }) =>
      unwrap(
        await supabase
          .from('notes')
          .update({ body, extracted: extracted as unknown as Json })
          .eq('id', id)
          .select()
          .single(),
      ) as unknown as Note,
    onSuccess: invalidateNotes,
  });
}

export function useDeleteNote() {
  return useMutation({
    mutationFn: async (id: string) => {
      // The recording rows go with the note; their files have to be removed first.
      await removeNoteAudio(id);
      return unwrap(await supabase.from('notes').delete().eq('id', id));
    },
    onSuccess: invalidateNotes,
  });
}

/** First non-empty line of a note, for list titles. */
export function noteTitle(body: string) {
  return (
    body
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? 'Empty note'
  );
}
