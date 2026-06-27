/**
 * Secure Storage Service
 * Uses expo-secure-store for sensitive data on native, localStorage on web
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../../utils/constants';
import { UserDto } from '../../types';

const isWeb = Platform.OS === 'web';

/**
 * Platform-agnostic storage helpers
 */
async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Store access token securely
 */
export async function setAccessToken(token: string): Promise<void> {
  await setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
}

/**
 * Get access token
 */
export async function getAccessToken(): Promise<string | null> {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Store refresh token securely
 */
export async function setRefreshToken(token: string): Promise<void> {
  await setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
}

/**
 * Get refresh token
 */
export async function getRefreshToken(): Promise<string | null> {
  return getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Store both tokens at once
 */
export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    setAccessToken(accessToken),
    setRefreshToken(refreshToken),
  ]);
}

/**
 * Clear all tokens
 */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    deleteItem(STORAGE_KEYS.ACCESS_TOKEN),
    deleteItem(STORAGE_KEYS.REFRESH_TOKEN),
  ]);
}

/**
 * Store user data
 */
export async function setUser(user: UserDto): Promise<void> {
  await setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

/**
 * Get user data
 */
export async function getUser(): Promise<UserDto | null> {
  const userJson = await getItem(STORAGE_KEYS.USER);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as UserDto;
  } catch {
    return null;
  }
}

/**
 * Clear user data
 */
export async function clearUser(): Promise<void> {
  await deleteItem(STORAGE_KEYS.USER);
}

/**
 * Store biometric preference
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, String(enabled));
}

/**
 * Get biometric preference
 */
export async function getBiometricEnabled(): Promise<boolean> {
  const value = await getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
  return value === 'true';
}

/**
 * Store dark mode preference
 */
export async function setDarkModeEnabled(enabled: boolean): Promise<void> {
  await setItem(STORAGE_KEYS.DARK_MODE_ENABLED, String(enabled));
}

/**
 * Get dark mode preference
 */
export async function getDarkModeEnabled(): Promise<boolean> {
  const value = await getItem(STORAGE_KEYS.DARK_MODE_ENABLED);
  return value === 'true';
}

/**
 * Store push notification token
 */
export async function setPushToken(token: string): Promise<void> {
  await setItem(STORAGE_KEYS.PUSH_TOKEN, token);
}

/**
 * Get push notification token
 */
export async function getPushToken(): Promise<string | null> {
  return getItem(STORAGE_KEYS.PUSH_TOKEN);
}

/**
 * Clear all secure storage
 */
export async function clearAllSecureStorage(): Promise<void> {
  await Promise.all([
    clearTokens(),
    clearUser(),
    deleteItem(STORAGE_KEYS.BIOMETRIC_ENABLED),
    deleteItem(STORAGE_KEYS.PUSH_TOKEN),
  ]);
}

/**
 * Check if tokens exist (for initial auth state)
 */
export async function hasValidTokens(): Promise<boolean> {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();
  return !!(accessToken && refreshToken);
}
