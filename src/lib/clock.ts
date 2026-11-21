import { getCalendars } from 'expo-localization';

/**
 * Whether the device is set to a 24-hour clock. Read on every call: Android lets the user
 * flip the setting while the app runs. Falls back to the locale's default when the OS
 * doesn't say.
 */
export function uses24HourClock() {
  const fromDevice = getCalendars()[0]?.uses24hourClock;
  if (typeof fromDevice === 'boolean') return fromDevice;
  const { hourCycle } = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
  return hourCycle === 'h23' || hourCycle === 'h24';
}

/** Time of day in the device's clock format: "19:10" or "7:10 PM". */
export function clockTime(date: Date, use24h = uses24HourClock()) {
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (use24h) return `${String(date.getHours()).padStart(2, '0')}:${minutes}`;
  const hours = date.getHours() % 12 || 12;
  return `${hours}:${minutes} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
}
