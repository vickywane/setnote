import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEventListener } from 'expo';
import { useEffect, useRef, useState } from 'react';

import { type NoteRecording, useRecordingUrl } from '@/features/notes/recordings';

/** Playback speeds, in the order the speed button steps through them. */
const RATES = [1, 1.5, 2, 0.75] as const;
const SKIP_SECONDS = 10;

/**
 * Plays a note's recordings, one at a time. While one is open the Playback dock shows its
 * scrubber, −10 / play / +10, speed and share; it closes when the recording plays through.
 */
export function useClipPlayer(recordings: NoteRecording[]) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const open = recordings.find((r) => r.id === openId) ?? null;
  const url = useRecordingUrl(open?.path ?? null);
  const player = useAudioPlayer(url.data ?? null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  // Play as soon as the chosen recording has loaded.
  const playWhenLoaded = useRef<{ fromSeconds: number } | null>(null);

  useEffect(() => {
    if (!status.isLoaded || !playWhenLoaded.current) return;
    const { fromSeconds } = playWhenLoaded.current;
    playWhenLoaded.current = null;
    void (async () => {
      // Play through the speaker even with the ring switch on silent.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (fromSeconds > 0 || status.currentTime > 0) await player.seekTo(fromSeconds);
      player.setPlaybackRate(rate);
      player.play();
    })();
  }, [status.isLoaded, status.currentTime, player, rate]);

  // Played through: close the dock.
  useEventListener(player, 'playbackStatusUpdate', (update) => {
    if (update.didJustFinish) {
      player.pause();
      setOpenId(null);
    }
  });

  const durationMs = status.duration > 0 ? status.duration * 1000 : (open?.duration_ms ?? 0);
  const positionMs = open ? status.currentTime * 1000 : 0;

  /** Plays a recording (from the start, or from where it was), or pauses it if it's playing. */
  const toggle = (recording: NoteRecording, { fromStart = false } = {}) => {
    if (recording.id === openId && status.isLoaded) {
      if (status.playing && !fromStart) {
        player.pause();
        return;
      }
      playWhenLoaded.current = { fromSeconds: fromStart ? 0 : status.currentTime };
      // Already loaded: kick the effect by playing straight away.
      void (async () => {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        if (fromStart) await player.seekTo(0);
        player.setPlaybackRate(rate);
        player.play();
        playWhenLoaded.current = null;
      })();
      return;
    }
    playWhenLoaded.current = { fromSeconds: 0 };
    setOpenId(recording.id);
  };

  const seekTo = (fraction: number) => {
    if (!status.isLoaded || durationMs <= 0) return;
    void player.seekTo(Math.max(0, Math.min(1, fraction)) * (durationMs / 1000));
  };

  const skip = (seconds: number) => {
    if (!status.isLoaded) return;
    const total = durationMs / 1000;
    void player.seekTo(Math.max(0, Math.min(total, status.currentTime + seconds)));
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (status.isLoaded) player.setPlaybackRate(next);
  };

  return {
    open,
    playing: status.playing,
    loading: !!open && !status.isLoaded,
    positionMs,
    durationMs,
    rate,
    toggle,
    seekTo,
    back: () => skip(-SKIP_SECONDS),
    forward: () => skip(SKIP_SECONDS),
    cycleRate,
    close: () => {
      player.pause();
      setOpenId(null);
    },
  };
}
