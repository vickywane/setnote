import { requireOptionalNativeModule } from 'expo-modules-core';
import type * as SpeechRecognition from 'expo-speech-recognition';

/**
 * Speech recognition, loaded only when the app was built with it. `expo-speech-recognition`
 * throws as soon as it's imported if its native module is missing (an older development build,
 * or Expo Go), which would take every note screen down with it; here voice is just unavailable.
 */
export const speechSupported = requireOptionalNativeModule('ExpoSpeechRecognition') !== null;

const speech: typeof SpeechRecognition | null = speechSupported
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-speech-recognition')
  : null;

/**
 * The recognizer. Only reached from voice controls, which aren't shown when `speechSupported`
 * is false.
 */
export const SpeechModule = (speech?.ExpoSpeechRecognitionModule ??
  null) as typeof SpeechRecognition.ExpoSpeechRecognitionModule;

/** Recognizer events; a no-op without the native module. Fixed for the app's lifetime. */
export const useSpeechRecognitionEvent: typeof SpeechRecognition.useSpeechRecognitionEvent =
  speech?.useSpeechRecognitionEvent ?? (() => {});
