import { fireEvent, render, screen } from '@testing-library/react-native';

import { WeekStrip } from '@/features/home/week-strip';
import { stripDays } from '@/features/home/weeks';

import { QueryWrapper } from '../jest/test-utils';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
// Friday 16 October 2026.
const NOW = new Date(2026, 9, 16, 9, 41);
const TODAY = day(2026, 10, 16);
// On a 402pt phone: seven 40pt tiles between a 16pt peek and a 16pt gutter.
const SLOT = 40 + (402 - 16 - 16 - 7 * 40) / 7;

async function renderStrip(overrides: Partial<Parameters<typeof WeekStrip>[0]> = {}) {
  const onSelectDay = jest.fn();
  const onWeekChange = jest.fn();
  await render(
    <WeekStrip
      days={stripDays(NOW, day(2026, 9, 30))}
      trained={new Set([day(2026, 10, 14), day(2026, 10, 7)])}
      today={TODAY}
      selectedDay={null}
      onSelectDay={onSelectDay}
      onWeekChange={onWeekChange}
      {...overrides}
    />,
    { wrapper: QueryWrapper },
  );
  // Jest has no layout pass: report the phone's width.
  await fireEvent(screen.getByTestId('week-strip'), 'layout', {
    nativeEvent: { layout: { width: 402, height: 80, x: 0, y: 0 } },
  });
  return { onSelectDay, onWeekChange };
}

const list = () => screen.getByTestId('week-strip').children[0] as never;

describe('WeekStrip', () => {
  it('opens on this week, with the day before it ready to peek in', async () => {
    const { onWeekChange } = await renderStrip();
    expect(screen.getByLabelText('Friday 16 October, today, no session')).toBeVisible();
    expect(screen.getByLabelText('Wednesday 14 October, trained')).toBeVisible();
    expect(screen.getByLabelText('Sunday 11 October, no session')).toBeVisible();
    expect(onWeekChange).toHaveBeenLastCalledWith(day(2026, 10, 12));
  });

  it('runs back through the whole first week', async () => {
    // Account created on Friday 9 October: that week shows from Monday 5th (see weeks-test),
    // and the days before the 9th are there too rather than an empty gap.
    await renderStrip({ days: stripDays(NOW, day(2026, 10, 9)) });
    expect(screen.getByLabelText('Friday 9 October, no session')).toBeVisible();
    expect(screen.queryByLabelText('Sunday 4 October, no session')).toBeNull();
  });

  it('selects a day when tapped, but not days still to come', async () => {
    const { onSelectDay } = await renderStrip();
    await fireEvent.press(screen.getByLabelText('Wednesday 14 October, trained'));
    expect(onSelectDay).toHaveBeenCalledWith(day(2026, 10, 14));
    await fireEvent.press(screen.getByLabelText('Saturday 17 October, no session'));
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Saturday 17 October, no session')).toBeDisabled();
  });

  it('marks the selected day', async () => {
    await renderStrip({ selectedDay: day(2026, 10, 14) });
    expect(screen.getByLabelText('Wednesday 14 October, trained, selected')).toBeSelected();
  });

  it('reports the week in the middle of the strip as it scrolls', async () => {
    const { onWeekChange } = await renderStrip();
    // Three days back, the middle is still this week: nothing new to report.
    await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: SLOT * 3, y: 0 } } });
    expect(onWeekChange).toHaveBeenCalledTimes(1);
    // Four days back, the middle is last Sunday.
    await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: SLOT * 4, y: 0 } } });
    expect(onWeekChange).toHaveBeenLastCalledWith(day(2026, 10, 5));
    // Past the end (iOS bounce) stays on the oldest week; back to the start is this week.
    await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: 99_999, y: 0 } } });
    expect(onWeekChange).toHaveBeenLastCalledWith(day(2026, 9, 28));
    await fireEvent.scroll(list(), { nativeEvent: { contentOffset: { x: -40, y: 0 } } });
    expect(onWeekChange).toHaveBeenLastCalledWith(day(2026, 10, 12));
  });
});
