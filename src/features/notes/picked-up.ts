import { EQUIPMENT_LABELS, type Equipment } from '@/features/catalog/api';
import { EFFORT_LABELS } from '@/features/notes/details';
import type { CatalogEntry, ExtractedExercise } from '@/lib/extraction/parse-note';
import { formatWeightValue } from '@/lib/format';

export type PickedTag = { text: string; tone: 'neutral' | 'warning' };

/** The value tags under an exercise in "Picked up": 32 kg · 3 × 10 · Hard · Dumbbell. */
export function pickedTags(exercise: ExtractedExercise): PickedTag[] {
  const tags: PickedTag[] = [];
  if (exercise.weight) {
    tags.push({
      text: `${formatWeightValue(exercise.weight.value)} ${exercise.weight.unit}`,
      tone: 'neutral',
    });
  }
  const reps = exercise.reps;
  if (reps.length > 0) {
    const same = reps.every((r) => r === reps[0]);
    tags.push({ text: same ? `${reps.length} × ${reps[0]}` : reps.join(', '), tone: 'neutral' });
  } else if (exercise.sets) {
    tags.push({ text: `${exercise.sets} sets`, tone: 'neutral' });
  }
  if (exercise.effort) tags.push({ text: EFFORT_LABELS[exercise.effort], tone: 'neutral' });
  if (exercise.equipment) {
    tags.push({
      text: EQUIPMENT_LABELS[exercise.equipment as Equipment] ?? exercise.equipment,
      tone: 'neutral',
    });
  }
  if (exercise.missing.includes('exercise')) tags.push({ text: 'New exercise?', tone: 'warning' });
  return tags;
}

/** "Then" and "Goal" lines under the tags. */
export function pickedDetails(exercise: ExtractedExercise) {
  const rows: { label: string; text: string }[] = [];
  if (exercise.setChanges.length > 0)
    rows.push({ label: 'Then', text: exercise.setChanges.join('. ') });
  if (exercise.goal) {
    const at = exercise.weight
      ? ` at ${formatWeightValue(exercise.weight.value)} ${exercise.weight.unit}`
      : '';
    rows.push({
      label: 'Goal',
      text: exercise.goal.targetReps
        ? `${exercise.goal.targetReps} reps a set${at}`
        : exercise.goal.text,
    });
  }
  if (exercise.bodyNotes.length > 0)
    rows.push({ label: 'Body', text: exercise.bodyNotes.join('. ') });
  return rows;
}

export type QuestionKind = 'new-exercise' | 'equipment' | 'clusters';
export type Question = {
  kind: QuestionKind;
  text: string;
  options: { label: string; value: string }[];
};

/**
 * What still needs the user, asked in place (Figma "Question"): an exercise that isn't in the
 * list yet, equipment that wasn't stated, how many clusters after a rep drop.
 */
export function pickedQuestion(
  exercise: ExtractedExercise,
  catalog: readonly CatalogEntry[],
): Question | null {
  if (exercise.missing.includes('exercise')) {
    return {
      kind: 'new-exercise',
      text: `${exercise.name} isn’t in your exercises yet. Add it so it’s tracked next time?`,
      options: [
        { label: `Add ${exercise.name}`, value: 'add' },
        { label: 'Pick an exercise', value: 'pick' },
      ],
    };
  }
  const entry = catalog.find((c) => c.id === exercise.exerciseId);
  if (!exercise.equipment && entry && entry.equipment.length > 1) {
    return {
      kind: 'equipment',
      text: `Which equipment did you use for ${exercise.name.toLowerCase()}?`,
      options: [
        ...entry.equipment.slice(0, 2).map((e) => ({
          label: EQUIPMENT_LABELS[e as Equipment] ?? e,
          value: e,
        })),
        { label: 'Not sure', value: 'unknown' },
      ],
    };
  }
  const cluster = exercise.setChanges.find((c) => c.startsWith('Clusters of'));
  if (cluster && !exercise.setChanges.some((c) => /^\d+ clusters/.test(c))) {
    const size = /\d+/.exec(cluster)?.[0];
    return {
      kind: 'clusters',
      text: `You broke into ${size}-rep clusters. How many clusters did you do?`,
      options: [
        { label: '2 clusters', value: '2' },
        { label: '3 clusters', value: '3' },
        { label: 'Not sure', value: 'unknown' },
      ],
    };
  }
  return null;
}

/** Applies an answer to the extracted exercise (equipment and cluster count). */
export function applyAnswer(
  exercise: ExtractedExercise,
  kind: QuestionKind,
  value: string,
): ExtractedExercise {
  if (kind === 'equipment') {
    return {
      ...exercise,
      equipment: value === 'unknown' ? exercise.equipment : value,
      missing: exercise.missing.filter((m) => m !== 'equipment'),
    };
  }
  if (kind === 'clusters') {
    const change = value === 'unknown' ? 'Clusters, count not recorded' : `${value} clusters`;
    return { ...exercise, setChanges: [...exercise.setChanges, change] };
  }
  return exercise;
}
