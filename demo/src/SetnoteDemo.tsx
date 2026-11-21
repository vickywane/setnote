import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { Fragment } from 'react';
import {
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { ArchitectureCard } from './scenes/ArchitectureCard';
import { BRoll } from './scenes/BRoll';
import { Outro } from './scenes/Outro';
import { PhoneShot } from './scenes/PhoneShot';
import { PrivacyCard } from './scenes/PrivacyCard';
import { ProblemCard } from './scenes/ProblemCard';
import { TitleCard } from './scenes/TitleCard';
import { type Shot, SHOTS } from './shots';
import { TRANSITION_FRAMES } from './theme';
import { sceneStarts, type Timeline, VO_LEAD_S } from './timeline';

export type DemoProps = {
  /** Shown on the last card, e.g. "github.com/you/setnote". Left off when empty. */
  repoUrl: string;
  /** Optional opening cue from public/, or '' for no music. */
  music: string;
  /** Soft music level between narration lines, 0–1. */
  musicVolume: number;
  /** Scene lengths and which media exist (filled in by calculateMetadata). */
  timeline: Timeline;
};

export function SetnoteDemo({ repoUrl, music, musicVolume, timeline }: DemoProps) {
  const { fps } = useVideoConfig();
  const lead = Math.round(VO_LEAD_S * fps);

  return (
    <>
      <TransitionSeries>
        {SHOTS.map((shot, i) => (
          <Fragment key={shot.id}>
            {i > 0 && (
              <TransitionSeries.Transition
                // Slide into the phone shots, cross-fade between cards.
                presentation={
                  shot.kind === 'phone' ? slide({ direction: 'from-right' }) : fade()
                }
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />
            )}
            <TransitionSeries.Sequence durationInFrames={timeline.frames[shot.id] ?? fps}>
              <Scene shot={shot} repoUrl={repoUrl} timeline={timeline} />
              {timeline.voiceover[shot.id] > 0 && (
                <Sequence from={lead} name={`Voiceover · ${shot.id}`}>
                  <Audio
                    src={staticFile(`voiceover/${shot.id}.wav`)}
                    volume={(frame) =>
                      shot.id === 'privacy'
                        ? interpolate(
                            frame,
                            [timeline.voiceover[shot.id] * fps - 0.25 * fps, timeline.voiceover[shot.id] * fps],
                            [1, 0],
                            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                          )
                        : 1
                    }
                  />
                </Sequence>
              )}
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
      {music && <DuckedMusic music={music} musicVolume={musicVolume} timeline={timeline} />}
    </>
  );
}

/** Keeps the electronic bed present, with gentle dips while ElevenLabs narration is speaking. */
function DuckedMusic({
  music,
  musicVolume,
  timeline,
}: {
  music: string;
  musicVolume: number;
  timeline: Timeline;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const starts = sceneStarts(timeline.frames);
  const duck = 0.36;
  const ramp = Math.round(0.3 * fps);
  const speechGain = SHOTS.reduce((gain, shot) => {
    const length = timeline.voiceover[shot.id] ?? 0;
    if (!length) return gain;
    const from = starts[shot.id] + Math.round(VO_LEAD_S * fps);
    const to = from + Math.round(length * fps);
    if (frame < from - ramp || frame > to + ramp) return gain;
    const level =
      frame < from + ramp
        ? interpolate(frame, [from - ramp, from + ramp], [1, duck], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : frame > to - ramp
          ? interpolate(frame, [to - ramp, to + ramp], [duck, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : duck;
    return Math.min(gain, level);
  }, 1);
  const fadeIn = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 2 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp' },
  );

  return (
    <Audio
      src={staticFile(music)}
      volume={() => musicVolume * speechGain * fadeIn * fadeOut}
    />
  );
}

function Scene({
  shot,
  repoUrl,
  timeline,
}: {
  shot: Shot;
  repoUrl: string;
  timeline: Timeline;
}) {
  switch (shot.kind) {
    case 'broll':
      return (
        <BRoll
          video={shot.file}
          trimFrom={shot.trimFrom}
          caption={shot.caption}
          drift={shot.drift}
        />
      );
    case 'title':
      return <TitleCard />;
    case 'problem':
      return <ProblemCard lines={shot.lines} />;
    case 'phone':
      return <PhoneShot {...shot} available={!!timeline.available[shot.file]} />;
    case 'architecture':
      return <ArchitectureCard />;
    case 'privacy':
      return <PrivacyCard />;
    case 'outro':
      return <Outro repoUrl={repoUrl} />;
  }
}
