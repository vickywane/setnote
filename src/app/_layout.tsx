import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TamaguiProvider, YStack } from 'tamagui';

import { Button } from '@/components/ds/controls';
import { AppText } from '@/components/ds/text';
import { listenToAuthChanges, useAuthStore } from '@/features/auth/auth-store';
import { startPauseSync } from '@/features/sessions/pause-sync';
import { setAnalyticsConsent, track } from '@/lib/analytics';
import {
  listenToConnectivity,
  persistOptions,
  queryClient,
  resumeSavedWork,
} from '@/lib/query-client';
import { supabaseConfigured } from '@/lib/supabase';
import { usePreferencesStore } from '@/stores/preferences-store';
import { FONT_FILES, palette, tamaguiConfig } from '@/theme/tamagui.config';

SplashScreen.preventAutoHideAsync();

/** White pages with warm ink, as in the design. Light-only for the MVP. */
const NAVIGATION_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.color12,
    background: palette.color1,
    card: palette.color1,
    text: palette.color12,
    border: palette.color5,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);

  useEffect(() => {
    listenToConnectivity();
    startPauseSync();
    // Usage events only with the user's opt-in, kept in sync with the Settings switch.
    const syncConsent = () => setAnalyticsConsent(usePreferencesStore.getState().shareUsage);
    syncConsent();
    const unsubscribe = usePreferencesStore.subscribe(syncConsent);
    track('app_opened');
    return unsubscribe;
  }, []);

  return (
    // Gesture root for swipe actions (exercise cards).
    <GestureHandlerRootView style={styles.root}>
      {/* The cache and saves made offline are kept on the device and resumed on launch. */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={() => void resumeSavedWork()}>
        {/* Light-only for the MVP (dark mode is out of scope in the design notes). */}
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <ThemeProvider value={NAVIGATION_THEME}>
            <StatusBar style="dark" />
            <AuthGate ready={fontsLoaded || !!fontError}>
              {/* Screens draw their own nav rows (Figma "Nav"), so native headers are off. */}
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="session/[id]" />
                <Stack.Screen name="note/[id]" />
                <Stack.Screen name="exercise-note/[id]" />
                <Stack.Screen name="recovery-check/[sessionId]" />
                <Stack.Screen name="recovery-video/[checkId]" options={{ presentation: 'modal' }} />
              </Stack>
            </AuthGate>
          </ThemeProvider>
        </TamaguiProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Every screen needs a user (a guest at least), so hold the splash screen until the saved
 * session is restored or a guest session is started.
 */
function AuthGate({ children, ready }: { children: ReactNode; ready: boolean }) {
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const start = useAuthStore((state) => state.start);

  useEffect(() => {
    listenToAuthChanges();
    void start();
  }, [start]);

  useEffect(() => {
    if (status !== 'loading' && ready) {
      SplashScreen.hideAsync();
    }
  }, [status, ready]);

  if (status === 'loading' || !ready) return null;

  if (status === 'error') {
    return (
      <YStack flex={1} justifyContent="center" gap="$4" padding="$6" backgroundColor="$background">
        <AppText variant="title">
          {supabaseConfigured ? 'Can’t connect' : 'Supabase setup needed'}
        </AppText>
        <AppText color="$colorMuted">
          {supabaseConfigured
            ? 'Setnote can’t start a guest session right now. Check your connection, then retry.'
            : 'Copy .env.example to .env.local, add your Supabase URL and publishable key, then restart Setnote.'}
        </AppText>
        <AppText variant="caption" color="$color9">
          {error}
        </AppText>
        {supabaseConfigured && <Button label="Try again" onPress={() => void start()} />}
      </YStack>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
