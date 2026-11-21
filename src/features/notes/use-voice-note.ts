import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { SpeechModule, useSpeechRecognitionEvent } from '@/lib/speech';

/**
 * - idle: nothing recording
 * - starting: asking for the mic
 * - listening: recording and transcribing
 * - pausing / paused: the current stretch is closing / closed; Resume records another
 * - finishing: stopped, waiting for the last words
 * - transcribing: re-reading a saved recording
 */
export type VoiceState =
  'idle' | 'starting' | 'listening' | 'pausing' | 'paused' | 'finishing' | 'transcribing';

export type VoiceResult = {
  /** What was heard; empty when nothing was. */
  text: string;
  /**
   * The recorded audio (WAV), one file per stretch between pauses. Empty where the device can't
   * keep audio (Android 12 and below).
   */
  uris: string[];
  durationMs: number;
};

/** Words the recognizer should expect, besides the exercise names. */
const GYM_WORDS = ['kg', 'kilos', 'pounds', 'reps', 'sets', 'RPE', 'warm-up', 'drop set'];
/** Recognizers only use a limited number of hints. */
const MAX_HINTS = 100;
/** Bars in the live waveform (Figma "Live waveform"). */
export const LIVE_BARS = 32;
const VOLUME_INTERVAL_MS = 80;

type Segment = { uri: string | null; durationMs: number };
type Intent = 'stop' | 'pause' | 'discard';

/**
 * Speaking into a note: listens on the device, shows what it hears as it goes, and keeps the
 * audio. Pause closes the current stretch and Resume starts another; Stop hands back the whole
 * transcript and the recordings through `onDone`; Discard throws it all away.
 */
