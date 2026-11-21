import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import SessionScreen from '@/app/session/[id]';
import { feedback } from '@/lib/feedback';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { useRestTimerStore } from '@/stores/rest-timer-store';
import { useUndoStore } from '@/stores/undo-store';
import { tamaguiConfig } from '@/theme/tamagui.config';

const { queryBuilder } = jest.requireActual('../jest/supabase-mock');

// Reanimated doesn't run under Jest; the sheets only need to show their content when open.
jest.mock('@/components/ds/sheet', () => ({
  BottomSheet: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? children : null,
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/features/recovery/use-vitals-scan', () => ({
  recoveryCheckAvailable: () => false,
}));
jest.mock('@/lib/feedback', () => ({
  feedback: {
    select: jest.fn(),
    tick: jest.fn(),
    success: jest.fn(),
    celebrate: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const BENCH = { id: 'ex-bench', name: 'Bench press', equipment: ['barbell'], user_id: null };

const detail = () => ({
  id: 'session-1',
  title: 'Iron Climb',
  started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  ended_at: null,
  notes: null,
  session_exercises: [
    {
      id: 'se-1',
      user_id: 'user-1',
      exercise_id: 'ex-bench',
      equipment: 'barbell',
      position: 0,
      exercise: BENCH,
      notes: [],
      exercise_sets: [
        {
          id: 'set-1',
          position: 0,
          weight: 25,
          reps: 10,
          unit: 'kg',
          set_type: 'normal',
          session_exercise_id: 'se-1',
        },
      ],
    },
  ],
});

/** Last time: bench at 25 kg, so 27.5 kg is a new best. */
const LAST_TIME = [
  {
    started_at: '2026-11-10T18:00:00Z',
    session_exercises: [
      {
        equipment: 'barbell',
        exercise_sets: [{ id: 'old-1', weight: 25, reps: 10, unit: 'kg', position: 0 }],
      },
    ],
  },
];

const deletes: string[] = [];

function backend() {
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const builder = queryBuilder();
    let select = '';
    builder.select = jest.fn((columns: string) => {
      select = columns ?? '';
      return builder;
    });
    builder.delete = jest.fn(() => {
      deletes.push(table);
      return builder;
    });
    builder.single = jest.fn(() =>
      Promise.resolve(
        table === 'workout_sessions'
          ? { data: detail(), error: null }
          : // An insert that never answers: the set stays pending, as on bad signal.
            new Promise(() => {}),
      ),
    );
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({
        data: table === 'workout_sessions' && select.includes('!inner') ? LAST_TIME : [],
        error: null,
      }).then(resolve, reject);
    return builder;
  });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {children}
    </TamaguiProvider>
  </QueryClientProvider>
);

async function openSession() {
  await renderRouter(
    { 'session/[id]': SessionScreen },
    { initialUrl: '/session/session-1', wrapper },
  );
  await screen.findByText('Bench press');
}

describe('session screen feedback', () => {
  beforeEach(() => {
    queryClient.clear();
    deletes.length = 0;
    jest.clearAllMocks();
    useRestTimerStore.getState().stop();
    useUndoStore.setState({ pending: null, hidden: [] });
    backend();
  });
  afterEach(() => {
    queryClient.clear();
    (supabase.from as jest.Mock).mockImplementation(() => queryBuilder());
  });

  it('shows a logged set at once, starts the rest timer and celebrates a new best', async () => {
    await openSession();

    await fireEvent.press(screen.getByLabelText('Log a set of Bench press'));
    // Prefilled with set 1 (25 kg, as heavy as last time); one step up is a new best.
    await fireEvent.press(await screen.findByLabelText('Increase weight'));
    await fireEvent.press(screen.getByLabelText('Log set 2'));

    // The insert never answers, yet the chip is there (marked as saving) and the sheet is gone.
    expect(await screen.findByLabelText(/^Set 2: 27\.5 × 10, new best, saving$/)).toBeTruthy();
    expect(screen.queryByLabelText('Log set 2')).toBeNull();
    expect(screen.getByLabelText(/^Rest, 1:30 left/)).toBeTruthy();
    expect(feedback.celebrate).toHaveBeenCalledWith(
      'Set 2 logged, 27.5 × 10. New best on Bench press',
    );

    // The same weight again isn't a new best any more: a plain success, not a celebration.
    await fireEvent.press(screen.getByLabelText('Log a set of Bench press'));
    await fireEvent.press(await screen.findByLabelText('Log set 3'));
    expect(feedback.success).toHaveBeenCalledWith('Set 3 logged, 27.5 × 10');
    expect(feedback.celebrate).toHaveBeenCalledTimes(1);

    // Tapping the rest pill skips the rest.
    await fireEvent.press(screen.getByLabelText(/^Rest, /));
    await waitFor(() => expect(screen.queryByLabelText(/^Rest, /)).toBeNull());
  });

  it('removes an exercise with Undo instead of deleting it straight away', async () => {
    await openSession();

    await fireEvent.press(screen.getByLabelText('Bench press options'));
    await fireEvent.press(await screen.findByLabelText('Remove from this session'));

    expect(await screen.findByText('No exercises yet')).toBeTruthy();
    expect(screen.getByText('Bench press removed')).toBeTruthy();
    expect(feedback.warn).toHaveBeenCalledWith('Bench press removed. Undo available');
    expect(deletes).toEqual([]);

    await fireEvent.press(screen.getByLabelText('Undo: Bench press removed'));
    expect(await screen.findByText('Bench press')).toBeTruthy();
    expect(screen.queryByText('Bench press removed')).toBeNull();

    // Undone: nothing is deleted even once the toast would have gone.
    await act(async () => useUndoStore.getState().flush());
    expect(deletes).toEqual([]);
  });

  it('deletes a set with Undo, and only sends the delete once Undo is gone', async () => {
    await openSession();

    await fireEvent.press(screen.getByLabelText(/^Set 1: 25 × 10/));
    await fireEvent.press(await screen.findByText('Delete set 1'));

    await waitFor(() => expect(screen.queryByLabelText(/^Set 1: /)).toBeNull());
    expect(screen.getByText('Bench press set 1 deleted')).toBeTruthy();
    expect(deletes).toEqual([]);

    await act(async () => useUndoStore.getState().flush());
    expect(deletes).toEqual(['exercise_sets']);
  });
});
