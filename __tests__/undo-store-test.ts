import { UNDO_MS, useUndoStore } from '@/stores/undo-store';

const flushPromises = () =>
  new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve));

describe('undo store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useUndoStore.setState({ pending: null, hidden: [] });
  });
  afterEach(() => jest.useRealTimers());

  it('hides the rows straight away and deletes only once Undo has gone', async () => {
    const commit = jest.fn(() => Promise.resolve());
    useUndoStore.getState().remove({ message: 'Bench press removed', ids: ['a'], commit });

    expect(useUndoStore.getState().hidden).toEqual(['a']);
    expect(useUndoStore.getState().pending?.message).toBe('Bench press removed');
    expect(commit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(UNDO_MS);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(useUndoStore.getState().pending).toBeNull();
    // Still hidden until the delete has landed, so the row can't flash back.
    expect(useUndoStore.getState().hidden).toEqual(['a']);

    await flushPromises();
    expect(useUndoStore.getState().hidden).toEqual([]);
  });

  it('Undo brings the rows back and never deletes', () => {
    const commit = jest.fn(() => Promise.resolve());
    useUndoStore.getState().remove({ message: 'Set 2 deleted', ids: ['s2'], commit });
    useUndoStore.getState().undo();
    jest.advanceTimersByTime(UNDO_MS * 2);

    expect(commit).not.toHaveBeenCalled();
    expect(useUndoStore.getState()).toMatchObject({ pending: null, hidden: [] });
  });

  it('a second removal commits the first one right away', () => {
    const first = jest.fn(() => Promise.resolve());
    const second = jest.fn(() => Promise.resolve());
    useUndoStore.getState().remove({ message: 'first', ids: ['a'], commit: first });
    useUndoStore.getState().remove({ message: 'second', ids: ['b'], commit: second });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(useUndoStore.getState().pending?.message).toBe('second');
    expect(useUndoStore.getState().hidden).toEqual(['a', 'b']);

    // Undo only brings back the latest removal.
    useUndoStore.getState().undo();
    expect(useUndoStore.getState().hidden).toEqual(['a']);
  });

  it('shows the rows again and reports it when the delete fails', async () => {
    const onError = jest.fn();
    useUndoStore.getState().remove({
      message: 'Set 1 deleted',
      ids: ['s1'],
      commit: () => Promise.reject(new Error('offline')),
      onError,
    });
    useUndoStore.getState().flush();
    await flushPromises();

    expect(useUndoStore.getState().hidden).toEqual([]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'offline' }));
  });
});
