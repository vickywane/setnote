// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Tamagui's React Native build imports sibling files by their full platform name
// (`./components/Button.native.js`). Metro treats `.native.js` as a platform extension
// and won't resolve an explicit one, so resolve those requests straight to the file.
const TAMAGUI_PACKAGE = /[\\/]node_modules[\\/](tamagui|@tamagui[\\/][^\\/]+)[\\/]/;
const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.native.js') &&
    TAMAGUI_PACKAGE.test(context.originModulePath)
  ) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(path.dirname(context.originModulePath), moduleName),
    };
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// The Remotion demo video (demo/) is its own project with its own React; keep Metro out of it.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${escapeRegExp(path.join(__dirname, 'demo') + path.sep)}`),
];

module.exports = config;
