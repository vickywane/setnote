// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    rules: {
      'prettier/prettier': [
        'error',
        { singleQuote: true, printWidth: 100, bracketSameLine: true, trailingComma: 'all' },
      ],
    },
  },
  {
    files: ['**/__tests__/**', '**/*-test.{ts,tsx}', 'jest.setup.js', 'jest/**'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
      },
    },
  },
  {
    ignores: [
      'dist/*',
      'coverage/*',
      '.expo/*',
      'ios/*',
      'android/*',
      'demo/*',
      'src/types/database.ts',
    ],
  },
]);
