import {
  groupByDay,
  historyOverline,
  newBest,
  sessionMeta,
  sessionOverline,
} from '@/features/history/format';
import type { NoteListItem } from '@/features/notes/api';
import type { SessionSummary } from '@/features/sessions/api';

const iso = (d: number, h: number, m = 0, month = 9) =>
  new Date(2026, month, d, h, m).toISOString();
const now = new Date(2026, 9, 16, 20);

const session = (
  id: string,
  startedAt: string,
  exercises: { id: string; name: string; weights: number[] }[],
  endedAt: string | null = null,
) =>
  ({
    id,
    started_at: startedAt,
    ended_at: endedAt,
    title: null,
    session_exercises: exercises.map((e, i) => ({
      id: `${id}-${i}`,
      position: i,
      exercise_id: e.id,
      exercise: { name: e.name },
      exercise_sets: e.weights.map((w, j) => ({
        id: `${id}-${i}-${j}`,
        weight: w,
        reps: 10,
        unit: 'kg',
      })),
    })),
  }) as unknown as SessionSummary;

const note = (id: string, createdAt: string, body = 'Arm curl 32kg 10') =>
  ({
    id,
    created_at: createdAt,
    body,
    extracted: null,
    session: null,
    session_exercise: null,
  }) as unknown as NoteListItem;

describe('groupByDay', () => {
  it('groups newest first, drops empty notes and marks earlier months', () => {
    const days = groupByDay(
      [session('a', iso(16, 18, 5), []), session('b', iso(28, 7, 30, 8), [])],
      [note('n1', iso(16, 19, 10)), note('n2', iso(14, 9), '  ')],
      now,
    );
    expect(days.map((d) => [d.date, d.weekday, d.monthHeading, d.items.length])).toEqual([
      ['16', 'FRI', null, 2],
      ['28', 'MON', 'SEPTEMBER', 1],
    ]);
    expect(days[0].items[0].kind).toBe('note');
    expect(historyOverline(days, now)).toBe('OCTOBER · 1 SESSION · 1 NOTE');
  });
});

describe('sessionOverline', () => {
  it('shows start time and length, or in progress', () => {
    expect(sessionOverline({ started_at: iso(16, 18, 5), ended_at: iso(16, 18, 57) })).toBe(
      'SESSION · 18:05 · 52 MIN',
    );
    expect(sessionOverline({ started_at: iso(16, 18, 5), ended_at: null })).toBe(
      'SESSION · 18:05 · IN PROGRESS',
    );
  });
});

describe('sessionMeta', () => {
  it('counts sets, volume and a new best against the last session with that exercise', () => {
    const latest = session('c', iso(16, 18), [
      { id: 'bench', name: 'Bench press', weights: [60, 65] },
    ]);
    const older = session('d', iso(12, 18), [{ id: 'bench', name: 'Bench press', weights: [60] }]);
    const all = [latest, older];
    expect(newBest(latest, all)).toBe('Bench press');
    expect(newBest(older, all)).toBeNull();
    expect(sessionMeta(latest, all, 'kg')).toBe('2 sets · 1,250 kg · new best on Bench press');
  });
});
