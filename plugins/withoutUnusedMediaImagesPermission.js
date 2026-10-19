const { withAndroidManifest } = require("expo/config-plugins");

const PERMISSION_NAME = "android.permission.READ_MEDIA_IMAGES";

/**
 * Strips READ_MEDIA_IMAGES from the final merged Android manifest.
 *
 * The only place this permission comes from is expo-screen-capture's own
 * AndroidManifest.xml (android:minSdkVersion="33" android:maxSdkVersion="33"),
 * declared for its screenshot-DETECTION feature (addScreenshotListener), which
 * this app never calls — screenSecurity.ts only ever calls
 * preventScreenCaptureAsync/allowScreenCaptureAsync (FLAG_SECURE), a
 * completely separate code path that needs no permission at all.
 *
 * The app's real gallery feature (app/(tabs)/upload.tsx handleGalleryPick ->
 * expo-image-picker's launchImageLibraryAsync) is untouched by this:
 * expo-image-picker's own manifest never declares READ_MEDIA_IMAGES in the
 * first place (it already uses the Android Photo Picker on API 33+, which
 * needs no runtime permission), so removing the permission here does not
 * affect it.
 *
 * Without this, Google Play's Publishing Overview hard-blocks submission:
 * "Use alternative system pickers for photos / videos" — apps targeting API
 * 33+ may only request this permission if a system picker is technically
 * insufficient, and it is not for this app, so there is no declaration text
 * that satisfies the check. The only fix is to stop declaring the permission.
 *
 * A plain edit to the generated manifest is not enough: expo-screen-capture's
 * own AndroidManifest.xml gets merged back in by Gradle's manifest merger at
 * build time, AFTER prebuild runs. tools:node="remove" is Android's actual
 * merge-rule instruction telling the merger to drop the permission even
 * though a library manifest re-adds it (the same pattern this manifest
 * already uses for READ/WRITE_EXTERNAL_STORAGE's tools:replace).
 */
module.exports = function withoutUnusedMediaImagesPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    if (!Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = [];
    }

    const alreadyPresent = manifest["uses-permission"].some(
      (perm) => perm.$?.["android:name"] === PERMISSION_NAME
    );

    if (!alreadyPresent) {
      manifest["uses-permission"].push({
        $: {
          "android:name": PERMISSION_NAME,
          "tools:node": "remove",
        },
      });
    }

    return config;
  });
};
