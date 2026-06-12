/**
 * Cache Storage Service
 * Uses AsyncStorage for non-sensitive cached data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, CACHE_CONFIG } from '../../utils/constants';
import { NoticeDto, MyTaskDto } from '../../types';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Generic cache set
 */
async function setCache<T>(key: string, data: T, durationMs: number): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    cachedAt: Date.now(),
    expiresAt: Date.now() + durationMs,
  };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

/**
 * Generic cache get
 */
async function getCache<T>(key: string): Promise<T | null> {
  const json = await AsyncStorage.getItem(key);
  if (!json) return null;

  try {
    const entry = JSON.parse(json) as CacheEntry<T>;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Cache notices list
 */
export async function cacheNotices(notices: NoticeDto[]): Promise<void> {
  await setCache(STORAGE_KEYS.CACHED_NOTICES, notices, CACHE_CONFIG.NOTICE_CACHE_DURATION);
}

/**
 * Get cached notices
 */
export async function getCachedNotices(): Promise<NoticeDto[] | null> {
  return getCache<NoticeDto[]>(STORAGE_KEYS.CACHED_NOTICES);
}

/**
 * Cache my tasks
 */
export async function cacheTasks(tasks: MyTaskDto[]): Promise<void> {
  await setCache(STORAGE_KEYS.CACHED_TASKS, tasks, CACHE_CONFIG.TASK_CACHE_DURATION);
}

/**
 * Get cached tasks
 */
export async function getCachedTasks(): Promise<MyTaskDto[] | null> {
  return getCache<MyTaskDto[]>(STORAGE_KEYS.CACHED_TASKS);
}

/**
 * Store last sync timestamp
 */
export async function setLastSync(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, String(Date.now()));
}

/**
 * Get last sync timestamp
 */
export async function getLastSync(): Promise<number | null> {
  const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  return timestamp ? parseInt(timestamp, 10) : null;
}

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.CACHED_NOTICES),
    AsyncStorage.removeItem(STORAGE_KEYS.CACHED_TASKS),
    AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
  ]);
}

/**
 * Get cache status info
 */
export async function getCacheStatus(): Promise<{
  noticesCached: boolean;
  tasksCached: boolean;
  lastSync: number | null;
}> {
  const [notices, tasks, lastSync] = await Promise.all([
    getCachedNotices(),
    getCachedTasks(),
    getLastSync(),
  ]);

  return {
    noticesCached: notices !== null,
    tasksCached: tasks !== null,
    lastSync,
  };
}
