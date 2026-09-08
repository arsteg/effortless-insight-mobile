const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const FLAG = "$RNFirebaseDisableSPM";

/**
 * react-native-firebase resolves firebase-ios-sdk through SwiftPM, whose products
 * are automatic (static) libraries. This app sets `useFrameworks: "static"` via
 * expo-build-properties, so each RNFB pod embeds its own copy of Firebase and they
 * collide as duplicate symbols at link time:
 *
 *   [!] [react-native-firebase] SPM + static linkage is not supported.
 *
 * Setting $RNFirebaseDisableSPM makes RNFB use the CocoaPods firebase-ios-sdk instead.
 *
 * This has to be a plugin rather than a hand edit: `expo prebuild` regenerates
 * ios/Podfile from scratch, so a manual edit is lost on every prebuild and on every
 * EAS cloud build (which always prebuilds fresh).
 */
module.exports = function withRNFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile"
      );
      const contents = fs.readFileSync(podfilePath, "utf8");

      if (contents.includes(FLAG)) {
        return cfg;
      }

      // Anchor on the `require 'json'` line that Expo's template always emits,
      // so the flag lands before any target block.
      const anchor = "require 'json'";
      if (!contents.includes(anchor)) {
        throw new Error(
          `[withRNFirebaseDisableSPM] Could not find "${anchor}" in ios/Podfile; ` +
            `the Expo Podfile template changed and this plugin needs updating.`
        );
      }

      fs.writeFileSync(
        podfilePath,
        contents.replace(anchor, `${FLAG} = true\n\n${anchor}`)
      );
      return cfg;
    },
  ]);
};