export function useVoiceNote({
  hints,
  onDone,
}: {
  /** Exercise names, so they're heard as written in the catalog. */
  hints: string[];
  onDone: (result: VoiceResult) => void;
}) {
  const [state, setState] = useState<VoiceState>('idle');
  /** Words confirmed so far, and the words still being made out. */
  const [heard, setHeard] = useState({ final: '', interim: '' });
  /** Recent loudness, 0–1, newest last. */
  const [levels, setLevels] = useState<number[]>([]);
  /** When the current stretch started, and the time recorded before it. */
  const [clock, setClock] = useState<{ since: number | null; beforeMs: number }>({
    since: null,
    beforeMs: 0,
  });

  // Android sends a final result per phrase, iOS one at the end of each stretch; either way the
  // finals joined are the transcript.
  const finals = useRef<string[]>([]);
  const interim = useRef('');
  const segments = useRef<Segment[]>([]);
  const current = useRef<{ uri: string | null; start: number; end: number | null }>({
    uri: null,
    start: 0,
    end: null,
  });
  const active = useRef<'record' | 'file' | null>(null);
  const intent = useRef<Intent>('stop');
  const fileDone = useRef<((text: string | null) => void) | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  const transcript = () =>
    [...finals.current, interim.current]
      .map((t) => t.trim())
      .filter(Boolean)
      .join(' ');

  const reset = () => {
    finals.current = [];
    interim.current = '';
    segments.current = [];
    setHeard({ final: '', interim: '' });
    setLevels([]);
    setClock({ since: null, beforeMs: 0 });
  };

  const removeFiles = (uris: (string | null)[]) => {
    for (const uri of uris) {
      if (!uri) continue;
      try {
        new File(uri).delete();
      } catch {
        // Already gone, or left for the system to clear from the cache.
      }
    }
  };

  const finish = () => {
    const result: VoiceResult = {
      text: transcript(),
      uris: segments.current.map((s) => s.uri).filter((u): u is string => !!u),
      durationMs: segments.current.reduce((n, s) => n + s.durationMs, 0),
    };
    reset();
    setState('idle');
    doneRef.current(result);
  };

  useSpeechRecognitionEvent('start', () => {
    if (active.current === 'record') setState('listening');
  });
  useSpeechRecognitionEvent('audiostart', (e) => {
    if (active.current !== 'record') return;
    current.current = { uri: e.uri, start: e.timestamp, end: null };
    setClock((c) => ({ ...c, since: e.timestamp }));
  });
  useSpeechRecognitionEvent('audioend', (e) => {
    if (active.current !== 'record') return;
    current.current = { ...current.current, uri: e.uri ?? current.current.uri, end: e.timestamp };
  });
  useSpeechRecognitionEvent('volumechange', (e) => {
    if (active.current !== 'record') return;
    // -2 (silence) to 10 (loud).
    const level = Math.min(1, Math.max(0.08, (e.value + 2) / 12));
    setLevels((l) => [...l.slice(-(LIVE_BARS - 1)), level]);
  });
  useSpeechRecognitionEvent('result', (e) => {
    if (!active.current) return;
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      finals.current.push(text);
      interim.current = '';
    } else {
      interim.current = text;
    }
    setHeard({
      final: finals.current
        .map((t) => t.trim())
        .filter(Boolean)
        .join(' '),
      interim: interim.current.trim(),
    });
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (!active.current) return;
    // Stopping before anything was said, or cancelling, isn't worth an alert.
    if (e.error === 'aborted' || e.error === 'no-speech' || e.error === 'speech-timeout') return;
    if (e.error === 'not-allowed') {
      showPermissionAlert();
      return;
    }
    Alert.alert(
      active.current === 'file' ? "Couldn't transcribe the recording" : "Couldn't record",
      e.message,
    );
  });
  useSpeechRecognitionEvent('end', () => {
    const kind = active.current;
    if (!kind) return;
    active.current = null;

    if (kind === 'file') {
      const text = transcript();
      finals.current = [];
      interim.current = '';
      setState('idle');
      fileDone.current?.(text || null);
      fileDone.current = null;
      return;
    }

    const { uri, start, end } = current.current;
    const durationMs = start ? Math.max(0, (end ?? Date.now()) - start) : 0;
    segments.current.push({ uri, durationMs });
    setClock((c) => ({ since: null, beforeMs: c.beforeMs + durationMs }));

    if (intent.current === 'pause') {
      // A pause closes the stretch; the words so far are confirmed.
      if (interim.current) {
        finals.current.push(interim.current);
        interim.current = '';
      }
      setState('paused');
      return;
    }
    if (intent.current === 'discard') {
      removeFiles(segments.current.map((s) => s.uri));
      reset();
      setState('idle');
      return;
    }
    finish();
  });

  // Leaving the screen mid-recording throws it away.
  useEffect(
    () => () => {
      if (active.current) {
        intent.current = 'discard';
        SpeechModule.abort();
      }
      removeFiles(segments.current.map((s) => s.uri));
    },
    [],
  );

  /** Starts listening: a new recording, or the next stretch after a pause. */
  const record = async () => {
    if (state !== 'idle' && state !== 'paused') return;
    const resuming = state === 'paused';
    setState('starting');
    try {
      if (!resuming) {
        const permission = await SpeechModule.requestPermissionsAsync();
        if (!permission.granted) {
          setState('idle');
          if (!permission.canAskAgain) showPermissionAlert();
          return;
        }
        if (!SpeechModule.isRecognitionAvailable()) {
          setState('idle');
          Alert.alert(
            'Voice notes aren’t available',
            'Speech recognition isn’t available on this device right now.',
          );
          return;
        }
        reset();
      }
      current.current = { uri: null, start: 0, end: null };
      intent.current = 'stop';
      active.current = 'record';
      SpeechModule.start({
        ...recognitionOptions(hints),
        interimResults: true,
        continuous: true,
        recordingOptions: {
          persist: SpeechModule.supportsRecording(),
          // 16 kHz 16-bit mono: plenty for speech, about 2 MB a minute.
          outputSampleRate: 16000,
          outputEncoding: 'pcmFormatInt16',
        },
        volumeChangeEventOptions: { enabled: true, intervalMillis: VOLUME_INTERVAL_MS },
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'measurement',
        },
      });
    } catch (error) {
      active.current = null;
      setState(resuming ? 'paused' : 'idle');
      Alert.alert("Couldn't record", (error as Error).message);
    }
  };

  /** Stops recording; `onDone` runs once the last words are in. */
  const stop = () => {
    if (state === 'paused') {
      finish();
      return;
    }
    if (state !== 'listening' && state !== 'starting') return;
    intent.current = 'stop';
    setState('finishing');
    SpeechModule.stop();
  };

  const pause = () => {
    if (state !== 'listening') return;
    intent.current = 'pause';
    setState('pausing');
    SpeechModule.stop();
  };

  /** Throws the recording away: no words are added and no audio is kept. */
  const discard = () => {
    if (state === 'paused') {
      removeFiles(segments.current.map((s) => s.uri));
      reset();
      setState('idle');
      return;
    }
    if (state !== 'listening' && state !== 'starting' && state !== 'pausing') return;
    intent.current = 'discard';
    SpeechModule.abort();
  };

  /** Reads a saved recording again; resolves with its words, or null if nothing was heard. */
  const transcribeFile = (uri: string) =>
    new Promise<string | null>((resolve) => {
      if (state !== 'idle') {
        resolve(null);
        return;
      }
      finals.current = [];
      interim.current = '';
      fileDone.current = resolve;
      active.current = 'file';
      setState('transcribing');
      try {
        SpeechModule.start({
          ...recognitionOptions(hints),
          interimResults: false,
          audioSource: { uri },
        });
      } catch (error) {
        active.current = null;
        fileDone.current = null;
        setState('idle');
        Alert.alert("Couldn't transcribe the recording", (error as Error).message);
        resolve(null);
      }
    });

  return {
    state,
    heard,
    levels,
    clock,
    record,
    stop,
    pause,
    discard,
    transcribeFile,
  };
}

function recognitionOptions(hints: string[]) {
  return {
    lang: 'en-US',
    // Speech stays on the phone where it can.
    requiresOnDeviceRecognition: SpeechModule.supportsOnDeviceRecognition(),
    addsPunctuation: true,
    contextualStrings: [...GYM_WORDS, ...hints].slice(0, MAX_HINTS),
  };
}

function showPermissionAlert() {
  Alert.alert(
    'Allow the microphone',
    'To speak a note, allow Setnote to use the microphone and speech recognition in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ],
  );
}
