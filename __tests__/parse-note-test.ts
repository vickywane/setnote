import { type CatalogEntry, matchExercise, parseNote } from '@/lib/extraction/parse-note';

// A slice of the built-in catalog (supabase/migrations/*_seed_exercise_catalog.sql).
const CATALOG: CatalogEntry[] = [
  {
    id: 'curl',
    name: 'Bicep curl',
    equipment: ['dumbbell', 'barbell', 'cable'],
    aliases: ['curl', 'curls', 'arm curl', 'arm curls', 'bicep curls', 'db curl', 'cable curl'],
  },
  {
    id: 'hammer',
    name: 'Hammer curl',
    equipment: ['dumbbell'],
    aliases: ['hammer curls', 'hammers'],
  },
  {
    id: 'bench',
    name: 'Bench press',
    equipment: ['barbell', 'dumbbell'],
    aliases: ['bench', 'flat bench', 'bb bench'],
  },
  { id: 'squat', name: 'Squat', equipment: ['barbell'], aliases: ['back squat', 'squats'] },
  {
    id: 'rdl',
    name: 'Romanian deadlift',
    equipment: ['barbell', 'dumbbell'],
    aliases: ['rdl', 'rdls'],
  },
  {
    id: 'pulldown',
    name: 'Lat pulldown',
    equipment: ['cable', 'machine'],
    aliases: ['pulldown', 'lat pull down'],
  },
  { id: 'pullup', name: 'Pull-up', equipment: ['bodyweight'], aliases: ['pullup', 'pull up'] },
];

describe('matchExercise', () => {
  it.each([
    ['Arm Curl - 32kg', 'Bicep curl'],
    ['DB curl 12kg x10', 'Bicep curl'],
    ['hammer curls 14kg', 'Hammer curl'],
    ['RDL 100kg 3x8', 'Romanian deadlift'],
    ['flat bench 80kg', 'Bench press'],
    ['pull ups bw 3x8', 'Pull-up'],
  ])('matches "%s" to %s', (line, expected) => {
    expect(matchExercise(line, CATALOG)?.entry.name).toBe(expected);
  });

  it('prefers the longest alias', () => {
    // "curl" is an alias of Bicep curl, but "hammer curls" is a better match.
    expect(matchExercise('Hammer curls', CATALOG)?.entry.id).toBe('hammer');
  });

  it('does not match inside other words', () => {
    expect(matchExercise('benchmark day', CATALOG)).toBeNull();
  });
});

describe('parseNote', () => {
  it('extracts the arm curl example from VIC-53', () => {
    const note =
      'Arm Curl - 32kg… 10\n' +
      'Struggled with it from the start… after 3 sets, had to break into 5 reps per go… ' +
      'should be able to improve and drive it 10reps per set…';

    const { exercises } = parseNote(note, CATALOG);

    expect(exercises).toHaveLength(1);
    const [curl] = exercises;
    expect(curl.name).toBe('Bicep curl');
    expect(curl.exerciseId).toBe('curl');
    expect(curl.weight).toEqual({ value: 32, unit: 'kg' });
    expect(curl.sets).toBe(3);
    expect(curl.reps).toEqual([10, 10, 10]);
    expect(curl.setChanges).toEqual(['Clusters of 5 reps']);
    expect(curl.effort).toBe('high');
    expect(curl.goal?.targetReps).toBe(10);
    // Equipment isn't stated, so it's flagged rather than guessed.
    expect(curl.equipment).toBeNull();
    expect(curl.missing).toEqual(['equipment']);
  });

  it('reads sets x reps and weight in either order', () => {
    const [squat] = parseNote('squat 3x5 100kg', CATALOG).exercises;
    expect(squat).toMatchObject({ name: 'Squat', sets: 3, reps: [5, 5, 5] });
    expect(squat.weight).toEqual({ value: 100, unit: 'kg' });
  });

  it('reads uneven reps per set', () => {
    const [bench] = parseNote('Bench 80kg 8, 8, 6', CATALOG).exercises;
    expect(bench).toMatchObject({ sets: 3, reps: [8, 8, 6] });
  });

  it('reads equipment and pounds', () => {
    const [curl] = parseNote('DB curl 25 lbs x12', CATALOG).exercises;
    expect(curl.equipment).toBe('dumbbell');
    expect(curl.weight).toEqual({ value: 25, unit: 'lb' });
    expect(curl.reps).toEqual([12]);
  });

  it('handles several exercises in one note', () => {
    const note = 'Bench 80kg 3x8\nRDL 100kg 3x10 rpe 9\nLat pulldown 60kg x12, felt easy';
    const names = parseNote(note, CATALOG).exercises.map((e) => [e.name, e.effort]);
    expect(names).toEqual([
      ['Bench press', null],
      ['Romanian deadlift', 'high'],
      ['Lat pulldown', 'low'],
    ]);
  });

  it('keeps body notes and does not need weight for bodyweight work', () => {
    const [pullup] = parseNote('Pull ups bw 3x8. Left shoulder tight', CATALOG).exercises;
    expect(pullup.bodyNotes).toEqual(['left shoulder tight']);
    expect(pullup.missing).toEqual([]);
  });

  it('keeps unknown exercises and flags them', () => {
    const [unknown] = parseNote('Incline walk - 10 min', CATALOG).exercises;
    expect(unknown.name).toBe('Incline walk');
    expect(unknown.exerciseId).toBeNull();
    expect(unknown.missing).toContain('exercise');
  });

  it('returns nothing for an empty note', () => {
    expect(parseNote('  \n ', CATALOG).exercises).toEqual([]);
  });
});
