const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Permissions declared by a bundled library's own AndroidManifest.xml for a
 * capability this app never actually calls. Each one caused a real Google
 * Play Publishing Overview block, and in every case there was no honest
 * declaration to write, only removal, since the app genuinely does not use
 * the feature the permission is for.
 *
 * A plain edit to the generated manifest is not enough: the library's own
 * AndroidManifest.xml gets merged back in by Gradle's manifest merger at
 * build time, AFTER prebuild runs. tools:node="remove" is Android's actual
 * merge-rule instruction telling the merger to drop the permission even
 * though a library manifest re-adds it (the same pattern this manifest
 * already uses for READ/WRITE_EXTERNAL_STORAGE's tools:replace). Verify any
 * change here against Gradle's own merger report
 * (android/app/build/outputs/logs/manifest-merger-release-report.txt) before
 * trusting it — look for the permission's REJECTED line from the library.
 */
const UNUSED_PERMISSIONS = [
  {
    name: "android.permission.READ_MEDIA_IMAGES",
    reason:
      "expo-screen-capture declares this (Android 13 only) for its screenshot-" +
      "DETECTION feature (addScreenshotListener), which this app never calls — " +
      "screenSecurity.ts only ever calls preventScreenCaptureAsync/" +
      "allowScreenCaptureAsync (FLAG_SECURE), a separate code path needing no " +
      "permission at all. The app's real gallery feature (app/(tabs)/upload.tsx " +
      "handleGalleryPick -> expo-image-picker's launchImageLibraryAsync) is " +
      "untouched: expo-image-picker's own manifest never declares this " +
      "permission (it already uses the Android Photo Picker on API 33+).",
  },
  {
    name: "android.permission.ACTIVITY_RECOGNITION",
    reason:
      "expo-sensors declares this unconditionally for its whole sensor bundle " +
      "(Pedometer/activity classification needs it), but this app only ever " +
      "imports LightSensor from it (src/services/lightSensor.ts, ambient-light " +
      "detection for the camera in low light) — a completely different API " +
      "that needs no permission. This is not a health/fitness app, so there is " +
      "no honest 'health features' declaration to give Google Play either.",
  },
];

module.exports = function withoutUnusedAndroidPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    if (!Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = [];
    }

    for (const { name } of UNUSED_PERMISSIONS) {
      const alreadyPresent = manifest["uses-permission"].some(
        (perm) => perm.$?.["android:name"] === name
      );

      if (!alreadyPresent) {
        manifest["uses-permission"].push({
          $: {
            "android:name": name,
            "tools:node": "remove",
          },
        });
      }
    }

    return config;
  });
};
