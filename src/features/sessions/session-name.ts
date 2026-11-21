/**
 * Names for sessions, so each one is easy to tell apart in History. A new session gets a
 * random placeholder ("Steady Climb"); when it's finished, `nameFromExercises` names it from
 * what was logged ("Leg day", "Chest & back") unless the user renamed it.
 */
const ADJECTIVES = [
  'Iron',
  'Steady',
  'Early',
  'Heavy',
  'Quick',
  'Strong',
  'Focused',
  'Bold',
  'Solid',
  'Fresh',
  'Gritty',
  'Calm',
  'Electric',
  'Golden',
  'Rising',
  'Mighty',
] as const;

const NOUNS = [
  'Grind',
  'Push',
  'Pump',
  'Lift',
  'Session',
  'Burner',
  'Builder',
  'Climb',
  'Circuit',
  'Charge',
  'Rally',
  'Forge',
  'Sprint',
  'Hustle',
  'Engine',
  'Summit',
] as const;

/** Upper bound of `workout_sessions.title` in the database. */
export const SESSION_NAME_MAX_LENGTH = 100;

/** A random two-word name, e.g. "Steady Climb". `random` is injectable for tests. */
export function randomSessionName(random: () => number = Math.random) {
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

/** Whether `title` is one of the random placeholders, i.e. the user hasn't renamed it. */
export function isPlaceholderName(title: string | null | undefined) {
  if (!title) return true;
  const [adjective, noun, ...rest] = title.trim().split(' ');
  return (
    rest.length === 0 &&
    (ADJECTIVES as readonly string[]).includes(adjective) &&
    (NOUNS as readonly string[]).includes(noun ?? '')
  );
}

const UPPER_BODY = new Set(['chest', 'back', 'shoulders', 'arms']);
const DAY_NAMES: Record<string, string> = { legs: 'Leg day', arms: 'Arm day', core: 'Core day' };

type LoggedExercise = { muscleGroup: string | null; sets: number };

/**
 * A name from the muscle groups trained, weighted by sets: "Leg day", "Chest & back",
 * "Upper body", "Full body". Null when there's nothing to go by (keep the current name).
 */
export function nameFromExercises(exercises: readonly LoggedExercise[]): string | null {
  const counted = exercises.some((e) => e.sets > 0)
    ? exercises.filter((e) => e.sets > 0)
    : exercises;
  const sets = new Map<string, number>();
  for (const e of counted) {
    const group = e.muscleGroup?.trim().toLowerCase();
    if (!group) continue;
    sets.set(group, (sets.get(group) ?? 0) + Math.max(e.sets, 1));
  }
  const groups = [...sets.entries()].sort((a, b) => b[1] - a[1]).map(([group]) => group);
  if (groups.length === 0) return null;
  if (groups.includes('full body')) return 'Full body';
  if (groups.length === 1) {
    const [group] = groups;
    return DAY_NAMES[group] ?? `${capitalize(group)} day`;
  }
  if (groups.length === 2) return `${capitalize(groups[0])} & ${groups[1]}`;
  if (groups.every((g) => UPPER_BODY.has(g))) return 'Upper body';
  if (groups.includes('legs') && groups.some((g) => UPPER_BODY.has(g))) return 'Full body';
  return `${capitalize(groups[0])} & ${groups[1]}`;
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
