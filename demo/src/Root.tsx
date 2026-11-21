import { parseMedia } from '@remotion/media-parser';
import { Composition, staticFile } from 'remotion';

import { ArchitectureCard } from './scenes/ArchitectureCard';
import { BRoll } from './scenes/BRoll';
import { SetnoteDemo, type DemoProps } from './SetnoteDemo';
import { recordingFiles, SHOTS } from './shots';
import { FPS, HEIGHT, WIDTH } from './theme';
import { sceneFrames, totalFrames } from './timeline';

const defaultProps: DemoProps = {
  repoUrl: '',
  music: 'music/options/1-electronic.mp3',
  musicVolume: 0.16,
  timeline: { frames: {}, voiceover: {}, available: {} },
};

async function exists(path: string) {
  try {
    return (await fetch(staticFile(path), { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

/** Seconds of audio in public/<path>, or 0 when there's no such file. */
async function audioSeconds(path: string) {
  if (!(await exists(path))) return 0;
  const { slowDurationInSeconds } = await parseMedia({
    src: staticFile(path),
    fields: { slowDurationInSeconds: true },
    acknowledgeRemotionLicense: true,
  });
  return slowDurationInSeconds;
}

export const RemotionRoot = () => (
  <>
    {/* A review piece: one B-roll shot on its own. */}
    <Composition
      id="BRollPreview"
      component={BRoll}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={5 * FPS}
      defaultProps={{ src: 'broll/gym-wide.png', caption: 'The last set. The whole story.' }}
    />
    {/* The architecture scene on its own, for stills (README image). */}
    <Composition
      id="Architecture"
      component={ArchitectureCard}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={5 * FPS}
    />
    <Composition
      id="SetnoteDemo"
      component={SetnoteDemo}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={1}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        // What's in public/: recordings (else placeholders) and voiceover (else silence).
        const [available, voiceover] = await Promise.all([
          Promise.all(
            recordingFiles.map(async (f) => [f, await exists(`recordings/${f}`)] as const),
          ).then(Object.fromEntries),
          Promise.all(
            SHOTS.map(async (s) => [s.id, await audioSeconds(`voiceover/${s.id}.wav`)] as const),
          ).then(Object.fromEntries),
        ]);
        const frames = sceneFrames(voiceover, available);
        return {
          durationInFrames: totalFrames(frames),
          props: { ...props, timeline: { frames, voiceover, available } },
        };
      }}
    />
  </>
);
