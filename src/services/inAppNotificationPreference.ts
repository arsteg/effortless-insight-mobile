/**
 * The global "in-app notifications" switch, kept on the device.
 *
 * The API's `ChannelPreferencesDto` has email, sms, whatsApp and push — there
 * is no in-app channel on it. (It exists per notification *type*, but not as a
 * blanket switch.) The settings screen offers the toggle, so rather than send a
 * field the server drops on the floor, the choice is stored locally.
 *
 * If an in-app channel is added to the API later, this should move server-side
 * so the preference follows the user across devices; today it does not.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@in_app_notifications_enabled';

/** In-app notifications are on unless the user turned them off. */
export const DEFAULT_IN_APP_ENABLED = true;

export async function getLocalInAppPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    // Only an explicit "false" turns it off; a missing value keeps the default.
    return raw === null ? DEFAULT_IN_APP_ENABLED : raw === 'true';
  } catch {
    return DEFAULT_IN_APP_ENABLED;
  }
}

export async function setLocalInAppPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // The screen still reflects the choice for this session.
  }
}
