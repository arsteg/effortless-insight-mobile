/**
 * Config plugin referenced by app.json to prune Android permissions that
 * libraries inject but the app does not use.
 *
 * NOTE: the original implementation went missing from the repo, which broke
 * every `expo start` / prebuild (config evaluation failed on the unresolved
 * plugin, and typed-route generation stopped on 2026-09-08). This restoration
 * keeps config evaluation working. The removal list is intentionally EMPTY
 * until the original pruning list is reviewed — do NOT add RECORD_AUDIO here:
 * the EI Assistant's voice input (expo-audio) requires it.
 */

const { withAndroidManifest } = require('@expo/config-plugins');

// Permissions to strip from the merged manifest via tools:node="remove".
// Empty = restore-only (no pruning) pending review of the original list.
const PERMISSIONS_TO_REMOVE = [];

module.exports = function withoutUnusedAndroidPermissions(config) {
  return withAndroidManifest(config, (config) => {
    if (PERMISSIONS_TO_REMOVE.length === 0) {
      return config;
    }

    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    manifest['uses-permission'] = manifest['uses-permission'] || [];

    for (const permission of PERMISSIONS_TO_REMOVE) {
      const name = `android.permission.${permission}`;
      const existing = manifest['uses-permission'].find(
        (entry) => entry.$['android:name'] === name
      );
      if (existing) {
        existing.$['tools:node'] = 'remove';
      } else {
        manifest['uses-permission'].push({
          $: { 'android:name': name, 'tools:node': 'remove' },
        });
      }
    }
    return config;
  });
};
