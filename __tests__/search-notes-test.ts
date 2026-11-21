import { notesSearchPattern } from '@/features/notes/api';

describe('notesSearchPattern', () => {
  it('matches the trimmed query anywhere', () => {
    expect(notesSearchPattern('  bench ')).toBe('%bench%');
  });

  it('takes wildcards and backslashes literally', () => {
    expect(notesSearchPattern('100%_a\\b')).toBe('%100\\%\\_a\\\\b%');
  });
});
