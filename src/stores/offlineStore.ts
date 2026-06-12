/**
 * Offline Store
 * Manages offline state and sync queue
 */

import { create } from 'zustand';
import {
  getQueueStatus,
  processQueue,
  clearQueue,
  clearFailedActions,
  addToQueue,
  QueuedAction,
  QueuedActionType,
} from '../services/storage/offlineQueue';
import { getCacheStatus, clearCache, setLastSync } from '../services/storage/cache';

interface OfflineState {
  // Queue state
  queueTotal: number;
  queuePending: number;
  queueFailed: number;
  queuedActions: QueuedAction[];

  // Sync state
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;

  // Cache state
  noticesCached: boolean;
  tasksCached: boolean;

  // Actions
  loadQueueStatus: () => Promise<void>;
  loadCacheStatus: () => Promise<void>;
  syncQueue: () => Promise<{ processed: number; failed: number }>;
  queueAction: (type: QueuedActionType, payload: Record<string, unknown>) => Promise<string>;
  clearFailedFromQueue: () => Promise<void>;
  clearAllQueue: () => Promise<void>;
  clearAllCache: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  // Initial state
  queueTotal: 0,
  queuePending: 0,
  queueFailed: 0,
  queuedActions: [],
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  noticesCached: false,
  tasksCached: false,

  /**
   * Load queue status from storage
   */
  loadQueueStatus: async () => {
    const status = await getQueueStatus();
    set({
      queueTotal: status.total,
      queuePending: status.pending,
      queueFailed: status.failed,
      queuedActions: status.actions,
    });
  },

  /**
   * Load cache status from storage
   */
  loadCacheStatus: async () => {
    const status = await getCacheStatus();
    set({
      noticesCached: status.noticesCached,
      tasksCached: status.tasksCached,
      lastSyncTime: status.lastSync,
    });
  },

  /**
   * Process the offline queue
   */
  syncQueue: async () => {
    set({ isSyncing: true, syncError: null });

    try {
      const result = await processQueue();
      await setLastSync();

      set({
        isSyncing: false,
        lastSyncTime: Date.now(),
      });

      // Refresh queue status
      await get().loadQueueStatus();

      return { processed: result.processed, failed: result.failed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      set({
        isSyncing: false,
        syncError: errorMessage,
      });
      return { processed: 0, failed: 0 };
    }
  },

  /**
   * Add action to offline queue
   */
  queueAction: async (type: QueuedActionType, payload: Record<string, unknown>) => {
    const id = await addToQueue(type, payload);
    await get().loadQueueStatus();
    return id;
  },

  /**
   * Clear failed actions from queue
   */
  clearFailedFromQueue: async () => {
    await clearFailedActions();
    await get().loadQueueStatus();
  },

  /**
   * Clear entire queue
   */
  clearAllQueue: async () => {
    await clearQueue();
    await get().loadQueueStatus();
  },

  /**
   * Clear all cached data
   */
  clearAllCache: async () => {
    await clearCache();
    await get().loadCacheStatus();
  },
}));
