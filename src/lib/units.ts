import type { WeightUnit as Unit } from '@/stores/preferences-store';

const KG_PER_LB = 1 / 2.2046226218;
export function convertWeight(weight: number, from: Unit, to: Unit): number {
  if (!Number.isFinite(weight) || weight < 0)
    throw new RangeError('Weight must be a finite, non-negative number.');
  if (from === to) return weight;
  const converted = from === 'kg' ? weight / KG_PER_LB : weight * KG_PER_LB;
  return Math.round(converted * 10) / 10;
}
