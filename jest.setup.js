// AsyncStorage has no native module in Jest; use the in-memory mock it ships with.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// NetInfo is a native module; use the mock it ships with.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);

// Tests never talk to the real backend.
jest.mock('@/lib/supabase', () => require('./jest/supabase-mock'));

// Reanimated and Worklets need their native runtime; use the mocks they ship for Jest.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The mock leaves out a few APIs the app uses. Add their no-motion behaviour to the mock module
// itself (it's cached), so expo-router's testing library, which mocks Reanimated with the same
// module, has them too.
const reanimatedMock = require('react-native-reanimated/mock');
reanimatedMock.LayoutAnimationConfig = ({ children }) => children;
reanimatedMock.useReducedMotion = () => false;
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
