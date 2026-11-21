import Constants from 'expo-constants';

export type AppVariant = 'development' | 'preview' | 'production';

/**
 * Runtime configuration. Only `EXPO_PUBLIC_*` values are available here, and they are
 * inlined into the bundle in plain text: never put secrets in them.
 *
 * `process.env.EXPO_PUBLIC_*` must be read with dot notation so Expo can inline it.
 */
export const env = {
  /** Which build variant is running (set from APP_VARIANT in app.config.ts). */
  appVariant: (Constants.expoConfig?.extra?.appVariant ?? 'development') as AppVariant,
  /** Supabase project URL (VIC-57). */
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  /**
   * Supabase publishable key. Safe to bundle: what each user can read and write is
   * enforced by row-level security in the database.
   */
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  /**
   * Presage SmartSpectra API key for the recovery check. Bundled in plain text like the
   * values above; Presage recommends OAuth for production. Empty hides the check.
   */
  presageApiKey: process.env.EXPO_PUBLIC_PRESAGE_API_KEY ?? '',
} as const;

export const isDevelopment = env.appVariant === 'development';
