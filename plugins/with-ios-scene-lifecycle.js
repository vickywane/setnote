const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

/**
 * Adopts the UIScene life cycle on iOS. Apps built with the iOS 27 SDK (Xcode 27) crash at
 * launch without it, but the Expo SDK 57 prebuild template still uses the window-based app
 * delegate. Mirrors what the SDK 58 template does: a `SceneDelegate` built on
 * `ExpoAppSceneDelegate` creates the window and starts React Native.
 *
 * Remove this plugin after upgrading to Expo SDK 58, whose template does this already.
 */

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

const WINDOW_SETUP =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/;

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('with-ios-scene-lifecycle only supports a Swift AppDelegate.');
    }
    let contents = config.modResults.contents;

    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      contents = contents.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    }
    contents = contents.replace(
      WINDOW_SETUP,
      '\n    // The window is created and React Native is started by `SceneDelegate` under the\n' +
        '    // scene-based life cycle (required by the iOS 27 SDK).\n',
    );

    if (!contents.includes('ExpoReactNativeFactoryProvider') || WINDOW_SETUP.test(contents)) {
      throw new Error('with-ios-scene-lifecycle could not update AppDelegate.swift.');
    }
    config.modResults.contents = contents;
    return config;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });
}

function withSceneDelegateFile(config) {
  return withXcodeProject(config, (config) => {
    const { projectName, platformProjectRoot } = config.modRequest;
    const filePath = path.join(platformProjectRoot, projectName, 'SceneDelegate.swift');
    fs.writeFileSync(filePath, SCENE_DELEGATE);

    const groupFilePath = `${projectName}/SceneDelegate.swift`;
    if (!config.modResults.hasFile(groupFilePath)) {
      config.modResults = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: groupFilePath,
        groupName: projectName,
        project: config.modResults,
      });
    }
    return config;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneDelegateFile(withSceneManifest(withSceneAppDelegate(config)));
};
