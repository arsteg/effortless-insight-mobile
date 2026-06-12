/**
 * Secure Storage Service
 * Uses expo-secure-store for sensitive data
 */

import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../../utils/constants';
import { UserDto } from '../../types';

/**
 * Store access token securely
 */
export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, token);
}

/**
 * Get access token
 */
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Store refresh token securely
 */
export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, token);
}

/**
 * Get refresh token
 */
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
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
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
  ]);
}

/**
 * Store user data
 */
export async function setUser(user: UserDto): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.USER, JSON.stringify(user));
}

/**
 * Get user data
 */
export async function getUser(): Promise<UserDto | null> {
  const userJson = await SecureStore.getItemAsync(STORAGE_KEYS.USER);
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
  await SecureStore.deleteItemAsync(STORAGE_KEYS.USER);
}

/**
 * Store biometric preference
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED, String(enabled));
}

/**
 * Get biometric preference
 */
export async function getBiometricEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED);
  return value === 'true';
}

/**
 * Store push notification token
 */
export async function setPushToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.PUSH_TOKEN, token);
}

/**
 * Get push notification token
 */
export async function getPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.PUSH_TOKEN);
}

/**
 * Clear all secure storage
 */
export async function clearAllSecureStorage(): Promise<void> {
  await Promise.all([
    clearTokens(),
    clearUser(),
    SecureStore.deleteItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED),
    SecureStore.deleteItemAsync(STORAGE_KEYS.PUSH_TOKEN),
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
