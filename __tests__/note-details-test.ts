import { exerciseMeta, groupSets, noteTips, setCount } from '@/features/notes/details';
import type { ExtractedExercise } from '@/lib/extraction/parse-note';

const exercise = (overrides: Partial<ExtractedExercise> = {}): ExtractedExercise => ({
  name: 'Bicep curl',
  exerciseId: 'curl',
  sourceText: 'Arm Curl - 32kg… 10',
  equipment: 'dumbbell',
  weight: { value: 32, unit: 'kg' },
  sets: 3,
  reps: [10, 10, 10],
  setChanges: [],
  effort: null,
  goal: null,
  bodyNotes: [],
  missing: [],
  ...overrides,
});

describe('groupSets', () => {
  it('groups consecutive sets with the same reps', () => {
    expect(groupSets([10, 10, 10, 5, 5])).toEqual([
      { range: 'Sets 1–3', value: '3 × 10', dropped: false },
      { range: 'Sets 4–5', value: '2 × 5', dropped: true },
    ]);
  });

  it('labels single sets and only flags drops below the first group', () => {
    expect(groupSets([8, 8, 6])).toEqual([
      { range: 'Sets 1–2', value: '2 × 8', dropped: false },
      { range: 'Set 3', value: '1 × 6', dropped: true },
    ]);
    expect(groupSets([5, 8])[1].dropped).toBe(false);
  });

  it('returns nothing without reps', () => {
    expect(groupSets([])).toEqual([]);
  });
});

describe('exerciseMeta', () => {
  it('shows the equipment when stated', () => {
    expect(exerciseMeta(exercise())).toEqual({ text: 'Dumbbell', warning: false });
  });

  it('flags missing equipment and unknown exercises', () => {
    expect(exerciseMeta(exercise({ equipment: null, missing: ['equipment'] }))).toEqual({
      text: 'Equipment not stated',
      warning: true,
    });
    expect(exerciseMeta(exercise({ exerciseId: null, missing: ['exercise'] })).text).toBe(
      'Not in your exercise list yet',
    );
  });
});

describe('setCount', () => {
  it('counts sets', () => {
    expect(setCount(exercise())).toBe('3 sets found');
    expect(setCount(exercise({ reps: [12], sets: 1 }))).toBe('1 set found');
    expect(setCount(exercise({ reps: [], sets: null }))).toBe('No sets found');
  });
});

describe('noteTips', () => {
  it('joins set changes and the goal', () => {
    expect(
      noteTips(
        exercise({
          setChanges: ['Clusters of 5 reps'],
          goal: { text: 'drive it 10reps per set', targetReps: 10 },
        }),
      ),
    ).toBe('Clusters of 5 reps. Next time: 10 reps per set at 32 kg.');
  });

  it('is empty when the note says nothing extra', () => {
    expect(noteTips(exercise())).toBe('');
  });
});
