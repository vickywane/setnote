import { useQuery } from '@tanstack/react-query';

import { queryClient } from '@/lib/query-client';
import { fromModel, type ModelExercise } from '@/lib/extraction/model-note';
import type { CatalogEntry, ExtractedNote } from '@/lib/extraction/parse-note';
import { supabase } from '@/lib/supabase';

/**
 * Claude's reading of a note (the extract-note Edge Function). The note screens show the
 * on-device parse straight away and swap this in when it arrives; offline or on an error they
 * keep the on-device parse. Readings are cached by text, so the same text is read once.
 */
const key = (text: string, catalog: readonly CatalogEntry[]) =>
  ['note-reading', text.trim(), catalog.length] as const;

async function readNote(text: string, catalog: readonly CatalogEntry[]): Promise<ExtractedNote> {
  const { data, error } = await supabase.functions.invoke<{ exercises: ModelExercise[] }>(
    'extract-note',
    {
      body: {
        text,
        catalog: catalog.map((e) => ({
          id: e.id,
          name: e.name,
          aliases: e.aliases,
          equipment: e.equipment,
        })),
      },
    },
  );
  if (error) {
    // The on-device parse stays; say why in development.
    if (__DEV__) {
      const detail =
        'context' in error && error.context instanceof Response
          ? await error.context.text().catch(() => '')
          : '';
      console.warn('[note reading] failed:', error.message, detail);
    }
    throw error;
  }
  return fromModel(data?.exercises ?? [], catalog);
}

export function useNoteReading(text: string, catalog: readonly CatalogEntry[]) {
  return useQuery({
    queryKey: key(text, catalog),
    enabled: text.trim() !== '' && catalog.length > 0,
    queryFn: () => readNote(text, catalog),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

/** The reading for this text if it has already arrived, for saving with the note. */
export function cachedNoteReading(text: string, catalog: readonly CatalogEntry[]) {
  return queryClient.getQueryData<ExtractedNote>(key(text, catalog)) ?? null;
}
