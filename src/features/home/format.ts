import { exerciseMeta } from '@/features/notes/details';
import { clockTime } from '@/lib/clock';
import type { ExtractedNote } from '@/lib/extraction/parse-note';
import { plural } from '@/lib/format';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

export const weekdayShort = (date: Date) => WEEKDAYS[date.getDay()];

/** "FRI 16 OCT" (the overline above "Today"). */
export function overlineDate(date: Date) {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** ISO 8601 week number: weeks start on Monday, week 1 holds the year's first Thursday. */
export function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** "FRI 16 OCT · WEEK 42" */
export function homeOverline(date: Date) {
  return `${overlineDate(date)} · WEEK ${isoWeek(date)}`;
}

/** Time of day, following the device's 12/24-hour setting. */
export const time = (date: Date) => clockTime(date);

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "TODAY", "YESTERDAY", or "MON 12 OCT". */
export function dayLabel(date: Date, now: Date) {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  return overlineDate(date);
}

/**
 * "19:10 · UPPER BODY": when, and the session the note comes from. The day is in the date
 * column beside it. A one-off note, written outside a session, shows only the time.
 */
export function noteOverline(createdAt: string, sessionTitle?: string | null) {
  const when = time(new Date(createdAt));
  return sessionTitle?.trim() ? `${when} · ${sessionTitle.trim().toUpperCase()}` : when;
}

/** The note's own words in quotes, as on paper: “Arm curl – 32kg… 10.” */
export function noteQuote(body: string) {
  const text = body.trim().replace(/\s*\n+\s*/g, ' ');
  return text ? `“${text}”` : '“”';
}

/** What the parser understood, flagging what still needs attention: "Bicep curl · equipment not stated". */
export function noteFlag(extracted: ExtractedNote | null) {
  const first = extracted?.exercises[0];
  if (!first) return null;
  const meta = exerciseMeta(first);
  if (meta.warning) return `${first.name} · ${meta.text.toLowerCase()}`;
  if (first.bodyNotes.length > 0) return `${first.name} · body note`;
  return `${first.name} · ${meta.text.toLowerCase()}`;
}

/** "Bicep curl, Bench press, Lat pulldown · 9 sets" */
export function sessionSummary(exerciseNames: string[], sets: number) {
  if (exerciseNames.length === 0) return 'No exercises yet';
  return `${exerciseNames.join(', ')} · ${plural(sets, 'set')}`;
}

/** Elapsed time on a live session: "0:42", "47:12", "1:05:09". */
export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
