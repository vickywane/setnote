import { isDevelopment } from '@/config/env';

/**
 * Privacy-friendly analytics facade. Feature code calls `track()` with an event name and
 * small, non-identifying properties; it never sends note text, exercise details or other
 * health data.
 *
 * Events reach a provider only when one is set with `setAnalyticsProvider` and the user has
 * opted in ("Share anonymous usage" in Settings, off by default; the row only shows once a
 * provider is set). In development, events are also logged to the console.
 */
export type AnalyticsEvent =
  | 'app_opened'
  | 'session_started'
  | 'session_finished'
  | 'set_logged'
  | 'note_saved'
  | 'recovery_check_consented'
  | 'recovery_check_saved';

export type AnalyticsProperties = Record<string, string | number | boolean>;

export interface AnalyticsProvider {
  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void;
}

let provider: AnalyticsProvider | null = null;
let hasConsent = false;

export function setAnalyticsProvider(next: AnalyticsProvider | null) {
  provider = next;
}

/** Whether a provider is set, i.e. whether asking for consent means anything. */
export function hasAnalyticsProvider() {
  return provider !== null;
}

export function setAnalyticsConsent(consent: boolean) {
  hasConsent = consent;
}

export function track(event: AnalyticsEvent, properties?: AnalyticsProperties) {
  if (isDevelopment) {
    console.log(`[analytics] ${event}`, properties ?? {});
  }
  if (hasConsent && provider) {
    provider.track(event, properties);
  }
}
