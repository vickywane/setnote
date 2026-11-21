import { startOfDay } from '@/features/home/format';
import { formatWeightValue } from '@/lib/format';
import type { WeightUnit } from '@/stores/preferences-store';

type SetLike = { weight: number | null; reps: number | null; unit: WeightUnit };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const daysBetween = (date: Date, now: Date) =>
  Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

/** One set on a chip: "32 × 10"; a set without a weight shows its reps: "10 reps". */
export function setLabel(set: SetLike) {
  if (set.weight === null) return set.reps === null ? '–' : `${set.reps} reps`;
  return `${formatWeightValue(set.weight)} × ${set.reps ?? '–'}`;
}

/** "32 × 10, 10, 8" when the weight holds; otherwise "80 × 8, 82.5 × 6". */
export function formatSetList(sets: readonly SetLike[]) {
  if (sets.length === 0) return '';
  const first = sets[0];
  const sameWeight = sets.every((s) => s.weight === first.weight);
  if (sameWeight && first.weight !== null) {
    return `${formatWeightValue(first.weight)} × ${sets.map((s) => s.reps ?? '–').join(', ')}`;
  }
  return sets.map(setLabel).join(', ');
}

/** "last Mon" within the past week, otherwise "12 Oct". */
export function lastDayLabel(iso: string, now: Date) {
  const date = new Date(iso);
  const days = daysBetween(date, now);
  if (days === 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `last ${WEEKDAYS[date.getDay()]}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "today", "yesterday", "4 days ago", "last week", "3 weeks ago". */
export function relativeDays(iso: string, now: Date) {
  const days = daysBetween(new Date(iso), now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** Line under an exercise: "Dumbbell · last Mon: 32 × 10, 10, 8" or "Cable · first time logging this". */
export function exerciseBlockMeta(
  equipment: string | null,
  last: { startedAt: string; sets: SetLike[] } | null | undefined,
  now: Date,
) {
  const history = last
    ? `${lastDayLabel(last.startedAt, now)}: ${formatSetList(last.sets)}`
    : 'first time logging this';
  return equipment
    ? `${equipment} · ${history}`
    : history.charAt(0).toUpperCase() + history.slice(1);
}

/** Heaviest weight in `sets` in the given unit, or null. */
export function heaviest(sets: readonly SetLike[], unit: WeightUnit) {
  const weights = sets.filter((s) => s.unit === unit && s.weight !== null).map((s) => s.weight!);
  return weights.length ? Math.max(...weights) : null;
}

/** A set is a personal best when it's heavier than anything in the previous session. */
export function isPersonalBest(set: SetLike, previous: readonly SetLike[] | undefined) {
  if (set.weight === null || !previous || previous.length === 0) return false;
  const best = heaviest(previous, set.unit);
  return best !== null && set.weight > best;
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
export const ordinal = (index: number) => ORDINALS[index] ?? `${index + 1}th`;

/**
 * The prompt at the top of the Log set sheet, e.g. "Last time you did 32 × 8 on your third
 * set. Same again, or push for 10?"
 */
export function logSetHint(
  index: number,
  lastSets: readonly SetLike[] | undefined,
  previousSet: SetLike | undefined,
) {
  const last = lastSets?.[index];
  if (last && last.reps !== null) {
    return `Last time you did ${setLabel(last)} on your ${ordinal(index)} set. Same again, or push for ${last.reps + 2}?`;
  }
  if (previousSet) return `Your last set was ${setLabel(previousSet)}. Same again?`;
  return 'First time logging this. Start light and build up.';
}
