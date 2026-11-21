import { type CatalogEntry, matchExercise } from '@/lib/extraction/parse-note';

export type Segment = {
  text: string;
  picked: boolean;
  /** Words still being heard while recording, shown lighter until they're confirmed. */
  pending?: boolean;
};

const NUMBER_WORDS =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|a hundred|hundred)';
const NUM = `(?:\\d+(?:[.,]\\d+)?|${NUMBER_WORDS}(?:[ -]${NUMBER_WORDS})*)`;

/** Values the parser reads: weights, set × rep shorthand, "3 sets", "5 reps", "x12". */
const VALUE_PATTERNS = [
  new RegExp(`\\b${NUM}\\s*(?:kg|kgs|kilos?|lbs?|pounds?)\\b`, 'gi'),
  new RegExp(`\\b\\d+\\s*[x×]\\s*\\d+\\b`, 'gi'),
  new RegExp(`\\b${NUM}\\s*sets?(?:\\s+of\\s+${NUM})?\\b`, 'gi'),
  new RegExp(`\\b${NUM}\\s*reps?\\b`, 'gi'),
  /(?:^|\s)[x×]\s*\d+\b/gi,
];

type Range = [number, number];

function addRange(ranges: Range[], start: number, end: number) {
  if (end <= start) return;
  if (ranges.some(([s, e]) => start < e && end > s)) return;
  ranges.push([start, end]);
}

/**
 * Splits a note into plain and "picked up" segments, so what the parser understood gets the
 * dotted vermilion underline in place (Figma "Note / Writing"): exercise names, weights,
 * sets and reps. Bare numbers count as reps on a line that has an exercise or a weight.
 */
export function highlightNote(body: string, catalog: readonly CatalogEntry[]): Segment[] {
  const ranges: Range[] = [];
  let offset = 0;
  for (const line of body.split('\n')) {
    const exercise = matchExercise(line, catalog);
    if (exercise) {
      addRange(ranges, offset + exercise.index, offset + exercise.index + exercise.length);
    }
    let lineHasWeight = false;
    for (const pattern of VALUE_PATTERNS) {
      pattern.lastIndex = 0;
      for (const m of line.matchAll(pattern)) {
        const lead = m[0].length - m[0].trimStart().length;
        const start = offset + (m.index ?? 0) + lead;
        addRange(ranges, start, offset + (m.index ?? 0) + m[0].length);
        if (pattern === VALUE_PATTERNS[0]) lineHasWeight = true;
      }
    }
    if (exercise || lineHasWeight) {
      for (const m of line.matchAll(/\b\d+\b/g)) {
        const start = offset + (m.index ?? 0);
        addRange(ranges, start, start + m[0].length);
      }
    }
    offset += line.length + 1;
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) segments.push({ text: body.slice(cursor, start), picked: false });
    segments.push({ text: body.slice(start, end), picked: true });
    cursor = end;
  }
  if (cursor < body.length) segments.push({ text: body.slice(cursor), picked: false });
  return segments;
}
