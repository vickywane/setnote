import { createFont, createTamagui, createTokens } from 'tamagui';

/**
 * Design tokens from the Figma file, page "Screens v2 · White (Tamagui)": the variable
 * collections "Tamagui · light" (palette and theme) and "Tamagui · tokens" (space, radius, size).
 * Warm ink on white, hairlines instead of grey boxes, and one vermilion accent reserved for
 * "live" and personal bests. The app is light-only for the MVP.
 */
export const palette = {
  color1: '#FFFFFF',
  color2: '#F8F7F4',
  color3: '#F1EFEA',
  color4: '#E9E6E0',
  color5: '#DFDBD3',
  color6: '#D3CEC5',
  color7: '#BEB8AE',
  color8: '#A29C92',
  color9: '#847E75',
  color10: '#6A655D',
  color11: '#4B4741',
  color12: '#1B1A17',
  accent2: '#FFF3EE',
  accent4: '#FCD9CB',
  accent9: '#E5532A',
  accent11: '#A83A17',
  red2: '#FDF1EF',
  red9: '#C8382C',
  green2: '#EEF7F1',
  green9: '#2E7A4D',
  yellow2: '#FDF6E7',
  yellow11: '#8F5A06',
  // Dark surfaces for the camera screens.
  camera: '#141311',
};

/** Sheet scrim: palette/color12 at 32% (Figma "Scrim"). */
export const SCRIM = 'rgba(27, 26, 23, 0.32)';
/** Sheet shadow, Figma "Sheet · …": 0 -8 32 rgba(27,26,23,0.12). */
export const SHEET_SHADOW = '0px -8px 32px 0px rgba(27, 26, 23, 0.12)';
/** Popover menus, Figma "Session options menu": 0 8 24 rgba(27,26,23,0.10). */
export const MENU_SHADOW = '0px 8px 24px 0px rgba(27, 26, 23, 0.1)';

export const tokens = createTokens({
  color: palette,
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 48 },
  size: { 0: 0, 4: 44, 5: 52, 6: 60 },
  radius: { 0: 0, 2: 6, 3: 10, 4: 14, 6: 22, round: 999 },
  zIndex: { 0: 0, 1: 100, 2: 200 },
});

const light = {
  background: palette.color1,
  backgroundHover: palette.color2,
  backgroundPress: palette.color3,
  backgroundFocus: palette.color2,
  backgroundStrong: palette.color2,
  color: palette.color12,
  colorHover: palette.color12,
  colorPress: palette.color12,
  colorFocus: palette.color12,
  colorMuted: palette.color11,
  placeholderColor: palette.color9,
  borderColor: palette.color5,
  borderColorHover: palette.color5,
  borderColorFocus: palette.color12,
  borderColorPress: palette.color5,
  borderColorStrong: palette.color7,
};

/**
 * Font files, loaded with expo-font in the root layout. The keys are the family names
 * React Native renders with; `face` maps each weight to its file so `fontWeight` works.
 */
export const FONT_FILES = {
  'Geist-Regular': require('@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf'),
  'Geist-Medium': require('@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf'),
  'Geist-SemiBold': require('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf'),
  'GeistMono-Regular': require('@expo-google-fonts/geist-mono/400Regular/GeistMono_400Regular.ttf'),
  'GeistMono-Medium': require('@expo-google-fonts/geist-mono/500Medium/GeistMono_500Medium.ttf'),
  'Newsreader-Regular': require('@expo-google-fonts/newsreader/400Regular/Newsreader_400Regular.ttf'),
  'Newsreader-Medium': require('@expo-google-fonts/newsreader/500Medium/Newsreader_500Medium.ttf'),
} as const;

const fontScale = {
  size: { 1: 11, 2: 13, 3: 14, 4: 15, 5: 16, 6: 17, 7: 19, 8: 24, 9: 34, 10: 40 },
  lineHeight: { 1: 14, 2: 17, 3: 19, 4: 20, 5: 23, 6: 22, 7: 30, 8: 30, 9: 38, 10: 44 },
  letterSpacing: { 1: 0 },
};

/** Geist for UI. */
const bodyFont = createFont({
  family: 'Geist-Regular',
  ...fontScale,
  weight: { 1: '400', 5: '500', 6: '600' },
  face: {
    400: { normal: 'Geist-Regular' },
    500: { normal: 'Geist-Medium' },
    600: { normal: 'Geist-SemiBold' },
  },
});

/** Newsreader for titles, dates and the user's own words. */
const headingFont = createFont({
  family: 'Newsreader-Regular',
  ...fontScale,
  weight: { 1: '400', 5: '500' },
  face: {
    400: { normal: 'Newsreader-Regular' },
    500: { normal: 'Newsreader-Medium' },
  },
});

/** Geist Mono for every number, so sets line up. */
const monoFont = createFont({
  family: 'GeistMono-Regular',
  ...fontScale,
  weight: { 1: '400', 5: '500' },
  face: {
    400: { normal: 'GeistMono-Regular' },
    500: { normal: 'GeistMono-Medium' },
  },
});

export const tamaguiConfig = createTamagui({
  tokens,
  themes: { light },
  fonts: { body: bodyFont, heading: headingFont, mono: monoFont },
  defaultFont: 'body',
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  // Tamagui's documented module augmentation: an empty interface that extends the config.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default tamaguiConfig;
