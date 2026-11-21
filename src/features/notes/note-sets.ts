import type { ExtractedExercise, WeightUnit } from '@/lib/extraction/parse-note';

export type NoteSet = { weight: number | null; reps: number; unit: WeightUnit };

/**
 * The sets a note describes, one per rep count: "200kg 2 × 4" is two sets of 4 at 200 kg.
 * A note without rep counts describes no sets (a set needs at least its reps).
 */
export function setsFromNote(
  exercise: Pick<ExtractedExercise, 'weight' | 'reps'> | undefined,
  defaultUnit: WeightUnit,
): NoteSet[] {
  if (!exercise) return [];
  const unit = exercise.weight?.unit ?? defaultUnit;
  return exercise.reps
    .filter((reps) => Number.isFinite(reps) && reps > 0)
    .map((reps) => ({ weight: exercise.weight?.value ?? null, reps, unit }));
}

/**
 * The note's sets not logged yet. Sets are matched by order, so a note covering the whole
 * exercise only adds what's beyond the sets already there.
 */
export function setsToLog(found: NoteSet[], alreadyLogged: number): NoteSet[] {
  return found.slice(Math.max(0, alreadyLogged));
}

/** "2 × 4 at 200 kg", "8, 8, 6 at 80 kg", "3 × 12" or "200 kg × 5, 180 kg × 8". */
export function describeSets(sets: NoteSet[]): string {
  if (sets.length === 0) return '';
  const first = sets[0];
  const sameWeight = sets.every((s) => s.weight === first.weight && s.unit === first.unit);
  const sameReps = sets.every((s) => s.reps === first.reps);
  const reps = sameReps ? `${sets.length} × ${first.reps}` : sets.map((s) => s.reps).join(', ');
  if (sameWeight) return first.weight === null ? reps : `${reps} at ${first.weight} ${first.unit}`;
  return sets
    .map((s) => (s.weight === null ? `${s.reps} reps` : `${s.weight} ${s.unit} × ${s.reps}`))
    .join(', ');
}
