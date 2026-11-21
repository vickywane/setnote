import {
  dayLabel,
  formatElapsed,
  homeOverline,
  isoWeek,
  noteOverline,
  noteQuote,
  sessionSummary,
} from '@/features/home/format';

jest.mock('expo-localization', () => ({
  getCalendars: () => [{ uses24hourClock: true }],
}));

const at = (h: number, m = 0) => new Date(2026, 9, 16, h, m);

describe('homeOverline', () => {
  it('formats like the design', () => {
    expect(homeOverline(at(9, 41))).toBe('FRI 16 OCT · WEEK 42');
  });
});

describe('isoWeek', () => {
  it('starts weeks on Monday and counts from the first Thursday', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
    expect(isoWeek(new Date(2026, 9, 18))).toBe(42);
    expect(isoWeek(new Date(2026, 9, 19))).toBe(43);
  });
});

describe('dayLabel', () => {
  const now = at(20);
  it('uses TODAY, YESTERDAY, then a short date', () => {
    expect(dayLabel(at(8), now)).toBe('TODAY');
    expect(dayLabel(new Date(2026, 9, 15, 18, 42), now)).toBe('YESTERDAY');
    expect(dayLabel(new Date(2026, 9, 12, 19, 5), now)).toBe('MON 12 OCT');
  });
});

describe('noteOverline', () => {
  it('shows the time and the session the note comes from', () => {
    expect(noteOverline(at(19, 10).toISOString(), ' Upper body ')).toBe('19:10 · UPPER BODY');
  });

  it('shows only the time for a one-off note', () => {
    expect(noteOverline(at(19, 10).toISOString(), null)).toBe('19:10');
    expect(noteOverline(at(19, 10).toISOString(), '  ')).toBe('19:10');
  });
});

describe('noteQuote', () => {
  it('quotes the note on one line', () => {
    expect(noteQuote('  Arm curl – 32kg\n\n10, 10  ')).toBe('“Arm curl – 32kg 10, 10”');
    expect(noteQuote('')).toBe('“”');
  });
});

describe('sessionSummary', () => {
  it('lists exercises and the set count', () => {
    expect(sessionSummary(['Bicep curl', 'Bench press'], 9)).toBe(
      'Bicep curl, Bench press · 9 sets',
    );
    expect(sessionSummary(['Squat'], 1)).toBe('Squat · 1 set');
    expect(sessionSummary([], 0)).toBe('No exercises yet');
  });
});

describe('formatElapsed', () => {
  it('counts minutes and seconds, adding hours past the hour', () => {
    expect(formatElapsed(42_000)).toBe('0:42');
    expect(formatElapsed((47 * 60 + 12) * 1000)).toBe('47:12');
    expect(formatElapsed((3600 + 5 * 60 + 9) * 1000)).toBe('1:05:09');
    expect(formatElapsed(-5)).toBe('0:00');
  });
});
