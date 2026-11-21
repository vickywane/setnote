/**
 * Rule-based extraction of workout data from free-text gym notes (VIC-62).
 *
 * Runs on the device, so it works offline and costs nothing per note. It handles the
 * common shapes of gym shorthand ("Bench 80kg 8, 8, 6", "squat 3x5 100kg", "DB curl
 * 12kg x10") plus narrative notes such as the arm curl example in VIC-53. Anything it
 * can't find is listed in `missing` so the UI can ask, rather than guessing silently.
 *
 * A model-based extractor can replace or back this up later (VIC-53, open question 6).
 */

export type CatalogEntry = {
  id: string;
  name: string;
  aliases: readonly string[];
  equipment: readonly string[];
};

export type WeightUnit = 'kg' | 'lb';
export type Effort = 'low' | 'medium' | 'high';
export type MissingField = 'exercise' | 'equipment' | 'weight' | 'reps';

export type ExtractedExercise = {
  /** Catalog name when matched, otherwise the text the user wrote. */
  name: string;
  exerciseId: string | null;
  /** The note line(s) this entry was read from. */
  sourceText: string;
  equipment: string | null;
  weight: { value: number; unit: WeightUnit } | null;
  sets: number | null;
  /** Reps per set, in order, when known. */
  reps: number[];
  setChanges: string[];
  effort: Effort | null;
  goal: { text: string; targetReps: number | null } | null;
  bodyNotes: string[];
  missing: MissingField[];
};

export type ExtractedNote = {
  version: 1;
  exercises: ExtractedExercise[];
  /** Who read it: these rules on the phone, or Claude (src/lib/extraction/model-note.ts). */
  source?: 'rules' | 'model';
};

/** What to ask about: the same rules for the on-device parse and the model's. */
export function missingFields(
  exercise: Pick<ExtractedExercise, 'exerciseId' | 'equipment' | 'weight' | 'reps'>,
): MissingField[] {
  const missing: MissingField[] = [];
  if (!exercise.exerciseId) missing.push('exercise');
  if (!exercise.equipment) missing.push('equipment');
  if (!exercise.weight && exercise.equipment !== 'bodyweight') missing.push('weight');
  if (exercise.reps.length === 0) missing.push('reps');
  return missing;
}

const UNIT_PATTERN = '(kg|kgs|kilos?|lbs?|pounds?)';

const EQUIPMENT_WORDS: [RegExp, string][] = [
  [/\b(db|dbs|dumbbells?)\b/, 'dumbbell'],
  [/\b(bb|barbell)\b/, 'barbell'],
  [/\bsmith\b/, 'smith_machine'],
  [/\bcables?\b/, 'cable'],
  [/\bmachine\b/, 'machine'],
  [/\b(kb|kettlebells?)\b/, 'kettlebell'],
  [/\bbands?\b/, 'band'],
  [/\b(bodyweight|bw)\b/, 'bodyweight'],
];

const GOAL_PATTERN =
  /\b(should be able to|goal|aim|target|next time|want to|try to|drive it|improve)\b/;
const BODY_PATTERN =
  /\b(tight|tightness|pain|painful|sore|hurts?|injur\w*|tweak\w*|strain\w*|ache|aching)\b/;
const HIGH_EFFORT = /\b(struggl\w*|hard|tough|brutal|grind\w*|exhausted|killed me)\b/;
const LOW_EFFORT = /\b(easy|light|smooth|comfortable|too light)\b/;
const MEDIUM_EFFORT = /\b(ok|okay|moderate|decent|solid)\b/;

const SET_CHANGE_RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [
    /\b(?:break|broke|broken|split)\s+(?:it\s+)?(?:into|in)\s+(\d+)\s*reps?(?:\s+(?:per|a|each)\s+(?:go|time|round))?/,
    (m) => `Clusters of ${m[1]} reps`,
  ],
  [/\bclusters?\s+of\s+(\d+)(?:\s*reps?)?/, (m) => `Clusters of ${m[1]} reps`],
  [/\brest[\s-]?pause\b/, () => 'Rest-pause'],
  [/\bdrop\s*sets?\b/, () => 'Drop set'],
  [/\b(?:failed|missed)\s+(?:the\s+)?(?:last\s+)?(\d+)?\s*reps?\b/, () => 'Failed reps'],
];

