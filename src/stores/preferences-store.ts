import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getAppStorage } from '@/lib/persist-storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export type WeightUnit = 'kg' | 'lb';

type PreferencesState = {
  themePreference: ThemePreference;
  /** Unit for new sets. Each set keeps the unit it was logged in. */
  weightUnit: WeightUnit;
  setThemePreference: (preference: ThemePreference) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  /** Opt-in to anonymous usage events (see lib/analytics). Off until the user turns it on. */
  shareUsage: boolean;
  setShareUsage: (share: boolean) => void;
};

/**
 * Small device-level preferences, kept in AsyncStorage. Workout data does not belong
 * here: it's stored in Supabase.
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themePreference: 'system',
      weightUnit: 'kg',
      setThemePreference: (themePreference) => set({ themePreference }),
      setWeightUnit: (weightUnit) => set({ weightUnit }),
      shareUsage: false,
      setShareUsage: (shareUsage) => set({ shareUsage }),
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(getAppStorage),
      version: 3,
      // v1 had no weight unit and v2 no usage opt-in; zustand merges in the defaults ('kg',
      // not sharing) for missing fields.
      migrate: (persisted) => persisted as PreferencesState,
    },
  ),
);
