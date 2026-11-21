import { AbsoluteFill, useVideoConfig } from 'remotion';

import { color, font } from '../theme';
import { Rise } from './common';

/** One line at a time, each landing a beat after the last. */
export function ProblemCard({ lines }: { lines: string[] }) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{ backgroundColor: color.paper, justifyContent: 'center', paddingLeft: 220, gap: 36 }}>
      {lines.map((line, i) => (
        <Rise key={line} delay={Math.round(i * 1.4 * fps)}>
          <div
            style={{
              fontFamily: font.display,
              fontSize: 92,
              lineHeight: 1.1,
              color: i === lines.length - 1 ? color.accent : color.ink,
            }}>
            {line}
          </div>
        </Rise>
      ))}
    </AbsoluteFill>
  );
}
