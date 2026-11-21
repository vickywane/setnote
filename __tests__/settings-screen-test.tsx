import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { usePreferencesStore } from '@/stores/preferences-store';

import { QueryWrapper } from '../jest/test-utils';

// Reanimated doesn't run under Jest; the sheets only need to show their content when open.
jest.mock('@/components/ds/sheet', () => ({
  BottomSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? children : null,
}));
// Two sessions, one written note and one custom exercise, without a backend.
jest.mock('@/features/sessions/api', () => ({
  useSessions: () => ({ data: [{ id: 's1' }, { id: 's2' }] }),
}));
jest.mock('@/features/notes/api', () => ({
  useNotes: () => ({
    data: [
      { id: 'n1', body: 'Curls 32kg' },
      { id: 'n2', body: ' ' },
    ],
  }),
}));
jest.mock('@/features/catalog/api', () => ({
  useExercises: () => ({
    data: [
      { id: 'e1', user_id: 'me' },
      { id: 'e2', user_id: null },
    ],
  }),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

describe('SettingsScreen', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ weightUnit: 'kg' });
  });

  it('switches the weight unit from its row', async () => {
    await render(<SettingsScreen />, { wrapper: QueryWrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Weight unit, kg' }));

    expect(usePreferencesStore.getState().weightUnit).toBe('lb');
    expect(screen.getByRole('button', { name: 'Weight unit, lb' })).toBeVisible();
  });

  it('offers guests a way to keep their workouts', async () => {
    await render(<SettingsScreen />, { wrapper: QueryWrapper });

    expect(screen.getByText('You’re logging as a guest')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add an email' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'I have an account' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete my data' })).toBeVisible();
    expect(screen.getByText(/Your 2 sessions and 1 note are tied to this phone/)).toBeVisible();
  });

  it('confirms before deleting, naming what goes', async () => {
    await render(<SettingsScreen />, { wrapper: QueryWrapper });

    await fireEvent.press(screen.getByRole('button', { name: 'Delete my data' }));

    expect(
      screen.getByText(/2 sessions, 1 note and 1 custom exercise from this phone/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep my data' })).toBeVisible();
  });
});
