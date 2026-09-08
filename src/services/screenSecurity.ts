/**
 * Hiding the app's contents from screenshots and the recents preview
 * (TC-MOB-076).
 *
 * Android keeps a thumbnail of the last frame for the recents switcher. Without
 * protection that thumbnail shows whatever was on screen — a notice number,
 * GSTIN, demand amount, AI analysis — and it survives leaving the app, and a
 * lock/unlock. Anyone who picks up the phone and opens Recents can read it.
 *
 * `preventScreenCaptureAsync` sets FLAG_SECURE on Android, which blanks that
 * thumbnail and blocks screenshots; on iOS it obscures the app during screen
 * recording and in the app switcher.
 *
 * Default ON. This app holds other people's tax filings, so the safe default is
 * the private one — but it is a preference, because blocking screenshots
 * outright stops a practitioner sharing a notice with a colleague.
 */

import * as ScreenCapture from 'expo-screen-capture';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@screen_capture_protection';

/** Default: protected. */
export const DEFAULT_PROTECTION_ENABLED = true;

let cached = DEFAULT_PROTECTION_ENABLED;
let loaded = false;

export async function loadScreenProtection(): Promise<boolean> {
  if (loaded) return cached;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    // Only an explicit "false" turns it off; a missing value stays protected.
    cached = raw === null ? DEFAULT_PROTECTION_ENABLED : raw === 'true';
  } catch {
    cached = DEFAULT_PROTECTION_ENABLED;
  }

  loaded = true;
  await applyScreenProtection(cached);
  return cached;
}

/** The current setting, without awaiting storage. */
export function isScreenProtectionEnabled(): boolean {
  return cached;
}

/** Turn protection on or off, persist it, and apply it immediately. */
export async function setScreenProtection(enabled: boolean): Promise<boolean> {
  cached = enabled;
  loaded = true;

  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // The in-memory value still applies for this session.
  }

  await applyScreenProtection(enabled);
  return cached;
}

/**
 * Push the setting to the OS.
 *
 * Failures are swallowed: the module is unavailable in Expo Go, and a screen
 * that cannot be protected must still be usable.
 */
async function applyScreenProtection(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await ScreenCapture.preventScreenCaptureAsync();
    } else {
      await ScreenCapture.allowScreenCaptureAsync();
    }
  } catch {
    // Not available here — nothing to do.
  }
}
