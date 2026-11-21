import { useSessionPauseStore } from '@/stores/session-pause-store';

describe('session pause seed', () => {
  beforeEach(() => useSessionPauseStore.setState({ sessions: {} }));

  it('takes pauses from the account for a session this phone has none for', () => {
    useSessionPauseStore.getState().seed('a', { pausedAt: 1_000, pausedMs: 500 });
    expect(useSessionPauseStore.getState().sessions.a).toEqual({ pausedAt: 1_000, pausedMs: 500 });
  });

  it("never overwrites this phone's own pauses", () => {
    const store = useSessionPauseStore.getState();
    store.pause('a', 2_000);
    store.resume('a', 3_000);
    store.seed('a', { pausedAt: 1_000, pausedMs: 99 });
    expect(useSessionPauseStore.getState().sessions.a).toEqual({ pausedAt: null, pausedMs: 1_000 });
  });
});
