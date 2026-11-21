import type { ConfigContext, ExpoConfig } from 'expo/config';

/** Setnote's build config. Project ownership and EAS IDs belong in the user's own EAS setup. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Setnote',
  slug: 'setnote',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'setnote',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.setnote.mobile',
    infoPlist: {
      NSMicrophoneUsageDescription: 'Setnote records voice notes so you can log a workout hands-free.',
      NSSpeechRecognitionUsageDescription: 'Setnote turns speech into editable note text.',
      NSCameraUsageDescription: 'Setnote uses the camera for the optional recovery check when available.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'app.setnote.mobile',
    predictiveBackGestureEnabled: false,
  },
  web: { output: 'static', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#FFFFFF', image: './assets/images/splash-icon.png', imageWidth: 76 }],
    ['expo-camera', { cameraPermission: 'Setnote uses the camera for an optional recovery check.', recordAudioAndroid: false }],
    ['expo-audio', { microphonePermission: 'Setnote records voice notes so you can log a workout hands-free.' }],
    ['expo-speech-recognition', {
      microphonePermission: 'Setnote records voice notes so you can log a workout hands-free.',
      speechRecognitionPermission: 'Setnote turns speech into editable note text.',
      androidSpeechServicePackages: ['com.google.android.as', 'com.google.android.googlequicksearchbox'],
    }],
    'expo-sharing',
    ['expo-build-properties', { ios: { deploymentTarget: '17.0' } }],
    './plugins/with-ios-scene-lifecycle',
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { appVariant: process.env.APP_VARIANT ?? 'development' },
});
