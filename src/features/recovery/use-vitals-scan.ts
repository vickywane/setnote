import { Camera } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { env } from '@/config/env';
import {
  PresageVitals,
  type RecordedVideo,
  type VitalsSample,
  type VitalsUpdate,
} from '@/modules/presage-vitals';

import { latest, SCAN_MS } from './summary';

export type ScanPhase = 'idle' | 'starting' | 'scanning' | 'done' | 'error';

export type ScanSamples = { pulse: VitalsSample[]; breathing: VitalsSample[]; hrv: VitalsSample[] };

const EMPTY: ScanSamples = { pulse: [], breathing: [], hrv: [] };

/** Deletes a recording that wasn't saved (it's in the cache directory until it is). */
function discard(video: RecordedVideo | null) {
  if (!video) return;
  try {
    const file = new File(video.uri);
    if (file.exists) file.delete();
  } catch {
    // The system clears the cache directory anyway.
  }
}

/** Whether the recovery check can run here: iOS build with the module, and an API key. */
export const recoveryCheckAvailable = () => !!PresageVitals && env.presageApiKey.length > 0;

/**
 * Runs one recovery check: starts the SDK, collects samples for SCAN_MS of good signal,
 * then stops. Leaving the screen or the app stops the camera straight away.
 */
export function useVitalsScan() {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [hint, setHint] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [live, setLive] = useState<{ pulse: number | null; breathing: number | null }>({
    pulse: null,
    breathing: null,
  });
  // What the finished scan collected; null until it's done.
  const [result, setResult] = useState<ScanSamples | null>(null);
  const samples = useRef<ScanSamples>(EMPTY);
  const phaseRef = useRef<ScanPhase>('idle');
  const startedAt = useRef(0);
  // The check's video, if this check records one: set once the file is finished.
  const [video, setVideo] = useState<RecordedVideo | null>(null);
  const [videoFinishing, setVideoFinishing] = useState(false);
  const videoRef = useRef<RecordedVideo | null>(null);
  const recording = useRef(false);

  const setPhaseBoth = (next: ScanPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const stop = async (next: ScanPhase) => {
    if (phaseRef.current !== 'starting' && phaseRef.current !== 'scanning') return;
    if (next === 'done') setResult(samples.current);
    setPhaseBoth(next);
    if (recording.current) setVideoFinishing(true);
    let recorded: RecordedVideo | null = null;
    try {
      recorded = (await PresageVitals?.stop()) ?? null;
    } catch {
      // Already stopped.
    }
    recording.current = false;
    setVideoFinishing(false);
    // Only a finished check keeps its video; a cancelled or failed one is thrown away.
    if (next === 'done' && recorded) {
      videoRef.current = recorded;
      setVideo(recorded);
    } else {
      discard(recorded);
    }
  };

  useEffect(() => {
    if (!PresageVitals) return;
    const subscription = PresageVitals.addListener('onUpdate', (update: VitalsUpdate) => {
      if (phaseRef.current !== 'scanning' && phaseRef.current !== 'starting') return;
      const s = samples.current;
      samples.current = {
        pulse: [...s.pulse, ...update.pulse],
        breathing: [...s.breathing, ...update.breathing],
        hrv: [...s.hrv, ...update.hrv],
      };
      setHint(update.hint ?? null);
      setValidation(update.validation ?? null);
      setLive((prev) => ({
        pulse: latest(update.pulse) ?? prev.pulse,
        breathing: latest(update.breathing) ?? prev.breathing,
      }));
      if (update.error) {
        setError(update.error.message);
        void stop('error');
        return;
      }
      if (update.status === 'running' && phaseRef.current === 'starting') {
        startedAt.current = Date.now();
        setPhaseBoth('scanning');
      }
      if (phaseRef.current === 'scanning') {
        const elapsed = Date.now() - startedAt.current;
        setElapsedMs(Math.min(elapsed, SCAN_MS));
        if (elapsed >= SCAN_MS) void stop('done');
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never keep the camera on in the background or after leaving the screen. Only
  // 'background' counts: iOS goes 'inactive' for system prompts (camera permission) and
  // Control Center, and stopping then cancels the SDK's start.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') void stop('idle');
    });
    return () => {
      subscription.remove();
      void stop('idle');
      // A video that wasn't saved is deleted when the screen closes. Saving moves or uploads
      // the file, so by then there's nothing here to delete.
      discard(videoRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Starts a check; with `recordVideo`, also records it to rewatch. */
  const start = async ({ recordVideo = false }: { recordVideo?: boolean } = {}) => {
    if (!PresageVitals) return;
    // A retake replaces the last check, and its unsaved video.
    discard(videoRef.current);
    videoRef.current = null;
    setVideo(null);
    samples.current = EMPTY;
    setResult(null);
    setError(null);
    setHint(null);
    setValidation(null);
    setElapsedMs(0);
    setLive({ pulse: null, breathing: null });
    setPhaseBoth('starting');
    try {
      // Ask for the camera first, so the system prompt isn't shown while the SDK starts.
      const permission = await Camera.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          'Setnote needs the camera for this check. Allow it in Settings › Setnote › Camera.',
        );
      }
      if (phaseRef.current !== 'starting') return; // Cancelled while asking.
      const videoUri = recordVideo
        ? new File(Paths.cache, `recovery-check-${Date.now()}.mp4`).uri
        : null;
      recording.current = videoUri !== null;
      await PresageVitals.start(env.presageApiKey, videoUri);
    } catch (e) {
      // Cancelling (or leaving) while the SDK starts makes start() throw; that's not an error.
      if (phaseRef.current !== 'starting') return;
      setError((e as Error).message);
      setPhaseBoth('error');
    }
  };

  return {
    phase,
    hint,
    validation,
    error,
    elapsedMs,
    live,
    result,
    /** The finished check's video, when it recorded one. */
    video,
    /** True while the video file is being finished after the check. */
    videoFinishing,
    start: (options?: { recordVideo?: boolean }) => void start(options),
    cancel: () => void stop('idle'),
  };
}
