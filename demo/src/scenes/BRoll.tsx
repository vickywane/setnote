import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { color, font } from '../theme';

/**
 * A still photo brought to life: a slow push-in with a gentle drift, and a vignette. Labelled
 * "Illustrative" because B-roll stills are generated, unlike the app and device footage.
 */
export function BRoll({
  src,
  video,
  trimFrom = 0,
  from = 1.04,
  to = 1.16,
  drift = [0, -2],
  caption,
}: {
  src?: string;
  video?: string;
  trimFrom?: number;
  from?: number;
  to?: number;
  /** Percent of the frame to drift across, x and y, over the shot. */
  drift?: [number, number];
  caption?: string;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);
  const scale = interpolate(t, [0, 1], [from, to]);
  return (
    <AbsoluteFill style={{ backgroundColor: color.ink, overflow: 'hidden' }}>
      {video ? (
        <OffthreadVideo
          src={staticFile(video)}
          trimBefore={Math.round(trimFrom * fps)}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Img
          src={staticFile(src ?? '')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translate(${drift[0] * t}%, ${drift[1] * t}%)`,
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {caption && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 110px 120px' }}>
          <div
            style={{
              fontFamily: font.display,
              fontSize: 88,
              color: color.paper,
              textShadow: '0 4px 30px rgba(0,0,0,0.6)',
              maxWidth: 1300,
            }}>
            {caption}
          </div>
        </AbsoluteFill>
      )}
      <div
        style={{
          position: 'absolute',
          right: 32,
          bottom: 28,
          fontFamily: font.mono,
          fontSize: 18,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.6)',
        }}>
        {video ? 'ILLUSTRATIVE · STOCK' : 'ILLUSTRATIVE · AI'}
      </div>
    </AbsoluteFill>
  );
}
