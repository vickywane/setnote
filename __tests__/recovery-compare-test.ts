import { comparableChecks, type RecentRecoveryCheck } from '@/features/recovery/api';
import { readingLine } from '@/features/recovery/components';

let n = 0;
function check(overrides: Partial<RecentRecoveryCheck> = {}): RecentRecoveryCheck {
  n += 1;
  return {
    id: `check-${n}`,
    user_id: 'user-1',
    session_id: 'session-old',
    session_exercise_id: null,
    session_exercise: null,
    pulse_bpm: 100,
    breathing_bpm: 18,
    hrv_ms: 40,
    confidence: 80,
    duration_ms: 45_000,
    created_at: `2026-11-0${(n % 9) + 1}T10:00:00Z`,
    video_path: null,
    video_location: null,
    ...overrides,
  };
}

const afterCurl = (overrides: Partial<RecentRecoveryCheck> = {}) =>
  check({
    session_exercise_id: `se-${n + 1}`,
    session_exercise: { exercise_id: 'curl' },
    ...overrides,
  });

describe('comparableChecks', () => {
  const sessionCheck = check();
  const curl = afterCurl();
  const bench = check({
    session_exercise_id: 'se-bench',
    session_exercise: { exercise_id: 'bench' },
  });
  const curlThisSession = afterCurl({ session_id: 'session-now' });

  it('compares an exercise with checks after the same exercise in other sessions', () => {
    expect(
      comparableChecks([sessionCheck, curl, bench, curlThisSession], {
        exerciseId: 'curl',
        excludeSessionId: 'session-now',
      }),
    ).toEqual([curl]);
  });

  it('compares a session with other session checks only', () => {
    expect(
      comparableChecks([sessionCheck, curl, bench], {
        exerciseId: null,
        excludeSessionId: 'session-now',
      }),
    ).toEqual([sessionCheck]);
  });

  it('only looks at checks taken before the one shown', () => {
    const early = afterCurl({ created_at: '2026-10-01T10:00:00Z' });
    const late = afterCurl({ created_at: '2026-12-01T10:00:00Z' });
    expect(
      comparableChecks([early, late], { exerciseId: 'curl', before: '2026-11-15T10:00:00Z' }),
    ).toEqual([early]);
  });
});

describe('readingLine', () => {
  const reading = check({ pulse_bpm: 112, breathing_bpm: 18, hrv_ms: 34 });

  it('shows the plain reading until there are three earlier checks', () => {
    expect(readingLine(reading, [check(), check()])).toBe('Pulse 112 · 18 breaths/min · HRV 34 ms');
  });

  it('marks values above or below your usual, and leaves usual ones plain', () => {
    const usual = [check(), check(), check()]; // pulse 100, breathing 18, HRV 40
    expect(readingLine(reading, usual)).toBe('Pulse 112 ↑ · 18 breaths/min · HRV 34 ms ↓');
  });

  it('leaves out values the check has no reading for', () => {
    expect(readingLine(check({ pulse_bpm: 95, breathing_bpm: null, hrv_ms: null }))).toBe(
      'Pulse 95',
    );
  });
});
