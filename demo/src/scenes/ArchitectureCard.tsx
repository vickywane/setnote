import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { color, font } from '../theme';
import { Overline, Rise } from './common';

/** How the app reaches SmartSpectra, left to right (see modules/presage-vitals). */
const NODES = [
  { title: 'Front camera', detail: 'iPhone · AVFoundation', device: true },
  { title: 'SmartSpectra SDK', detail: 'Presage · runs on the phone', device: true, accent: true },
  { title: 'PresageVitals', detail: 'Native Expo module · Swift', device: true },
  { title: 'Setnote app', detail: 'React Native · Expo', device: true },
  { title: 'Supabase', detail: 'Only the numbers sync · Postgres + RLS', device: false },
];
/** What travels along each arrow. */
const LINKS = ['frames', 'vitals', 'readings', ''];

const NODE_W = 250;
const NODE_H = 170;
const GAP = 120;
const LEFT = (1920 - (NODES.length * NODE_W + (NODES.length - 1) * GAP)) / 2;
const TOP = 430;
/** Frames between each node appearing. */
const STEP = 9;

export function ArchitectureCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const show = (i: number) => spring({ frame: frame - 10 - i * STEP, fps, config: { damping: 18 } });
  const deviceWidth = 4 * NODE_W + 3 * GAP + 40;
  const deviceIn = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: color.ink }}>
      <AbsoluteFill style={{ padding: '120px 0 0 220px', gap: 20 }}>
        <Rise>
          <Overline tone="#F59A7B">Under the hood</Overline>
        </Rise>
        <Rise delay={4}>
          <div style={{ fontFamily: font.display, fontSize: 84, color: color.paper, lineHeight: 1.05 }}>
            On-device vitals, synced as numbers
          </div>
        </Rise>
      </AbsoluteFill>

      {/* Everything on the phone sits inside one outline. */}
      <div
        style={{
          position: 'absolute',
          left: LEFT - 20,
          top: TOP - 60,
          width: deviceWidth,
          height: NODE_H + 100,
          borderRadius: 28,
          border: '2px dashed rgba(245,154,123,0.55)',
          opacity: deviceIn,
        }}>
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 24,
            fontFamily: font.mono,
            fontSize: 22,
            letterSpacing: 3,
            color: '#F59A7B',
          }}>
          ON THE PHONE · VIDEO IS PROCESSED HERE
        </div>
      </div>

      {NODES.map((node, i) => {
        const t = show(i);
        return (
          <div
            key={node.title}
            style={{
              position: 'absolute',
              left: LEFT + i * (NODE_W + GAP),
              top: TOP,
              width: NODE_W,
              height: NODE_H,
              borderRadius: 20,
              padding: '22px 22px',
              boxSizing: 'border-box',
              backgroundColor: node.accent ? color.accent : '#2A2824',
              border: `2px solid ${node.accent ? color.accent : '#4B4741'}`,
              opacity: t,
              transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px) scale(${interpolate(t, [0, 1], [0.92, 1])})`,
            }}>
            <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 29, color: color.paper }}>
              {node.title}
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: font.body,
                fontSize: 21,
                lineHeight: 1.3,
                color: node.accent ? '#FFE4D9' : '#BEB8AE',
              }}>
              {node.detail}
            </div>
          </div>
        );
      })}

      {LINKS.map((label, i) => {
        const t = interpolate(frame - 10 - (i + 1) * STEP, [0, 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const x = LEFT + (i + 1) * NODE_W + i * GAP;
        return (
          <div key={label} style={{ position: 'absolute', left: x, top: TOP + NODE_H / 2 - 2 }}>
            <div
              style={{
                width: GAP * t,
                height: 4,
                backgroundColor: i === 3 ? color.paper : '#F59A7B',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: GAP - 4,
                top: -8,
                width: 0,
                height: 0,
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderLeft: `14px solid ${i === 3 ? color.paper : '#F59A7B'}`,
                opacity: t,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 18,
                left: GAP / 2,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontFamily: font.mono,
                fontSize: 20,
                color: '#D3CEC5',
                opacity: t,
              }}>
              {label}
            </div>
          </div>
        );
      })}

      <Rise delay={10 + NODES.length * STEP + 6} style={{ position: 'absolute', left: 220, top: 830 }}>
        <div style={{ fontFamily: font.body, fontSize: 30, color: '#BEB8AE', maxWidth: 1480 }}>
          Usage telemetry is off. The SDK still makes signed-in calls to Presage, such as the licence check.
        </div>
      </Rise>
    </AbsoluteFill>
  );
}
