import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { queryClient } from '@/lib/query-client';
import { supabase, supabaseConfigured } from '@/lib/supabase';

type AuthStatus = 'loading' | 'ready' | 'error';

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  error: string | null;
  /** Restores the saved session, or starts a guest session if there is none. */
  start: () => Promise<void>;
};

/**
 * Guest mode (VIC-60) uses Supabase anonymous users: everyone gets a user id straight
 * away, with no sign-up. Creating an account later links an email to the same user, so
 * a guest's data carries over without any migration.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  session: null,
  error: null,
  start: async () => {
    set({ status: 'loading', error: null });
    if (!supabaseConfigured) {
      set({
        status: 'error',
        error:
          'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the app.',
      });
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }
    if (data.session) {
      set({ status: 'ready', session: data.session });
      return;
    }
    const guest = await supabase.auth.signInAnonymously();
    if (guest.error) {
      set({ status: 'error', error: guest.error.message });
      return;
    }
    set({ status: 'ready', session: guest.data.session });
  },
}));

let listening = false;

/** Keeps the store in sync with Supabase auth (sign-in, sign-out, token refresh). */
export function listenToAuthChanges() {
  if (listening) return;
  listening = true;
  let userId: string | null | undefined;
  supabase.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user.id ?? null;
    // Another user's data may be cached (also the copy kept on the device); start clean.
    // Only when the user really changes: a refresh or a repeat SIGNED_IN for the same user
    // would otherwise drop saves still waiting for a connection.
    const changed = userId !== undefined && nextUserId !== null && nextUserId !== userId;
    if (event === 'SIGNED_OUT' || changed) queryClient.clear();
    if (nextUserId !== null || event === 'SIGNED_OUT') userId = nextUserId;
    if (session) {
      useAuthStore.setState({ status: 'ready', session, error: null });
    } else if (event === 'SIGNED_OUT') {
      useAuthStore.setState({ session: null });
      // Always have a user: signing out drops back to a fresh guest session.
      void useAuthStore.getState().start();
    }
  });
}

export function useUser(): User | null {
  return useAuthStore((state) => state.session?.user ?? null);
}

export function isGuest(user: User | null) {
  return user?.is_anonymous ?? true;
}
