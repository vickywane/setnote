import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

/**
 * One place for the app's feedback, so the same kind of event always feels the same: each
 * moment pairs a haptic with an announcement for VoiceOver/TalkBack, and never relies on motion
 * alone. Haptics are best-effort (iOS skips them in Low Power Mode, while the camera or dictation
 * is on, or when the user turned them off), so nothing here may throw.
 */

function buzz(run: () => Promise<void> | void) {
  try {
    void Promise.resolve(run()).catch(() => {});
  } catch {
    // No haptics on this device or platform.
  }
}

function announce(message?: string) {
  if (!message) return;
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // No screen reader bridge (tests, web).
  }
}

export const feedback = {
  /** A value or choice changed: steppers, chips, tabs. */
  select: () => buzz(() => Haptics.selectionAsync()),
  /** A light tick, e.g. the rest timer about to run out. */
  tick: (message?: string) => {
    buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    announce(message);
  },
  /** Something was saved or done: a set logged, a session finished. */
  success: (message?: string) => {
    buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    announce(message);
  },
  /** A genuine achievement (a new best). Heavier than success, and kept rare. */
  celebrate: (message?: string) => {
    buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    announce(message);
  },
  /** Something was removed and can still be undone. */
  warn: (message?: string) => {
    buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    announce(message);
  },
  /** Something failed. */
  error: (message?: string) => {
    buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    announce(message);
  },
};
