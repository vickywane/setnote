import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient, unwrap } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Exercise = Tables<'exercises'>;
export type Equipment = Exercise['equipment'][number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  kettlebell: 'Kettlebell',
  band: 'Band',
  bodyweight: 'Bodyweight',
  smith_machine: 'Smith machine',
  other: 'Other',
};

const exercisesKey = ['exercises'] as const;

/** Built-in catalog plus the user's own exercises (RLS returns both). */
export function useExercises() {
  return useQuery({
    queryKey: exercisesKey,
    queryFn: async () =>
      unwrap(await supabase.from('exercises').select('*').order('name')) as Exercise[],
    // The catalog rarely changes.
    staleTime: 10 * 60_000,
  });
}

/** Case-insensitive match on the name or any alias. */
export function searchExercises(exercises: readonly Exercise[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return exercises;
  return exercises.filter(
    (exercise) =>
      exercise.name.toLowerCase().includes(q) ||
      exercise.aliases.some((alias) => alias.includes(q)),
  );
}

export function useCreateExercise() {
  return useMutation({
    mutationFn: async (input: { name: string; userId: string }) =>
      unwrap(
        await supabase
          .from('exercises')
          .insert({ name: input.name.trim(), user_id: input.userId, equipment: ['other'] })
          .select()
          .single(),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exercisesKey }),
  });
}
