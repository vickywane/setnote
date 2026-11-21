import { clockTime } from '@/lib/clock';
import type { WeightUnit } from '@/stores/preferences-store';

const dateOnly = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function formatDateTime(iso: string) {
  return `${dateOnly.format(new Date(iso))}, ${clockTime(new Date(iso))}`;
}

export function formatDate(iso: string) {
  return dateOnly.format(new Date(iso));
}

/** Time of day only. Screens other than the Notes home don't repeat the date. */
export function formatTime(iso: string) {
  return clockTime(new Date(iso));
}

export function formatDuration(startIso: string, endIso: string) {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatWeight(value: number | null, unit: WeightUnit) {
  if (value === null) return '–';
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

type SetLike = { weight: number | null; reps: number | null; unit: WeightUnit };

/**
 * Compact summary of sets: "32 kg × 10, 10, 8" when the weight is the same throughout,
 * otherwise "30 kg × 10 · 32 kg × 8".
 */
export function formatSets(sets: readonly SetLike[]) {
  if (sets.length === 0) return 'No sets';
  const reps = sets.map((set) => set.reps ?? '–');
  const first = sets[0];
  const sameWeight = sets.every((set) => set.weight === first.weight && set.unit === first.unit);
  if (sameWeight) {
    return first.weight === null
      ? `${reps.join(', ')} reps`
      : `${formatWeight(first.weight, first.unit)} × ${reps.join(', ')}`;
  }
  return sets
    .map((set) => `${formatWeight(set.weight, set.unit)} × ${set.reps ?? '–'}`)
    .join(' · ');
}

/** "1 set", "3 sets". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Parses a numeric text field; empty or invalid input becomes null. */
export function parseNumber(text: string) {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' || Number.isNaN(value) ? null : value;
}

/** "2,880": whole numbers with thousands separators, as numerals appear in the design. */
export function formatNumber(value: number) {
  return Math.round(value).toLocaleString('en-US');
}

/** Weight value without a unit: "32", "82.5". */
export function formatWeightValue(value: number | null) {
  if (value === null) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

const LB_TO_KG = 0.45359237;

/** Total weight moved (weight × reps) in `unit`, converting sets logged in the other unit. */
export function totalVolume(sets: readonly SetLike[], unit: WeightUnit = 'kg') {
  return sets.reduce((sum, set) => {
    if (set.weight === null || set.reps === null) return sum;
    let weight = set.weight;
    if (set.unit !== unit) weight = unit === 'kg' ? weight * LB_TO_KG : weight / LB_TO_KG;
    return sum + weight * set.reps;
  }, 0);
}

/** A length of time: "52 min", "1 h 5 min". */
export function formatMinutes(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
