/**
 * Calendar maths for the "This week" strip on the Notes home: one row of days that scrolls back
 * from the end of the current week to the day the account started.
 *
 * Days are local midnights in ms (see `startOfDay`). Dates are always built from year, month
 * and day, never by adding 24h, so weeks stay aligned across daylight-saving changes.
 */
import { startOfDay } from '@/features/home/format';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** A bad clock or a corrupt date shouldn't make an endless strip: 20 years is plenty. */
const MAX_DAYS = 366 * 20;

export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The local midnight `days` days after `day`. */
export function addDays(day: number, days: number) {
  const d = new Date(day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** Local midnight on the Monday of `date`'s week. */
export function mondayOf(date: Date | number) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
}

/**
 * Every day on the strip, newest first: this week's Sunday back to the Monday of the week the
 * account started, so every week on the strip is whole (no gap before the first day). With no
 * start yet (or a bad or future one), it's just this week, Monday to Sunday.
 */
export function stripDays(now: Date, start: number | null): number[] {
  const today = startOfDay(now);
  const sunday = addDays(mondayOf(now), 6);
  const valid = start !== null && Number.isFinite(start) && start <= today;
  const first = valid
    ? mondayOf(Math.max(startOfDay(new Date(start)), addDays(today, -MAX_DAYS)))
    : mondayOf(now);
  // Rounded: a day that crosses a clock change is an hour short or long.
  const count = Math.round((sunday - first) / DAY_MS) + 1;
  return Array.from({ length: count }, (_, i) => addDays(sunday, -i));
}

export type SessionCalendar = {
  /** Days with at least one session. */
  days: ReadonlySet<number>;
  /** Sessions started in each week, by Monday. */
  perWeek: ReadonlyMap<number, number>;
  /** The day of the earliest session. */
  first: number | null;
};

/** Days trained, sessions per week, and the first session's day, in one pass. */
export function sessionCalendar(startedAt: readonly string[]): SessionCalendar {
  const days = new Set<number>();
  const perWeek = new Map<number, number>();
  let first: number | null = null;
  for (const iso of startedAt) {
    const date = new Date(iso);
    const day = startOfDay(date);
    if (!Number.isFinite(day)) continue;
    days.add(day);
    const monday = mondayOf(date);
    perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1);
    if (first === null || day < first) first = day;
  }
  return { days, perWeek, first };
}

/** The strip's first day: when the account was created, or an earlier session (imported data). */
export function historyStart(
  accountCreatedAt: string | null | undefined,
  firstSession: number | null,
) {
  const created = accountCreatedAt ? startOfDay(new Date(accountCreatedAt)) : NaN;
  const candidates = [created, firstSession ?? NaN].filter(Number.isFinite);
  return candidates.length ? Math.min(...candidates) : null;
}

/** "This week", "Last week", "6 – 12 Oct", "29 Sep – 5 Oct", "29 Dec 2025 – 4 Jan 2026". */
export function weekTitle(monday: number, now: Date) {
  const weeksAgo = Math.round((mondayOf(now) - monday) / WEEK_MS);
  if (weeksAgo === 0) return 'This week';
  if (weeksAgo === 1) return 'Last week';
  const start = new Date(monday);
  const end = new Date(addDays(monday, 6));
  const endText = `${end.getDate()} ${MONTHS[end.getMonth()]}`;
  const endYear = end.getFullYear() === now.getFullYear() ? '' : ` ${end.getFullYear()}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()} – ${endText} ${end.getFullYear()}`;
  }
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${endText}${endYear}`;
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${endText}${endYear}`;
}

/** "Today", "Yesterday", "Mon 13 Oct", or "Mon 13 Oct 2025" in another year. */
export function dayTitle(day: number, now: Date) {
  const today = startOfDay(now);
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  const date = new Date(day);
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${year}`;
}

export type DayState = {
  day: number;
  /** "M", "T", … */
  letter: string;
  done: boolean;
  today: boolean;
  /** After today: nothing to show yet, so it can't be tapped. */
  disabled: boolean;
};

export function dayState(day: number, trained: ReadonlySet<number>, today: number): DayState {
  return {
    day,
    letter: DAY_LETTERS[(new Date(day).getDay() + 6) % 7],
    done: trained.has(day),
    today: day === today,
    disabled: day > today,
  };
}

/** "Monday 13 October, today, trained, selected": what a screen reader says for a day. */
export function dayAccessibilityLabel(state: DayState, selected: boolean) {
  const date = new Date(state.day);
  return [
    `${DAY_NAMES[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`,
    state.today && 'today',
    state.done ? 'trained' : 'no session',
    selected && 'selected',
  ]
    .filter(Boolean)
    .join(', ');
}

/** The day as an ISO range for querying rows created on it, local time: [from, to). */
export function dayRange(day: number) {
  return { from: new Date(day).toISOString(), to: new Date(addDays(day, 1)).toISOString() };
}

/**
 * The rows of a newest-first list (capped at `limit`) that fall on `day`, or undefined when
 * the list might not reach back that far, so the caller fetches the day instead.
 */
export function fromList<T>(
  list: readonly T[],
  day: number,
  limit: number,
  dateOf: (row: T) => string,
): T[] | undefined {
  const oldest = list.at(-1);
  const complete =
    list.length < limit || (oldest !== undefined && Date.parse(dateOf(oldest)) < day);
  if (!complete) return undefined;
  const next = addDays(day, 1);
  return list.filter((row) => {
    const time = Date.parse(dateOf(row));
    return time >= day && time < next;
  });
}
