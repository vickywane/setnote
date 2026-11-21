import { AbsoluteFill } from 'remotion';

import { color, font } from '../theme';
import { Overline, Paper, Rise } from './common';

export function Outro({ repoUrl }: { repoUrl: string }) {
  return (
    <AbsoluteFill>
      <Paper>
        <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 220, gap: 28 }}>
          <Rise>
            <div style={{ fontFamily: font.display, fontSize: 160, color: color.ink, lineHeight: 1 }}>
              Setnote
            </div>
          </Rise>
          <Rise delay={8}>
            <div style={{ fontFamily: font.body, fontSize: 44, color: color.inkSoft }}>
              Built with Expo, Supabase and Presage SmartSpectra.
            </div>
          </Rise>
          {repoUrl && (
            <Rise delay={16}>
              <div style={{ fontFamily: font.mono, fontSize: 38, color: color.ink }}>{repoUrl}</div>
            </Rise>
          )}
          <Rise delay={24}>
            <Overline tone={color.accent}>#presagechallenge</Overline>
          </Rise>
        </AbsoluteFill>
      </Paper>
    </AbsoluteFill>
  );
}
