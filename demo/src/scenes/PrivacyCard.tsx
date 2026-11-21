import { AbsoluteFill } from 'remotion';

import { color, font } from '../theme';
import { Overline, Rise } from './common';

/** The consent and data-handling facts, in the app's own words (recovery-check screen). */
const POINTS = [
  'The front camera runs for 45 seconds after you tap Start.',
  'SmartSpectra processes video on your phone. Video is never sent to Presage.',
  'Check videos are not saved unless you opt in.',
  'Only readings sync. Delete them with the exercise, session or account.',
  'SDK telemetry is off. Presage is contacted only for licence validation.',
];

export function PrivacyCard() {
  return (
    <AbsoluteFill
      style={{ backgroundColor: color.paper, justifyContent: 'center', padding: '0 220px', gap: 28 }}>
      <Rise>
        <Overline tone={color.accent}>Consent and data</Overline>
      </Rise>
      {POINTS.map((point, i) => (
        <Rise key={point} delay={10 + i * 18}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
            <div style={{ fontFamily: font.mono, fontSize: 30, color: color.muted, width: 40 }}>
              {i + 1}
            </div>
            <div style={{ fontFamily: font.body, fontSize: 36, lineHeight: 1.28, color: color.ink }}>
              {point}
            </div>
          </div>
        </Rise>
      ))}
    </AbsoluteFill>
  );
}
