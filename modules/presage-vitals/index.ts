import { NativeModule, requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

/** One reading from the SDK. `confidence` is as the SDK reports it; `timestamp` is in µs. */
export type VitalsSample = {
  value: number;
  confidence: number;
  stable: boolean;
  timestamp: number;
};

/** What the native side sends about four times a second while measuring. */
export type VitalsUpdate = {
  /** idle | starting | running | stopping | error */
  status: string;
  /** SDK validation code, e.g. ok, noFaceFound, cameraTuning, excessiveMotion. */
  validation?: string;
  /** The SDK's own guidance, written for the person being measured. */
  hint?: string;
  error?: { code: string; message: string };
  /** New samples since the previous update. */
  pulse: VitalsSample[];
  breathing: VitalsSample[];
  /** HRV RMSSD in ms. */
  hrv: VitalsSample[];
};

type Events = { onUpdate: (update: VitalsUpdate) => void };

/** A check recorded as an MP4 (in the cache directory until it's saved). */
export type RecordedVideo = { uri: string; durationMs: number };

declare class PresageVitalsModule extends NativeModule<Events> {
  /** Starts a measurement; with `videoUri`, also records the camera frames there as an MP4. */
  start(apiKey: string, videoUri: string | null): Promise<void>;
  /** Stops it; returns the video when one was being recorded. */
  stop(): Promise<RecordedVideo | null>;
}

/** The native module, or null where it isn't built in (Android, web, Expo Go). */
export const PresageVitals = requireOptionalNativeModule<PresageVitalsModule>('PresageVitals');

/** The SDK's camera preview. Render only while `PresageVitals` is available. */
export const VitalsPreview: ComponentType<ViewProps> | null = PresageVitals
  ? requireNativeView('PresageVitals')
  : null;
