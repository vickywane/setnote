import type { CSSProperties, ReactNode } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { color, font } from '../theme';

/** Fades and lifts its children in, `delay` frames after the scene starts. */
export function Rise({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        opacity: t,
        transform: `translateY(${interpolate(t, [0, 1], [24, 0])}px)`,
        ...style,
      }}>
      {children}
    </div>
  );
}

export function Overline({ children, tone = color.muted }: { children: ReactNode; tone?: string }) {
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: 26,
        letterSpacing: 4,
        color: tone,
        textTransform: 'uppercase',
      }}>
      {children}
    </div>
  );
}

/** Ruled notebook lines, as on the app's note paper. */
export function Paper({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: color.paper2,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 63px, ${color.line} 63px 64px)`,
      }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 140,
          width: 2,
          backgroundColor: '#F3C9B9',
        }}
      />
      {children}
    </div>
  );
}
