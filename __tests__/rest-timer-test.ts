import { REST_MS, restLeft, useRestTimerStore } from '@/stores/rest-timer-store';

describe('rest timer', () => {
  afterEach(() => useRestTimerStore.getState().stop());

  it('counts down for the session it was started in', () => {
    useRestTimerStore.getState().start('s1', 1_000);
    const state = useRestTimerStore.getState();
    expect(restLeft(state, 's1', 1_000)).toBe(REST_MS);
    expect(restLeft(state, 's1', 31_000)).toBe(REST_MS - 30_000);
  });

  it('never shows more than the full rest, even with a clock a tick behind', () => {
    useRestTimerStore.getState().start('s1', 10_000);
    expect(restLeft(useRestTimerStore.getState(), 's1', 9_400)).toBe(REST_MS);
  });

  it('is not shown on another session', () => {
    useRestTimerStore.getState().start('s1', 0);
    expect(restLeft(useRestTimerStore.getState(), 's2', 1_000)).toBeNull();
  });

  it('is over once the time is up', () => {
    useRestTimerStore.getState().start('s1', 0);
    expect(restLeft(useRestTimerStore.getState(), 's1', REST_MS)).toBeNull();
  });

  it('restarts from the full time when the next set is logged', () => {
    useRestTimerStore.getState().start('s1', 0);
    useRestTimerStore.getState().start('s1', 60_000);
    expect(restLeft(useRestTimerStore.getState(), 's1', 60_000)).toBe(REST_MS);
  });

  it('stops', () => {
    useRestTimerStore.getState().start('s1', 0);
    useRestTimerStore.getState().stop();
    expect(restLeft(useRestTimerStore.getState(), 's1', 1)).toBeNull();
  });
});
