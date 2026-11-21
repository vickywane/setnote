import { renderRouter, screen } from 'expo-router/testing-library';

import HistoryScreen from '@/app/(tabs)/history';
import NotesHomeScreen from '@/app/(tabs)/index';
import SettingsScreen from '@/app/(tabs)/settings';

import { QueryWrapper } from '../jest/test-utils';

const routes = {
  index: NotesHomeScreen,
  history: HistoryScreen,
  settings: SettingsScreen,
};

/**
 * With @testing-library/react-native v14, render is async and expo-router attaches its
 * helpers (getPathname etc.) to the returned promise rather than the resolved value.
 * Await the render, but keep the promise for router assertions.
 */
async function renderApp(initialUrl?: string) {
  const router = renderRouter(routes, { initialUrl, wrapper: QueryWrapper });
  await router;
  // Wrapped so the async function doesn't unwrap the promise again.
  return { router };
}

describe('navigation', () => {
  beforeEach(() => {
    // 9:41 in the morning, as in the designs.
    jest.useFakeTimers({
      now: new Date(2026, 9, 16, 9, 41),
      doNotFake: ['nextTick', 'setImmediate'],
    });
  });
  afterEach(() => jest.useRealTimers());

  it('opens on the Notes home screen with today and the ways to log', async () => {
    const { router } = await renderApp();

    expect(router).toHavePathname('/');
    expect(screen.getByRole('heading', { name: 'Today' })).toBeVisible();
    expect(screen.getByText('FRI 16 OCT · WEEK 42')).toBeVisible();
    expect(screen.getByText('Log sets')).toBeVisible();
    expect(screen.getByText('Write it down')).toBeVisible();
  });

  it.each([
    ['/history', 'heading', 'History'],
    ['/settings', 'heading', 'Settings'],
  ] as const)('renders %s', async (initialUrl, role, title) => {
    const { router } = await renderApp(initialUrl);

    expect(router).toHavePathname(initialUrl);
    expect(screen.getByRole(role, { name: title })).toBeVisible();
  });
});
