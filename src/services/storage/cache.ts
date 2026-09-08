/**
 * Cache Storage Service
 * Uses AsyncStorage for non-sensitive cached data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, CACHE_CONFIG } from '../../utils/constants';
import { NoticeDto, MyTaskDto, NoticeDetailDto } from '../../types';

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
 * When an entry was written, or null when absent or expired. Lets the UI say
 * how old the data on screen is instead of presenting it as current
 * (TC-MOB-056).
 */
async function getCacheAge(key: string): Promise<number | null> {
  const json = await AsyncStorage.getItem(key);
  if (!json) return null;

  try {
    const entry = JSON.parse(json) as CacheEntry<unknown>;
    if (Date.now() > entry.expiresAt) return null;
    return entry.cachedAt;
  } catch {
    return null;
  }
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

/** Per-notice key. Details are cached individually, unlike the list. */
function noticeDetailKey(noticeId: string): string {
  return `${STORAGE_KEYS.CACHED_NOTICE_DETAIL_PREFIX}${noticeId}`;
}

/**
 * Cache one notice's full detail.
 *
 * The list cache holds `NoticeDto` rows, which the detail screen cannot render
 * — it needs the analysis, attachments, workflow and tasks that only
 * `NoticeDetailDto` carries. Storing them separately is what makes a
 * previously-viewed notice readable offline (TC-MOB-056).
 */
export async function cacheNoticeDetail(notice: NoticeDetailDto): Promise<void> {
  await setCache(noticeDetailKey(notice.id), notice, CACHE_CONFIG.NOTICE_CACHE_DURATION);
}

export async function getCachedNoticeDetail(
  noticeId: string
): Promise<NoticeDetailDto | null> {
  return getCache<NoticeDetailDto>(noticeDetailKey(noticeId));
}

/** When this notice's detail was last fetched, for the staleness label. */
export async function getCachedNoticeDetailAge(noticeId: string): Promise<number | null> {
  return getCacheAge(noticeDetailKey(noticeId));
}

/** When the notices list was last fetched. */
export async function getCachedNoticesAge(): Promise<number | null> {
  return getCacheAge(STORAGE_KEYS.CACHED_NOTICES);
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
