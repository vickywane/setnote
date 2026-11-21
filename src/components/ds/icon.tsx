import { Image } from 'expo-image';

import { palette } from '@/theme/tamagui.config';

/**
 * Interface icons from the Figma "Components v2 / Icons" row (Lucide-style, 1.75 stroke on a
 * 24pt grid). Each SVG is drawn in ink; `color` tints it to any palette colour.
 */
const ICONS = {
  plus: require('../../../assets/icons/v2/plus.svg'),
  minus: require('../../../assets/icons/v2/minus.svg'),
  x: require('../../../assets/icons/v2/x.svg'),
  'chevron-right': require('../../../assets/icons/v2/chevron-right.svg'),
  'chevron-left': require('../../../assets/icons/v2/chevron-left.svg'),
  search: require('../../../assets/icons/v2/search.svg'),
  more: require('../../../assets/icons/v2/more.svg'),
  check: require('../../../assets/icons/v2/check.svg'),
  notes: require('../../../assets/icons/v2/notes.svg'),
  history: require('../../../assets/icons/v2/history.svg'),
  progress: require('../../../assets/icons/v2/progress.svg'),
  settings: require('../../../assets/icons/v2/settings.svg'),
  timer: require('../../../assets/icons/v2/timer.svg'),
  note: require('../../../assets/icons/v2/note.svg'),
  dumbbell: require('../../../assets/icons/v2/dumbbell.svg'),
  trash: require('../../../assets/icons/v2/trash.svg'),
  info: require('../../../assets/icons/v2/info.svg'),
  pencil: require('../../../assets/icons/v2/pencil.svg'),
  image: require('../../../assets/icons/v2/image.svg'),
  mic: require('../../../assets/icons/v2/mic.svg'),
  stop: require('../../../assets/icons/v2/stop.svg'),
  pause: require('../../../assets/icons/v2/pause.svg'),
  play: require('../../../assets/icons/v2/play.svg'),
  share: require('../../../assets/icons/v2/share.svg'),
  refresh: require('../../../assets/icons/v2/refresh.svg'),
  user: require('../../../assets/icons/v2/user.svg'),
  heart: require('../../../assets/icons/v2/heart.svg'),
} as const;

/**
 * Exports of resized instances. Figma keeps the 1.75 stroke when an icon is resized, so an
 * 18pt icon isn't a scaled-down 24pt one; these are used at exactly that size.
 */
const SIZED: Record<string, number> = {
  'check@16': require('../../../assets/icons/v2/check@16.svg'),
  'check@18': require('../../../assets/icons/v2/check@18.svg'),
  'chevron-right@18': require('../../../assets/icons/v2/chevron-right@18.svg'),
  'image@22': require('../../../assets/icons/v2/image@22.svg'),
  'mic@30': require('../../../assets/icons/v2/mic@30.svg'),
  'minus@18': require('../../../assets/icons/v2/minus@18.svg'),
  'notes@22': require('../../../assets/icons/v2/notes@22.svg'),
  'pause@22': require('../../../assets/icons/v2/pause@22.svg'),
  'pause@28': require('../../../assets/icons/v2/pause@28.svg'),
  'pencil@20': require('../../../assets/icons/v2/pencil@20.svg'),
  'play@18': require('../../../assets/icons/v2/play@18.svg'),
  'play@20': require('../../../assets/icons/v2/play@20.svg'),
  'plus@14': require('../../../assets/icons/v2/plus@14.svg'),
  'plus@18': require('../../../assets/icons/v2/plus@18.svg'),
  'refresh@20': require('../../../assets/icons/v2/refresh@20.svg'),
  'search@18': require('../../../assets/icons/v2/search@18.svg'),
  'search@22': require('../../../assets/icons/v2/search@22.svg'),
  'share@20': require('../../../assets/icons/v2/share@20.svg'),
  'share@22': require('../../../assets/icons/v2/share@22.svg'),
  'user@20': require('../../../assets/icons/v2/user@20.svg'),
  'trash@20': require('../../../assets/icons/v2/trash@20.svg'),
  'x@16': require('../../../assets/icons/v2/x@16.svg'),
  'x@18': require('../../../assets/icons/v2/x@18.svg'),
  'x@22': require('../../../assets/icons/v2/x@22.svg'),
};

export type IconName = keyof typeof ICONS;
export type PaletteColor = keyof typeof palette;

export function Icon({
  name,
  size = 24,
  color = 'color12',
}: {
  name: IconName;
  size?: number;
  color?: PaletteColor;
}) {
  return (
    <Image
      source={SIZED[`${name}@${size}`] ?? ICONS[name]}
      style={{ width: size, height: size }}
      tintColor={palette[color]}
      contentFit="contain"
      // Decorative: the control around the icon carries the accessibility label.
      accessible={false}
    />
  );
}
