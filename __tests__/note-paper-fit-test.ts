import { cutToFit, keepLines, MAX_NOTE_LINES } from '@/features/notes/components/note-paper';

describe('keepLines', () => {
  it('leaves a note that fits alone', () => {
    expect(keepLines('Bench 80kg 8, 8, 6\nSquat 3x5 100kg')).toBe(
      'Bench 80kg 8, 8, 6\nSquat 3x5 100kg',
    );
  });

  it('keeps the first page of a paste with too many lines', () => {
    const pasted = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n');
    const kept = keepLines(pasted);
    expect(kept.split('\n')).toHaveLength(MAX_NOTE_LINES);
    expect(kept.endsWith(`Line ${MAX_NOTE_LINES}`)).toBe(true);
  });
});

describe('cutToFit', () => {
  const text = 'Bench 80kg 8, 8, 6 felt solid, kept elbows tucked and paused each rep';

  it('cuts in proportion to how far the text runs over, at a word break', () => {
    const cut = cutToFit(text, 0, 0.5);
    expect(cut.length).toBeLessThanOrEqual(text.length / 2);
    expect(text.startsWith(cut)).toBe(true);
    expect(text[cut.length]).toBe(' ');
  });

  it('never cuts into what already fitted', () => {
    expect(cutToFit(text, 40, 0.1)).toBe(text.slice(0, 40));
  });

  it('gets shorter each pass, so repeated layouts settle', () => {
    const once = cutToFit(text, 0, 0.9);
    expect(cutToFit(once, 0, 0.9).length).toBeLessThan(once.length);
  });
});