/** Splits text into sentences on full stops, ellipses, semicolons and line breaks. */
function sentences(text: string) {
  return text
    .split(/(?:\.{2,}|…|[.;!?]\s|\n)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type CatalogMatch = { entry: CatalogEntry; index: number; length: number };

/** Finds the catalog exercise mentioned in a line, preferring the longest match. */
export function matchExercise(line: string, catalog: readonly CatalogEntry[]): CatalogMatch | null {
  const text = line.toLowerCase();
  let best: CatalogMatch | null = null;
  for (const entry of catalog) {
    for (const term of [entry.name.toLowerCase(), ...entry.aliases]) {
      if (!term) continue;
      const match = new RegExp(`(^|[^a-z])${escapeRegExp(term)}s?(?![a-z])`).exec(text);
      if (match) {
        const index = match.index + match[1].length;
        if (!best || term.length > best.length) {
          best = { entry, index, length: term.length };
        }
      }
    }
  }
  return best;
}

/** A line like "Incline walk - 10 min" names an exercise we don't know. */
function unknownExerciseName(line: string) {
  const match = /^\s*([a-z][a-z' ]{2,40}?)\s*(?:[-:–]|\d)/i.exec(line);
  return match ? match[1].trim() : null;
}

function normalizeUnit(raw: string): WeightUnit {
  return raw.toLowerCase().startsWith('k') ? 'kg' : 'lb';
}

type Block = { name: string; exerciseId: string | null; lines: string[]; catalog?: CatalogEntry };

function splitIntoBlocks(text: string, catalog: readonly CatalogEntry[]): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = matchExercise(line, catalog);
    const hasNumbers = /\d/.test(line);
    if (match) {
      blocks.push({
        name: match.entry.name,
        exerciseId: match.entry.id,
        lines: [line],
        catalog: match.entry,
      });
      continue;
    }
    const unknown = hasNumbers ? unknownExerciseName(line) : null;
    const isNarrative = blocks.length > 0 && !hasNumbers;
    if (unknown && !isNarrative && !GOAL_PATTERN.test(line.toLowerCase())) {
      blocks.push({ name: unknown, exerciseId: null, lines: [line] });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].lines.push(line);
    } else {
      blocks.push({ name: 'Unknown exercise', exerciseId: null, lines: [line] });
    }
  }
  return blocks;
}

function extractBlock(block: Block): ExtractedExercise {
  const sourceText = block.lines.join('\n');
  const original = sourceText.toLowerCase().replace(/…/g, '... ');
  let text = original;

  // Remove the exercise name so its words aren't read as data ("21s", "5/3/1"...).
  if (block.catalog) {
    const match = matchExercise(text, [block.catalog]);
    if (match) text = text.slice(0, match.index) + ' ' + text.slice(match.index + match.length);
  }

  const goalSentences: string[] = [];
  const bodyNotes: string[] = [];
  const dataSentences: string[] = [];
  for (const sentence of sentences(text)) {
    if (GOAL_PATTERN.test(sentence)) goalSentences.push(sentence);
    else dataSentences.push(sentence);
    if (BODY_PATTERN.test(sentence)) bodyNotes.push(sentence);
  }
  let data = dataSentences.join('\n');

  const setChanges: string[] = [];
  for (const [pattern, describe] of SET_CHANGE_RULES) {
    const match = data.match(pattern);
    if (match) {
      const label = describe(match);
      if (!setChanges.includes(label)) setChanges.push(label);
      data = data.replace(pattern, ' ');
    }
  }

  let equipment: string | null = null;
  // Use the original text: shorthand like "DB curl" names the equipment in the alias.
  for (const [pattern, value] of EQUIPMENT_WORDS) {
    if (pattern.test(original)) {
      equipment = value;
      break;
    }
  }

  let weight: ExtractedExercise['weight'] = null;
  const weightMatch = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${UNIT_PATTERN}\\b`).exec(data);
  if (weightMatch) {
    weight = {
      value: Number(weightMatch[1].replace(',', '.')),
      unit: normalizeUnit(weightMatch[2]),
    };
    data = data.replace(weightMatch[0], ' ');
  }

  let sets: number | null = null;
  let reps: number[] = [];

  const setsByReps = /\b(\d{1,2})\s*[x×]\s*(\d{1,3})\b/.exec(data);
  if (setsByReps) {
    sets = Number(setsByReps[1]);
    reps = Array(sets).fill(Number(setsByReps[2]));
    data = data.replace(setsByReps[0], ' ');
  }

  const setsCount = /\b(\d{1,2})\s*sets?\b/.exec(data);
  if (setsCount) {
    sets = sets ?? Number(setsCount[1]);
    data = data.replace(setsCount[0], ' ');
  }

  const effortMatch = /\brpe\s*(\d+(?:\.\d)?)/.exec(data);
  let effort: Effort | null = null;
  if (effortMatch) {
    const rpe = Number(effortMatch[1]);
    effort = rpe >= 8 ? 'high' : rpe >= 6 ? 'medium' : 'low';
    data = data.replace(effortMatch[0], ' ');
  } else if (HIGH_EFFORT.test(text)) {
    effort = 'high';
  } else if (LOW_EFFORT.test(text)) {
    effort = 'low';
  } else if (MEDIUM_EFFORT.test(text)) {
    effort = 'medium';
  }

  if (reps.length === 0) {
    // "x10", "10 reps", or bare numbers after the weight ("80kg 8, 8, 6", "32kg... 10").
    const found: number[] = [];
    for (const match of data.matchAll(
      /(?:[x×]\s*(\d{1,3})\b|\b(\d{1,3})\s*reps?\b|\b(\d{1,3})\b)/g,
    )) {
      const value = Number(match[1] ?? match[2] ?? match[3]);
      if (value > 0 && value <= 100) found.push(value);
    }
    if (found.length === 1 && sets && sets > 1) {
      reps = Array(sets).fill(found[0]);
    } else {
      reps = found;
    }
  }
  if (sets === null && reps.length > 0) sets = reps.length;

  let goal: ExtractedExercise['goal'] = null;
  if (goalSentences.length > 0) {
    const goalText = goalSentences.join('. ');
    const target = /(\d{1,3})\s*reps?\s*(?:per|a|each)\s*set/.exec(goalText);
    goal = { text: goalText, targetReps: target ? Number(target[1]) : null };
  }

  const missing = missingFields({ exerciseId: block.exerciseId, equipment, weight, reps });

  return {
    name: block.name,
    exerciseId: block.exerciseId,
    sourceText,
    equipment,
    weight,
    sets,
    reps,
    setChanges,
    effort,
    goal,
    bodyNotes,
    missing,
  };
}

export function parseNote(text: string, catalog: readonly CatalogEntry[]): ExtractedNote {
  return {
    version: 1,
    exercises: splitIntoBlocks(text, catalog).map(extractBlock),
    source: 'rules',
  };
}
