import { SHOTS, segmentsSeconds } from './shots';
import { FPS, TRANSITION_FRAMES } from './theme';

/** The voiceover starts this long into its scene, and the scene runs on this long after it. */
export const VO_LEAD_S = 0;
const VO_TAIL_S = 0.35;

export type Timeline = {
  /** Frames per scene, by shot id. */
  frames: Record<string, number>;
  /** Voiceover length in seconds per scene (0 when there's no voiceover file). */
  voiceover: Record<string, number>;
  /** Which recordings exist in public/recordings. */
  available: Record<string, boolean>;
};

/** Scene lengths: long enough for the recording's segments and for the voiceover. */
export function sceneFrames(
  voiceover: Record<string, number>,
  available: Record<string, boolean>,
): Record<string, number> {
  return Object.fromEntries(
    SHOTS.map((shot) => {
      const visual =
        shot.kind === 'phone' && available[shot.file] && shot.segments
          ? segmentsSeconds(shot.segments)
          : shot.seconds;
      const spoken = voiceover[shot.id] ? voiceover[shot.id] + VO_LEAD_S + VO_TAIL_S : 0;
      return [shot.id, Math.round(Math.max(visual, spoken) * FPS)];
    }),
  );
}

/** Where each scene starts in the whole video (scenes overlap during the cross-fades). */
export function sceneStarts(frames: Record<string, number>): Record<string, number> {
  let at = 0;
  return Object.fromEntries(
    SHOTS.map((shot) => {
      const start = at;
      at += frames[shot.id] - TRANSITION_FRAMES;
      return [shot.id, start];
    }),
  );
}

export function totalFrames(frames: Record<string, number>) {
  return SHOTS.reduce((sum, s) => sum + frames[s.id], 0) - TRANSITION_FRAMES * (SHOTS.length - 1);
}
