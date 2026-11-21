import { EXERCISE_ICONS, iconForExercise } from '@/lib/exercise-icons';

describe('iconForExercise', () => {
  it.each([
    ['Bicep curl', 'bicep-curl'],
    ['Preacher curl', 'bicep-curl'],
    ['Hammer curl', 'hammer-curl'],
    ['Leg curl', 'leg-curl'],
    ['Bench press', 'bench-press'],
    ['Incline bench press', 'incline-bench-press'],
    ['Romanian deadlift', 'romanian-deadlift'],
    ['RDL', 'romanian-deadlift'],
    ['Deadlift', 'deadlift'],
    ['Lat pulldown', 'lat-pulldown'],
    ['Pull-up', 'pull-up'],
    ['Squat', 'squat'],
    ['Bulgarian split squat', 'lunge'],
    ['Slow calf raise', 'calf-raise'],
    ['Calf raise on leg press', 'calf-raise'],
    ['Single-leg press', 'leg-press'],
    ['Seated cable row', 'seated-cable-row'],
    ['Barbell row', 'barbell-row'],
    ['Tricep pushdown', 'tricep-pushdown'],
    ['Incline walk', 'custom'],
  ])('%s → %s', (name, key) => {
    expect(iconForExercise(name)).toBe(key);
  });

  it('has an icon asset for every key', () => {
    expect(Object.keys(EXERCISE_ICONS)).toHaveLength(26);
  });
});
