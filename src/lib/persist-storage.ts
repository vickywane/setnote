import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/**
 * AsyncStorage's web adapter requires `window.localStorage`. Expo static rendering runs
 * stores on the server too, where `window` does not exist; use an ephemeral adapter there.
 */
const serverStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export function getAppStorage(): StateStorage {
  if (typeof window === 'undefined') return serverStorage;
  return AsyncStorage;
}
