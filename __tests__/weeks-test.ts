import {
  addDays,
  dayRange,
  dayState,
  dayTitle,
  fromList,
  historyStart,
  mondayOf,
  sessionCalendar,
  stripDays,
  weekTitle,
} from '@/features/home/weeks';

// Local times, so these hold in any time zone the tests run in.
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
// Friday 16 October 2026, 09:41.
const NOW = new Date(2026, 9, 16, 9, 41);

describe('mondayOf', () => {
  it('goes back to Monday, and Sunday belongs to the week before', () => {
    expect(mondayOf(NOW)).toBe(day(2026, 10, 12));
    expect(mondayOf(new Date(2026, 9, 12, 0, 0))).toBe(day(2026, 10, 12));
    expect(mondayOf(new Date(2026, 9, 18, 23, 59))).toBe(day(2026, 10, 12));
    expect(mondayOf(new Date(2026, 9, 19))).toBe(day(2026, 10, 19));
  });
});

describe('stripDays', () => {
  it('is just this week, Monday to Sunday, with no history or a bad start', () => {
    const week = [19, 18, 17, 16, 15, 14, 13, 12].slice(1).map((d) => day(2026, 10, d));
    expect(stripDays(NOW, null)).toEqual(week);
    expect(stripDays(NOW, day(2027, 1, 1))).toEqual(week);
    expect(stripDays(NOW, NaN)).toEqual(week);
  });

  it('runs newest first from this Sunday back to the Monday of the first week, in whole weeks', () => {
    // Created on Friday 9 October: all of that week, then all of this one.
    const days = stripDays(NOW, day(2026, 10, 9));
    expect(days[0]).toBe(day(2026, 10, 18));
    expect(days.at(-1)).toBe(day(2026, 10, 5));
    expect(days).toHaveLength(14);
    // Created this week (Wednesday): still the whole week, from Monday, with no gap.
    expect(stripDays(NOW, day(2026, 10, 14))).toHaveLength(7);
    expect(stripDays(NOW, day(2026, 10, 14)).at(-1)).toBe(day(2026, 10, 12));
  });

  it('has one local midnight per day across clock changes and year ends', () => {
    const days = stripDays(new Date(2027, 3, 14), day(2026, 1, 1));
    for (const d of days) {
      const date = new Date(d);
      expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
    }
    days.slice(1).forEach((d, i) => expect(addDays(d, 1)).toBe(days[i]));
    // 1 January 2026 is a Thursday: the strip starts on Monday 29 December 2025.
    expect(days.at(-1)).toBe(day(2025, 12, 29));
  });

  it('caps a nonsense start date', () => {
    // 20 years, rounded out to whole weeks at both ends.
    expect(stripDays(NOW, 0).length).toBeLessThanOrEqual(366 * 20 + 14);
  });
});

describe('sessionCalendar', () => {
  it('marks days, counts sessions per week and finds the first day', () => {
    const calendar = sessionCalendar([
      new Date(2026, 9, 16, 18).toISOString(),
      new Date(2026, 9, 16, 7).toISOString(),
      new Date(2026, 9, 11, 23, 30).toISOString(),
      'not a date',
    ]);
    expect([...calendar.days].sort()).toEqual([day(2026, 10, 11), day(2026, 10, 16)]);
    expect(calendar.perWeek.get(day(2026, 10, 12))).toBe(2);
    // Sunday night is the end of the week before, not the start of the next.
    expect(calendar.perWeek.get(day(2026, 10, 5))).toBe(1);
    expect(calendar.first).toBe(day(2026, 10, 11));
  });

  it('is empty with no sessions', () => {
    expect(sessionCalendar([])).toEqual({ days: new Set(), perWeek: new Map(), first: null });
  });
});

