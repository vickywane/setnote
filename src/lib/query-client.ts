import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  defaultShouldDehydrateMutation,
  type Mutation,
  onlineManager,
  QueryClient,
} from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

import { getAppStorage } from '@/lib/persist-storage';

const isTest = process.env.NODE_ENV === 'test';

/** How long cached data and saves waiting for a connection are kept on the device. */
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Gym Wi-Fi is often poor: don't hammer the network, and keep showing cached data.
      retry: 2,
      staleTime: 30_000,
      // Kept as long as the saved copy on the device, so the persisted cache isn't emptied
      // early. Avoid cache timers keeping Jest workers alive after screen tests.
      gcTime: isTest ? Infinity : CACHE_MAX_AGE,
    },
    mutations: {
      // Offline, a save waits (paused) and runs when the connection is back, instead of
      // failing and being rolled back. See `listenToConnectivity`.
      networkMode: 'online',
      gcTime: isTest ? Infinity : undefined,
    },
  },
});

let listening = false;

/**
 * React Native has no browser `online` events, so TanStack Query would always think it's
 * online and offline saves would fail. Feed it the device's connection state instead.
 */
export function listenToConnectivity() {
  if (listening || isTest) return;
  listening = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null while unknown; only treat a definite "no" as offline.
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );
}

/**
 * Saves that can be kept across an app restart: paused ones whose key has a registered
 * `mutationFn` (see `queryClient.setMutationDefaults`), so they can run again after loading.
 */
function canResumeLater(mutation: Mutation<unknown, Error, unknown, unknown>) {
  const key = mutation.options.mutationKey;
  return (
    defaultShouldDehydrateMutation(mutation) &&
    !!key &&
    !!queryClient.getMutationDefaults(key).mutationFn
  );
}

/** Keeps the cache and waiting saves on the device, so they survive the app being killed. */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({
    // AsyncStorage on the device; a no-op store during static web rendering.
    storage: getAppStorage() as Parameters<typeof createAsyncStoragePersister>[0]['storage'],
    key: 'setnote-query-cache',
  }),
  maxAge: CACHE_MAX_AGE,
  // Change when cached data shapes change, so old caches are dropped instead of misread.
  buster: 'v1',
  dehydrateOptions: { shouldDehydrateMutation: canResumeLater },
};

/** Once the saved cache has loaded: run saves that were waiting, then refresh. */
export async function resumeSavedWork() {
  await queryClient.resumePausedMutations();
  await queryClient.invalidateQueries();
}

/**
 * Throws the Supabase error so React Query treats it as a failed request. Without an
 * error, Supabase returns data (null only for writes that don't select anything).
 */
export function unwrap<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
): NonNullable<R['data']> {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data as NonNullable<R['data']>;
}
