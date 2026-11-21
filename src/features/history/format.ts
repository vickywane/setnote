import { EQUIPMENT_LABELS } from '@/features/catalog/api';
import { MONTH_NAMES, noteFlag, startOfDay, time, weekdayShort } from '@/features/home/format';
import type { NoteListItem } from '@/features/notes/api';
import type { SessionSummary } from '@/features/sessions/api';
import { heaviest } from '@/features/sessions/format';
import { formatMinutes, formatNumber, plural, totalVolume } from '@/lib/format';
import type { WeightUnit } from '@/stores/preferences-store';

export type HistoryItem =
  | { kind: 'session'; date: string; session: SessionSummary }
  | { kind: 'note'; date: string; note: NoteListItem };

export type HistoryDay = {
  /** Start of the day, local time. */
  day: number;
  /** "16" */
  date: string;
  /** "FRI" */
  weekday: string;
  /** Set on the first day of each month before the current one: "SEPTEMBER 2026" or "SEPTEMBER". */
  monthHeading: string | null;
  items: HistoryItem[];
};

/** Sessions and notes, newest first, grouped by the day they happened. */
export function groupByDay(
  sessions: readonly SessionSummary[],
  notes: readonly NoteListItem[],
  now: Date,
): HistoryDay[] {
  const items: HistoryItem[] = [
    ...sessions.map((session): HistoryItem => ({
      kind: 'session',
      date: session.started_at,
      session,
    })),
    // Notes with nothing written are discarded, so they never show.
    ...notes
      .filter((note) => note.body.trim())
      .map((note): HistoryItem => ({ kind: 'note', date: note.created_at, note })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const days: HistoryDay[] = [];
  for (const item of items) {
    const date = new Date(item.date);
    const day = startOfDay(date);
    const last = days[days.length - 1];
    if (last?.day === day) {
      last.items.push(item);
      continue;
    }
    const lastDate = last ? new Date(last.day) : now;
    const newMonth =
      date.getMonth() !== lastDate.getMonth() || date.getFullYear() !== lastDate.getFullYear();
    days.push({
      day,
      date: String(date.getDate()),
      weekday: weekdayShort(date),
      monthHeading: newMonth ? monthHeading(date, now) : null,
      items: [item],
    });
  }
  return days;
}

const monthHeading = (date: Date, now: Date) =>
  date.getFullYear() === now.getFullYear()
    ? MONTH_NAMES[date.getMonth()]
    : `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

/** "OCTOBER · 14 SESSIONS · 6 NOTES": this month so far. */
export function historyOverline(days: readonly HistoryDay[], now: Date) {
  let sessions = 0;
  let notes = 0;
  for (const { items } of days) {
    for (const item of items) {
      const date = new Date(item.date);
      if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) continue;
      if (item.kind === 'session') sessions++;
      else notes++;
    }
  }
  return [
    MONTH_NAMES[now.getMonth()],
    plural(sessions, 'SESSION', 'SESSIONS'),
    plural(notes, 'NOTE', 'NOTES'),
  ].join(' · ');
}

/** "SESSION · 18:05 · 52 MIN", or "SESSION · 18:05 · IN PROGRESS" while it's unfinished. */
export function sessionOverline(session: Pick<SessionSummary, 'started_at' | 'ended_at'>) {
  const start = new Date(session.started_at);
  const length = session.ended_at
    ? formatMinutes(Date.parse(session.ended_at) - start.getTime()).toUpperCase()
    : 'IN PROGRESS';
  return `SESSION · ${time(start)} · ${length}`;
}

/** "NOTE · 19:10" */
export const historyNoteOverline = (createdAt: string) => `NOTE · ${time(new Date(createdAt))}`;

/** "Bicep curl, Bench press, Lat pulldown" */
export function sessionExercises(session: Pick<SessionSummary, 'session_exercises'>) {
  // An exercise can be added twice in one session; name it once.
  const names = [...new Set(session.session_exercises.map((se) => se.exercise.name))];
  return names.length ? names.join(', ') : 'No exercises yet';
}

/**
 * The first exercise in `session` where a set beat the heaviest weight from the last earlier
 * session with that exercise. `sessions` is every session, newest first.
 */
export function newBest(session: SessionSummary, sessions: readonly SessionSummary[]) {
  const older = sessions.filter((s) => Date.parse(s.started_at) < Date.parse(session.started_at));
  for (const se of session.session_exercises) {
    const previous = older
      .flatMap((s) => s.session_exercises.filter((p) => p.exercise_id === se.exercise_id))
      .find((p) => p.exercise_sets.length > 0);
    if (!previous) continue;
    const beaten = se.exercise_sets.some((set) => {
      const best = heaviest(previous.exercise_sets, set.unit);
      return set.weight !== null && best !== null && set.weight > best;
    });
    if (beaten) return se.exercise.name;
  }
  return null;
}

/** "12 sets · 3,840 kg · new best on Bench press" */
export function sessionMeta(
  session: SessionSummary,
  sessions: readonly SessionSummary[],
  unit: WeightUnit,
) {
  const sets = session.session_exercises.flatMap((se) => se.exercise_sets);
  const parts = [plural(sets.length, 'set')];
  const volume = totalVolume(sets, unit);
  if (volume > 0) parts.push(`${formatNumber(volume)} ${unit}`);
  const best = newBest(session, sessions);
  if (best) parts.push(`new best on ${best}`);
  return parts.join(' · ');
}

/**
 * The caption under a note: what the parser flagged ("Bicep curl · equipment not stated"),
 * or for an exercise note, its exercise.
 */
export function noteMetaLine(note: NoteListItem) {
  const flagged = noteFlag(note.extracted);
  if (flagged) return flagged;
  const se = note.session_exercise;
  if (!se) return null;
  return se.equipment
    ? `${se.exercise.name} · ${EQUIPMENT_LABELS[se.equipment].toLowerCase()}`
    : se.exercise.name;
}
