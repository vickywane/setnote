import type { IconName } from '@/components/ds/icon';

export type TabDefinition = {
  /** Route in src/app/(tabs). */
  name: 'index' | 'history' | 'settings';
  label: string;
  icon: IconName;
};

/** Main tabs, Figma "Tab bar": Notes, History, Settings. Progress (VIC-65/66) isn't built yet. */
export const TABS: readonly TabDefinition[] = [
  { name: 'index', label: 'Notes', icon: 'notes' },
  { name: 'history', label: 'History', icon: 'history' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];
