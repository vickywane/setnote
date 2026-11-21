import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getAppStorage } from '@/lib/persist-storage';

type RecoveryConsentState = {
  /** When the person agreed to the recovery check's camera use, or null if they haven't. */
  consentedAt: string | null;
  /** Never offer the check after finishing a session. */
  dismissed: boolean;
  /**
   * Offer to save a video of each check (Settings › Save check videos). Off by default; each
   * check can still be saved without one.
   */
  saveVideos: boolean;
  consent: () => void;
  withdraw: () => void;
  setDismissed: (dismissed: boolean) => void;
  setSaveVideos: (saveVideos: boolean) => void;
};

/** On this device only: the consent is asked for again on a new phone. */
export const useRecoveryConsentStore = create<RecoveryConsentState>()(
  persist(
    (set) => ({
      consentedAt: null,
      dismissed: false,
      saveVideos: false,
      consent: () => set({ consentedAt: new Date().toISOString(), dismissed: false }),
      // Withdrawing consent also stops saving videos; it has to be turned on again.
      withdraw: () => set({ consentedAt: null, saveVideos: false }),
      setDismissed: (dismissed) => set({ dismissed }),
      setSaveVideos: (saveVideos) => set({ saveVideos }),
    }),
    {
      name: 'recovery-consent',
      storage: createJSONStorage(getAppStorage),
      version: 1,
    },
  ),
);
