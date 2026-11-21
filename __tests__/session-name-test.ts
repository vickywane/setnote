import {
  isPlaceholderName,
  nameFromExercises,
  randomSessionName,
  SESSION_NAME_MAX_LENGTH,
} from '@/features/sessions/session-name';

describe('randomSessionName', () => {
  it('builds a two-word name from the lists', () => {
    expect(randomSessionName(() => 0)).toBe('Iron Grind');
    expect(randomSessionName(() => 0.999)).toBe('Mighty Summit');
  });

  it('fits the title column', () => {
    for (let i = 0; i < 50; i++) {
      const name = randomSessionName();
      expect(name).toMatch(/^\w+ \w+$/);
      expect(name.length).toBeLessThanOrEqual(SESSION_NAME_MAX_LENGTH);
    }
  });
});

describe('isPlaceholderName', () => {
  it('recognises the random names and nothing else', () => {
    expect(isPlaceholderName('Iron Grind')).toBe(true);
    expect(isPlaceholderName(null)).toBe(true);
    expect(isPlaceholderName('Iron Grind 2')).toBe(false);
    expect(isPlaceholderName('Leg day')).toBe(false);
  });
});

describe('nameFromExercises', () => {
  const ex = (muscleGroup: string | null, sets: number) => ({ muscleGroup, sets });

  it('names a single group as a day', () => {
    expect(nameFromExercises([ex('Legs', 6), ex('Legs', 3)])).toBe('Leg day');
    expect(nameFromExercises([ex('Chest', 4)])).toBe('Chest day');
  });

  it('pairs the two most-trained groups', () => {
    expect(nameFromExercises([ex('Back', 3), ex('Chest', 8)])).toBe('Chest & back');
  });

  it('summarises wider sessions', () => {
    expect(nameFromExercises([ex('Chest', 3), ex('Back', 3), ex('Arms', 2)])).toBe('Upper body');
    expect(nameFromExercises([ex('Legs', 3), ex('Back', 3), ex('Core', 2)])).toBe('Full body');
  });

  it('ignores exercises without sets when some have them', () => {
    expect(nameFromExercises([ex('Legs', 4), ex('Chest', 0)])).toBe('Leg day');
  });

  it('keeps the current name when there is nothing to go by', () => {
    expect(nameFromExercises([])).toBeNull();
    expect(nameFromExercises([ex(null, 3)])).toBeNull();
  });
});
