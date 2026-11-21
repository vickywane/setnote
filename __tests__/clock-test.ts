import { getCalendars } from 'expo-localization';

import { clockTime, uses24HourClock } from '@/lib/clock';

jest.mock('expo-localization', () => ({ getCalendars: jest.fn() }));

const mockCalendars = (uses24hourClock: boolean | null) =>
  (getCalendars as jest.Mock).mockReturnValue([{ uses24hourClock }]);

const at = (h: number, m: number) => new Date(2026, 9, 16, h, m);

describe('clockTime', () => {
  it.each([
    [0, 5, '00:05'],
    [9, 41, '09:41'],
    [19, 10, '19:10'],
  ])('24-hour %i:%i → %s', (h, m, expected) => {
    expect(clockTime(at(h, m), true)).toBe(expected);
  });

  it.each([
    [0, 5, '12:05 AM'],
    [9, 41, '9:41 AM'],
    [12, 0, '12:00 PM'],
    [19, 10, '7:10 PM'],
  ])('12-hour %i:%i → %s', (h, m, expected) => {
    expect(clockTime(at(h, m), false)).toBe(expected);
  });

  it('follows the device setting by default', () => {
    mockCalendars(false);
    expect(clockTime(at(19, 10))).toBe('7:10 PM');
    mockCalendars(true);
    expect(clockTime(at(19, 10))).toBe('19:10');
  });
});

describe('uses24HourClock', () => {
  it('falls back to the locale when the device does not say', () => {
    mockCalendars(null);
    const { hourCycle } = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
    expect(uses24HourClock()).toBe(hourCycle === 'h23' || hourCycle === 'h24');
  });
});