describe('historyStart', () => {
  it('uses the earlier of account creation and the first session', () => {
    const created = new Date(2026, 9, 1, 15).toISOString();
    expect(historyStart(created, null)).toBe(day(2026, 10, 1));
    expect(historyStart(created, day(2026, 8, 3))).toBe(day(2026, 8, 3));
    expect(historyStart(created, day(2026, 10, 9))).toBe(day(2026, 10, 1));
    expect(historyStart(undefined, day(2026, 10, 9))).toBe(day(2026, 10, 9));
    expect(historyStart(undefined, null)).toBeNull();
    expect(historyStart('garbage', null)).toBeNull();
  });
});

describe('weekTitle', () => {
  it('names the two most recent weeks, then shows the dates', () => {
    expect(weekTitle(day(2026, 10, 12), NOW)).toBe('This week');
    expect(weekTitle(day(2026, 10, 5), NOW)).toBe('Last week');
    expect(weekTitle(day(2026, 9, 21), NOW)).toBe('21 – 27 Sep');
    expect(weekTitle(day(2026, 9, 28), NOW)).toBe('28 Sep – 4 Oct');
  });

  it('adds the year outside this one', () => {
    expect(weekTitle(day(2025, 10, 6), NOW)).toBe('6 – 12 Oct 2025');
    expect(weekTitle(day(2025, 12, 29), NOW)).toBe('29 Dec 2025 – 4 Jan 2026');
  });
});

describe('dayTitle', () => {
  it('says Today and Yesterday, then the date', () => {
    expect(dayTitle(day(2026, 10, 16), NOW)).toBe('Today');
    expect(dayTitle(day(2026, 10, 15), NOW)).toBe('Yesterday');
    expect(dayTitle(day(2026, 10, 12), NOW)).toBe('Mon 12 Oct');
    expect(dayTitle(day(2025, 10, 13), NOW)).toBe('Mon 13 Oct 2025');
  });
});

describe('dayState', () => {
  it('knows its letter, whether it was trained, and that later days are disabled', () => {
    const trained = new Set([day(2026, 10, 14)]);
    const today = day(2026, 10, 16);
    expect(dayState(day(2026, 10, 14), trained, today)).toEqual({
      day: day(2026, 10, 14),
      letter: 'W',
      done: true,
      today: false,
      disabled: false,
    });
    expect(dayState(today, trained, today)).toMatchObject({
      letter: 'F',
      today: true,
      disabled: false,
    });
    expect(dayState(day(2026, 10, 18), trained, today)).toMatchObject({
      letter: 'S',
      disabled: true,
    });
  });
});

describe('dayRange', () => {
  it('covers the local day', () => {
    expect(dayRange(day(2026, 10, 16))).toEqual({
      from: new Date(2026, 9, 16).toISOString(),
      to: new Date(2026, 9, 17).toISOString(),
    });
  });
});

describe('fromList', () => {
  const row = (y: number, m: number, d: number, h: number) => ({
    at: new Date(y, m - 1, d, h).toISOString(),
  });
  const at = (r: { at: string }) => r.at;

  it('picks the day out of a list that reaches back to it', () => {
    const list = [
      row(2026, 10, 16, 9),
      row(2026, 10, 15, 23),
      row(2026, 10, 15, 6),
      row(2026, 10, 14, 8),
    ];
    expect(fromList(list, day(2026, 10, 15), 100, at)).toEqual([list[1], list[2]]);
    expect(fromList(list, day(2026, 10, 1), 100, at)).toEqual([]);
  });

  it("doesn't trust a full list that may be missing the day", () => {
    const list = [row(2026, 10, 16, 9), row(2026, 10, 15, 6)];
    // Full (2 of 2): the 15th may have more rows past the cut-off, and the 10th is out of reach.
    expect(fromList(list, day(2026, 10, 15), 2, at)).toBeUndefined();
    expect(fromList(list, day(2026, 10, 10), 2, at)).toBeUndefined();
    // But a day after the oldest row is complete.
    expect(fromList(list, day(2026, 10, 16), 2, at)).toEqual([list[0]]);
  });
});
