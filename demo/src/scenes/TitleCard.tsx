import { AbsoluteFill } from 'remotion';

import { color, font } from '../theme';
import { Overline, Paper, Rise } from './common';

export function TitleCard() {
  return (
    <AbsoluteFill>
      <Paper>
        <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 220, gap: 28 }}>
          <Rise>
            <Overline tone={color.accent}>Presage SmartSpectra SDK Challenge</Overline>
          </Rise>
          <Rise delay={6}>
            <div style={{ fontFamily: font.display, fontSize: 200, color: color.ink, lineHeight: 1 }}>
              Setnote
            </div>
          </Rise>
          <Rise delay={14}>
            <div style={{ fontFamily: font.body, fontSize: 48, color: color.inkSoft, maxWidth: 1200 }}>
              Your log shows what you lifted. Setnote shows what it took.
            </div>
          </Rise>
        </AbsoluteFill>
      </Paper>
    </AbsoluteFill>
  );
}
