import {
  AbsoluteFill,
  Freeze,
  OffthreadVideo,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import type { Segment, Stat } from '../shots';
import { color, font } from '../theme';
import { Overline, Rise } from './common';

/** iPhone-shaped frame at 1080p: the screen is 9:19.5, like the iPhone 18 Pro. */
const PHONE_W = 430;
const PHONE_H = Math.round((PHONE_W * 19.5) / 9);
const BEZEL = 14;

type Props = {
  file: string;
  available: boolean;
  overline: string;
  title: string;
  body: string;
  record: string;
  live?: boolean;
  segments?: Segment[];
  stats?: Stat[];
};

/** A screen recording in a phone, with what it shows written beside it. */
export function PhoneShot({
  file,
  available,
  overline,
  title,
  body,
  record,
  live,
  segments,
  stats,
}: Props) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: live ? color.camera : color.paper2,
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0 160px',
        gap: 140,
      }}>
      <Rise style={{ width: PHONE_W + BEZEL * 2, flexShrink: 0 }}>
        <div
          style={{
            width: PHONE_W + BEZEL * 2,
            height: Math.min(PHONE_H + BEZEL * 2, 1000),
            borderRadius: 72,
            padding: BEZEL,
            backgroundColor: '#0E0D0C',
            boxShadow: '0 40px 80px rgba(27,26,23,0.28)',
          }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: 58,
              overflow: 'hidden',
              backgroundColor: color.paper,
            }}>
            {available ? (
              <Recording file={file} segments={segments} />
            ) : (
              <Placeholder file={file} record={record} />
            )}
          </div>
        </div>
      </Rise>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 820 }}>
        <Rise delay={8}>
          <Overline tone={live ? '#F59A7B' : color.accent}>
            {live && <LiveDot />}
            {overline}
          </Overline>
        </Rise>
        <Rise delay={14}>
          <div
            style={{
              fontFamily: font.display,
              fontSize: 96,
              lineHeight: 1.05,
              color: live ? color.paper : color.ink,
            }}>
            {title}
          </div>
        </Rise>
        <Rise delay={22}>
          <div
            style={{
              fontFamily: font.body,
              fontSize: 40,
              lineHeight: 1.4,
              color: live ? '#D3CEC5' : color.inkSoft,
            }}>
            {body}
          </div>
        </Rise>
        {stats && <Stats stats={stats} />}
      </div>
    </AbsoluteFill>
  );
}

const SCREEN_STYLE = { width: '100%', height: '100%', objectFit: 'cover' } as const;

/**
 * The recording, or the chosen segments of it back to back. If the scene runs longer (a long
 * voiceover line), the last frame holds.
 */
function Recording({ file, segments }: { file: string; segments?: Segment[] }) {
  const { fps, durationInFrames } = useVideoConfig();
  const src = staticFile(`recordings/${file}`);
  if (!segments?.length) return <OffthreadVideo src={src} muted style={SCREEN_STYLE} />;
  let used = 0;
  const parts = segments.map((seg) => {
    const rate = seg.rate ?? 1;
    const length = Math.max(1, Math.round(((seg.to - seg.from) / rate) * fps));
    used += length;
    return { seg, rate, length };
  });
  const last = segments[segments.length - 1];
  const hold = durationInFrames - used;
  return (
    <Series>
      {parts.map(({ seg, rate, length }, i) => (
        <Series.Sequence key={i} durationInFrames={length}>
          <OffthreadVideo
            src={src}
            muted
            playbackRate={rate}
            trimBefore={Math.round(seg.from * fps)}
            style={SCREEN_STYLE}
          />
          {rate >= 2 && <SpeedBadge rate={rate} />}
        </Series.Sequence>
      ))}
      {hold > 0 && (
        <Series.Sequence durationInFrames={hold}>
          <Freeze frame={0}>
            <OffthreadVideo
              src={src}
              muted
              trimBefore={Math.round(last.to * fps) - 1}
              style={SCREEN_STYLE}
            />
          </Freeze>
        </Series.Sequence>
      )}
    </Series>
  );
}

/** Says a stretch is sped up, so nothing passes for real time that isn't. */
function SpeedBadge({ rate }: { rate: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 96,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 18px',
        borderRadius: 999,
        backgroundColor: 'rgba(27,26,23,0.82)',
        fontFamily: font.mono,
        fontSize: 22,
        letterSpacing: 2,
        color: color.paper,
        whiteSpace: 'nowrap',
      }}>
      {Number.isInteger(rate) ? rate : rate.toFixed(1)}× SPEED
    </div>
  );
}

/** Big numbers that count up from zero, e.g. the scan's pulse and breathing. */
function Stats({ stats }: { stats: Stat[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', gap: 64, marginTop: 16 }}>
      {stats.map((stat, i) => {
        const t = spring({ frame: frame - 18 - i * 8, fps, config: { damping: 200 }, durationInFrames: 30 });
        return (
          <div key={stat.label} style={{ opacity: Math.min(1, t * 3) }}>
            <div style={{ fontFamily: font.mono, fontSize: 120, lineHeight: 1, color: color.paper }}>
              {Math.round(stat.value * t)}
              <span style={{ fontSize: 40, color: '#F59A7B', marginLeft: 10 }}>{stat.unit}</span>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 24, letterSpacing: 3, color: '#BEB8AE', marginTop: 8 }}>
              {stat.label.toUpperCase()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The live dot from the app's timer pill, breathing slowly. */
function LiveDot() {
  const frame = useCurrentFrame();
  const opacity = interpolate(Math.sin(frame / 9), [-1, 1], [0.35, 1]);
  return (
    <span
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 16,
        verticalAlign: 'middle',
        backgroundColor: color.accent,
        opacity,
      }}
    />
  );
}

/** Stands in for a recording that hasn't been made yet, saying what to film. */
function Placeholder({ file, record }: { file: string; record: string }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color.paper3,
        justifyContent: 'center',
        padding: 40,
        gap: 20,
        border: `3px dashed ${color.line}`,
        borderRadius: 58,
      }}>
      <div style={{ fontFamily: font.mono, fontSize: 22, color: color.accentInk }}>TO RECORD</div>
      <div style={{ fontFamily: font.body, fontSize: 28, lineHeight: 1.35, color: color.ink }}>
        {record}
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 18, color: color.muted }}>
        public/recordings/{file}
      </div>
    </AbsoluteFill>
  );
}
