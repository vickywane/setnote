import { fromModel, type ModelExercise } from '@/lib/extraction/model-note';
import type { CatalogEntry } from '@/lib/extraction/parse-note';

const CATALOG: CatalogEntry[] = [
  {
    id: 'curl',
    name: 'Bicep curl',
    equipment: ['dumbbell', 'cable'],
    aliases: ['curl', 'arm curl'],
  },
  { id: 'bench', name: 'Bench press', equipment: ['barbell', 'dumbbell'], aliases: ['bench'] },
];

const exercise = (overrides: Partial<ModelExercise> = {}): ModelExercise => ({
  name: 'Arm curl',
  catalogId: 'curl',
  sourceText:
    'Arm Curl - 32kg… 10\nStruggled with it from the start… after 3 sets, had to break into 5 reps per go… should be able to improve and drive it 10reps per set',
  equipment: null,
  weight: { value: 32, unit: 'kg' },
  sets: 3,
  reps: [10, 10, 10],
  setChanges: ['Clusters of 5 reps after set 3'],
  effort: 'high',
  goal: { text: 'Drive it to 10 reps per set', targetReps: 10 },
  bodyNotes: [],
  ...overrides,
});

describe('fromModel', () => {
  it('reads the VIC-53 arm curl note into the app’s shape, named from the catalog', () => {
    expect(fromModel([exercise()], CATALOG)).toEqual({
      version: 1,
      source: 'model',
      exercises: [
        {
          name: 'Bicep curl',
          exerciseId: 'curl',
          sourceText:
            'Arm Curl - 32kg… 10\nStruggled with it from the start… after 3 sets, had to break into 5 reps per go… should be able to improve and drive it 10reps per set',
          equipment: null,
          weight: { value: 32, unit: 'kg' },
          sets: 3,
          reps: [10, 10, 10],
          setChanges: ['Clusters of 5 reps after set 3'],
          effort: 'high',
          goal: { text: 'Drive it to 10 reps per set', targetReps: 10 },
          bodyNotes: [],
          missing: ['equipment'],
        },
      ],
    });
  });

  it('keeps an exercise that isn’t in the catalog as new, and asks about it', () => {
    const [read] = fromModel(
      [
        exercise({
          name: 'Incline walk',
          catalogId: 'made-up',
          weight: null,
          reps: [],
          sets: null,
        }),
      ],
      CATALOG,
    ).exercises;
    expect(read.name).toBe('Incline walk');
    expect(read.exerciseId).toBeNull();
    expect(read.missing).toEqual(['exercise', 'equipment', 'weight', 'reps']);
  });

  it('drops values that don’t make sense', () => {
    const [read] = fromModel(
      [
        exercise({
          equipment: 'trampoline',
          weight: { value: -5, unit: 'kg' },
          reps: [8, 0, 2.5, 8],
          sets: null,
          effort: 'extreme' as never,
          goal: { text: '  ', targetReps: 10 },
          setChanges: ['', 'Drop set'],
        }),
      ],
      CATALOG,
    ).exercises;
    expect(read.equipment).toBeNull();
    expect(read.weight).toBeNull();
    expect(read.reps).toEqual([8, 8]);
    expect(read.sets).toBe(2);
    expect(read.effort).toBeNull();
    expect(read.goal).toBeNull();
    expect(read.setChanges).toEqual(['Drop set']);
  });

  it('doesn’t ask for a weight for bodyweight exercises', () => {
    const [read] = fromModel(
      [exercise({ equipment: 'bodyweight', weight: null })],
      CATALOG,
    ).exercises;
    expect(read.missing).toEqual([]);
  });

  it('doesn’t read a Then or Goal into a note that only has numbers', () => {
    const [read] = fromModel(
      [
        exercise({
          name: 'Bench press',
          catalogId: 'bench',
          sourceText: 'Bench 80kg 8, 8, 6',
          reps: [8, 8, 6],
          setChanges: ['Dropped to 6 reps on the last set'],
          goal: { text: 'Get 8 reps on every set', targetReps: 8 },
        }),
      ],
      CATALOG,
    ).exercises;
    expect(read.setChanges).toEqual([]);
    expect(read.goal).toBeNull();
    expect(read.reps).toEqual([8, 8, 6]);
  });

  it('keeps them when the note says them in words', () => {
    const [read] = fromModel([exercise()], CATALOG).exercises;
    expect(read.setChanges).toEqual(['Clusters of 5 reps after set 3']);
    expect(read.goal?.targetReps).toBe(10);
  });

  it('skips entries without a name', () => {
    expect(fromModel([exercise({ name: ' ' })], CATALOG).exercises).toEqual([]);
  });
});
