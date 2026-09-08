/**
 * Persistence for the offline storage preferences (TC-MOB-061).
 *
 * Read from non-React code — the document cache and the reconnect sync both
 * need the current value — so this is a plain module rather than a hook, with
 * an in-memory copy so the hot paths do not await AsyncStorage on every call.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OfflinePreferences,
  DEFAULT_OFFLINE_PREFERENCES,
} from '../utils/offlinePreferences';

const STORAGE_KEY = '@offline_preferences';

let cached: OfflinePreferences = { ...DEFAULT_OFFLINE_PREFERENCES };
let loaded = false;

/** Load once at startup. Safe to call repeatedly. */
export async function loadOfflinePreferences(): Promise<OfflinePreferences> {
  if (loaded) return cached;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Spread over the defaults so a preference added in a later release does
      // not read as undefined for users who stored the older shape.
      cached = { ...DEFAULT_OFFLINE_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {
    cached = { ...DEFAULT_OFFLINE_PREFERENCES };
  }

  loaded = true;
  return cached;
}

/**
 * The current preferences, without awaiting storage.
 *
 * Returns the defaults until the first load completes, which is the right
 * behaviour for the brief window at startup: the defaults are the permissive
 * ones, so nothing is blocked by a value that has not arrived yet.
 */
export function getOfflinePreferences(): OfflinePreferences {
  return cached;
}

export async function setOfflinePreference<K extends keyof OfflinePreferences>(
  key: K,
  value: OfflinePreferences[K]
): Promise<OfflinePreferences> {
  cached = { ...cached, [key]: value };
  loaded = true;

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // The in-memory value still applies for this session.
  }

  return cached;
}
