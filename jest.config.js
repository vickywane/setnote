module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*-test.{ts,tsx}', '**/__tests__/**/*.test.{ts,tsx}'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // The Remotion demo video is its own project.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/demo/'],
  modulePathIgnorePatterns: ['<rootDir>/demo/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|tamagui|@tamagui/.*|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@tamagui/style-grammar/token-categories$':
      '<rootDir>/node_modules/@tamagui/style-grammar/dist/cjs/tokenCategories.cjs',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/types/database.ts'],
};
