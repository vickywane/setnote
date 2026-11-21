import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  isPendingSet,
  type SessionDetail,
  sessionKeys,
  useAddSet,
  useUpdateSet,
} from '@/features/sessions/api';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

const { queryBuilder } = jest.requireActual('../jest/supabase-mock');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const SESSION = {
  id: 'session-1',
  session_exercises: [
    {
      id: 'se-1',
      user_id: 'user-1',
      exercise_sets: [
        { id: 'set-1', position: 0, weight: 80, reps: 8, unit: 'kg', set_type: 'normal' },
      ],
    },
  ],
} as unknown as SessionDetail;

const detail = () => queryClient.getQueryData<SessionDetail>(sessionKeys.detail('session-1'))!;
const setsOf = () => detail().session_exercises[0].exercise_sets;

/** Every Supabase call waits until `release` is called with its result. */
function holdRequests() {
  let release: (result: { data: unknown; error: { message: string } | null }) => void = () => {};
  const held = new Promise<{ data: unknown; error: { message: string } | null }>(
    (resolve) => (release = resolve),
  );
  (supabase.from as jest.Mock).mockImplementation(() => {
    const builder = queryBuilder();
    builder.single = jest.fn(() => held);
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      held.then(resolve, reject);
    return builder;
  });
  return (result: { data: unknown; error: { message: string } | null }) => release(result);
}

describe('optimistic set logging', () => {
  beforeEach(() => {
    queryClient.clear();
    queryClient.setQueryData(sessionKeys.detail('session-1'), SESSION);
  });
  afterEach(() => {
    queryClient.clear();
    (supabase.from as jest.Mock).mockImplementation(() => queryBuilder());
  });

  it('shows a logged set before the server answers', async () => {
    const release = holdRequests();
    const { result } = await renderHook(() => useAddSet(), { wrapper });

    await act(async () => {
      result.current.mutate({
        sessionId: 'session-1',
        sessionExerciseId: 'se-1',
        position: 1,
        weight: 82.5,
        reps: 6,
        unit: 'kg',
      });
      await waitFor(() => expect(setsOf()).toHaveLength(2));
    });

    expect(setsOf()[1]).toMatchObject({ weight: 82.5, reps: 6, position: 1 });
    expect(isPendingSet(setsOf()[1])).toBe(true);

    await act(async () => release({ data: { id: 'set-2' }, error: null }));
  });

  it('takes the set back off when saving fails', async () => {
    const release = holdRequests();
    const { result } = await renderHook(() => useAddSet(), { wrapper });

    await act(async () => {
      result.current.mutate({
        sessionId: 'session-1',
        sessionExerciseId: 'se-1',
        position: 1,
        weight: 82.5,
        reps: 6,
        unit: 'kg',
      });
      await waitFor(() => expect(setsOf()).toHaveLength(2));
    });

    await act(async () => release({ data: null, error: { message: 'offline' } }));
    expect(setsOf()).toHaveLength(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('shows an edit straight away', async () => {
    const release = holdRequests();
    const { result } = await renderHook(() => useUpdateSet(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'set-1', sessionId: 'session-1', reps: 10 });
      await waitFor(() => expect(setsOf()[0]).toMatchObject({ weight: 80, reps: 10 }));
    });

    await act(async () => release({ data: null, error: null }));
  });
});
