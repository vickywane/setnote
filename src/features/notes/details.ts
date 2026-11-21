import { EQUIPMENT_LABELS, type Equipment } from '@/features/catalog/api';
import type { Effort, ExtractedExercise } from '@/lib/extraction/parse-note';
import { formatWeight, plural } from '@/lib/format';

/** Consecutive sets with the same reps, e.g. 10, 10, 10, 5, 5 → "Sets 1–3 · 3 × 10" and "Sets 4–5 · 2 × 5". */
export type SetGroup = {
  /** "Set 3" or "Sets 1–3". */
  range: string;
  /** "3 × 10". */
  value: string;
  /** Fewer reps than the first group: the lifter dropped off. */
  dropped: boolean;
};

export function groupSets(reps: number[]): SetGroup[] {
  const groups: { start: number; end: number; reps: number }[] = [];
  reps.forEach((r, index) => {
    const last = groups.at(-1);
    if (last && last.reps === r) last.end = index;
    else groups.push({ start: index, end: index, reps: r });
  });
  const firstReps = groups[0]?.reps ?? 0;
  return groups.map((g) => {
    const count = g.end - g.start + 1;
    return {
      range: count === 1 ? `Set ${g.start + 1}` : `Sets ${g.start + 1}–${g.end + 1}`,
      value: `${count} × ${g.reps}`,
      dropped: g.reps < firstReps,
    };
  });
}

export const EFFORT_LABELS: Record<Effort, string> = {
  low: 'Easy',
  medium: 'Moderate',
  high: 'Hard',
};

/** Line under the exercise name: equipment, or what still needs the user's attention. */
export function exerciseMeta(exercise: ExtractedExercise): { text: string; warning: boolean } {
  if (exercise.missing.includes('exercise')) {
    return { text: 'Not in your exercise list yet', warning: true };
  }
  if (!exercise.equipment) return { text: 'Equipment not stated', warning: true };
  return { text: EQUIPMENT_LABELS[exercise.equipment as Equipment], warning: false };
}

export function setCount(exercise: ExtractedExercise) {
  const count = exercise.reps.length || exercise.sets || 0;
  return count === 0 ? 'No sets found' : `${plural(count, 'set')} found`;
}

/** "From your note": set changes and the goal, in one sentence each. */
export function noteTips(exercise: ExtractedExercise) {
  const lines = exercise.setChanges.map((change) => `${change}.`);
  if (exercise.goal) {
    if (exercise.goal.targetReps) {
      const at = exercise.weight
        ? ` at ${formatWeight(exercise.weight.value, exercise.weight.unit)}`
        : '';
      lines.push(`Next time: ${exercise.goal.targetReps} reps per set${at}.`);
    } else {
      lines.push(`Goal: ${exercise.goal.text}.`);
    }
  }
  return lines.join(' ');
}
