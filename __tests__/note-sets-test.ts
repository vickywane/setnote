import { describeSets, setsFromNote, setsToLog } from '@/features/notes/note-sets';

describe('setsFromNote', () => {
  it('makes one set per rep count, at the note’s weight', () => {
    expect(setsFromNote({ weight: { value: 200, unit: 'kg' }, reps: [4, 4] }, 'lb')).toEqual([
      { weight: 200, reps: 4, unit: 'kg' },
      { weight: 200, reps: 4, unit: 'kg' },
    ]);
  });

  it('uses the preferred unit and no weight when the note gives none', () => {
    expect(setsFromNote({ weight: null, reps: [12] }, 'lb')).toEqual([
      { weight: null, reps: 12, unit: 'lb' },
    ]);
  });

  it('finds no sets without rep counts', () => {
    expect(setsFromNote({ weight: { value: 80, unit: 'kg' }, reps: [] }, 'kg')).toEqual([]);
    expect(setsFromNote(undefined, 'kg')).toEqual([]);
  });

  it('skips rep counts that are not real', () => {
    expect(setsFromNote({ weight: null, reps: [0, 8, Number.NaN] }, 'kg')).toHaveLength(1);
  });
});

describe('setsToLog', () => {
  const found = setsFromNote({ weight: { value: 80, unit: 'kg' }, reps: [8, 8, 6] }, 'kg');

  it('logs everything when nothing is logged yet', () => {
    expect(setsToLog(found, 0)).toHaveLength(3);
  });

  it('only adds sets beyond the ones already logged', () => {
    expect(setsToLog(found, 2)).toEqual([{ weight: 80, reps: 6, unit: 'kg' }]);
    expect(setsToLog(found, 5)).toEqual([]);
  });
});

describe('describeSets', () => {
  it('reads like the note', () => {
    expect(
      describeSets(setsFromNote({ weight: { value: 200, unit: 'kg' }, reps: [4, 4] }, 'kg')),
    ).toBe('2 × 4 at 200 kg');
    expect(
      describeSets(setsFromNote({ weight: { value: 80, unit: 'kg' }, reps: [8, 8, 6] }, 'kg')),
    ).toBe('8, 8, 6 at 80 kg');
    expect(describeSets(setsFromNote({ weight: null, reps: [12, 12, 12] }, 'kg'))).toBe('3 × 12');
  });
});
