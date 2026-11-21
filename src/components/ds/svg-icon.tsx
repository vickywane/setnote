import { Image, type ImageSource } from 'expo-image';

type SvgIconProps = {
  /** A `require()`d SVG exported from the Figma file. */
  source: ImageSource | number;
  size?: number;
  width?: number;
  height?: number;
};

/**
 * Renders an SVG asset exported from Figma at its design size. Colours live in the SVG
 * itself, exactly as designed.
 */
export function SvgIcon({ source, size = 24, width, height }: SvgIconProps) {
  return (
    <Image
      source={source}
      style={{ width: width ?? size, height: height ?? size }}
      contentFit="contain"
      accessible={false}
    />
  );
}
