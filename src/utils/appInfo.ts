/**
 * The app's own identity — version, build, platform (TC-MOB-069).
 *
 * Read from the Expo config rather than written down. The About dialog
 * previously hardcoded "1.0.0" while `app.json` said 1.0.1, and "Build: Mobile
 * App" where a build number belonged — so the app reported a version it was
 * not, which is worse than reporting none when a user files a bug.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface AppInfo {
  /** Marketing version, e.g. "1.0.1". */
  version: string;
  /** Store build: iOS buildNumber or Android versionCode. */
  build: string;
  platform: string;
  osVersion: string;
}

export function getAppInfo(): AppInfo {
  const config = Constants.expoConfig;

  const build =
    Platform.OS === 'ios'
      ? config?.ios?.buildNumber
      : config?.android?.versionCode?.toString();

  return {
    version: config?.version ?? 'unknown',
    build: build ?? 'unknown',
    platform: Platform.OS === 'ios' ? 'iOS' : 'Android',
    osVersion: String(Platform.Version),
  };
}

/** "v1.0.1 (2)" — for a settings row that has one line to work with. */
export function formatVersion(info: AppInfo): string {
  return `v${info.version} (${info.build})`;
}

/**
 * The body of a support email, with the diagnostics already filled in.
 *
 * Support requests arrive without version, build or OS unless the app supplies
 * them, and asking a user afterwards costs a round trip that often never
 * completes.
 */
export function buildSupportEmailBody(info: AppInfo, userEmail?: string): string {
  return [
    '',
    '',
    '---',
    'Please describe the problem above this line.',
    '',
    `App version: ${info.version} (${info.build})`,
    `Platform: ${info.platform} ${info.osVersion}`,
    userEmail ? `Account: ${userEmail}` : null,
    `Date: ${new Date().toISOString()}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export const SUPPORT_EMAIL = 'support@effortlessinsight.in';

/** Copyright line. The year is derived, not written down and left to rot. */
export function copyrightLine(): string {
  return `© ${new Date().getFullYear()} EffortlessInsight. All rights reserved.`;
}
