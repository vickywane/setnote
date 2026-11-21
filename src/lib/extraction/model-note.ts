import {
  type CatalogEntry,
  type Effort,
  type ExtractedNote,
  missingFields,
  type WeightUnit,
} from './parse-note';

/**
 * One exercise as the extract-note Edge Function returns it (Claude reading the note; see
 * supabase/functions/extract-note). `fromModel` turns these into the app's ExtractedNote.
 */
export type ModelExercise = {
  name: string;
  catalogId: string | null;
  sourceText: string;
  equipment: string | null;
  weight: { value: number; unit: WeightUnit } | null;
  sets: number | null;
  reps: number[];
  setChanges: string[];
  effort: Effort | null;
  goal: { text: string; targetReps: number | null } | null;
  bodyNotes: string[];
};

const EFFORTS: readonly Effort[] = ['low', 'medium', 'high'];

/**
 * Whether the note says something in words about this exercise, beyond its name and numbers
 * ("Bench 80kg 8, 8, 6" doesn't). Set changes and goals need words behind them: many people
 * only log numbers, and those notes shouldn't get a "Then" or "Goal" read into them.
 */
export function hasWords(sourceText: string, name: string) {
  const nameWords = new Set(name.toLowerCase().split(/\s+/));
  const words = sourceText
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)?/g, ' ')
    .split(/[^a-z']+/)
    .filter(
      (w) =>
        w.length > 1 &&
        !nameWords.has(w) &&
        !/^(kg|kgs|kilos?|lbs?|pounds?|x|reps?|sets?|rpe|db|bb)$/.test(w),
    );
  return words.length >= 2;
}

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const strings = (list: unknown) =>
  Array.isArray(list)
    ? list.filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    : [];

/**
 * The model's reading of a note as an ExtractedNote. Doesn't trust it blindly: catalog ids
 * must exist (a matched exercise takes its catalog name), equipment must be one the catalog
 * knows, numbers must be sensible, and what's missing is worked out the same way as for the
 * on-device parse.
 */
export function fromModel(
  exercises: ModelExercise[],
  catalog: readonly CatalogEntry[],
): ExtractedNote {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const knownEquipment = new Set(catalog.flatMap((e) => e.equipment));
  knownEquipment.add('bodyweight');
  knownEquipment.add('other');

  return {
    version: 1,
    source: 'model',
    exercises: exercises
      .filter((e) => typeof e?.name === 'string' && e.name.trim() !== '')
      .map((e) => {
        const entry = e.catalogId ? byId.get(e.catalogId) : undefined;
        const equipment = e.equipment && knownEquipment.has(e.equipment) ? e.equipment : null;
        const weight =
          e.weight && positive(e.weight.value) && (e.weight.unit === 'kg' || e.weight.unit === 'lb')
            ? { value: e.weight.value, unit: e.weight.unit }
            : null;
        const reps = (Array.isArray(e.reps) ? e.reps : []).filter(
          (r) => positive(r) && Number.isInteger(r) && r <= 500,
        );
        const sets = positive(e.sets) && Number.isInteger(e.sets) ? e.sets : reps.length || null;
        const sourceText = typeof e.sourceText === 'string' ? e.sourceText : '';
        const worded = hasWords(sourceText, `${e.name} ${entry?.name ?? ''}`);
        const exercise = {
          name: entry?.name ?? e.name.trim(),
          exerciseId: entry?.id ?? null,
          sourceText,
          equipment,
          weight,
          sets,
          reps,
          setChanges: worded ? strings(e.setChanges) : [],
          effort: e.effort && EFFORTS.includes(e.effort) ? e.effort : null,
          goal:
            worded && e.goal && typeof e.goal.text === 'string' && e.goal.text.trim() !== ''
              ? {
                  text: e.goal.text.trim(),
                  targetReps: positive(e.goal.targetReps) ? e.goal.targetReps : null,
                }
              : null,
          bodyNotes: strings(e.bodyNotes),
        };
        return { ...exercise, missing: missingFields(exercise) };
      }),
  };
}
