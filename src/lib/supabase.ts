import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/config/env';
import type { Database } from '@/types/database';

export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);

// SQLite-backed localStorage is needed on native. Importing its web shim during Expo's
// server render touches `window`; the browser already provides localStorage itself.
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- avoid loading native storage during web SSR
  require('expo-sqlite/localStorage/install');
}

/**
 * The app's Supabase client. The auth session is saved on the device (expo-sqlite's
 * localStorage) so users, including guests, stay signed in across launches.
 */
// Keep the module importable so the app can render an actionable missing-config screen.
// Auth startup is explicitly blocked until both real values are present.
export const supabase = createClient<Database>(
  env.supabaseUrl || 'https://configuration-required.invalid',
  env.supabasePublishableKey || 'configuration-required',
  {
    auth: {
      // Browser localStorage is absent during Expo's server render; native installs it
      // through expo-sqlite/localStorage/install above.
      storage: typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Only refresh the auth token while the app is in the foreground, as Supabase recommends.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
