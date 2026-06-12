/**
 * Offline Queue Service
 * Manages queued actions when offline
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, OFFLINE_CONFIG } from '../../utils/constants';
import { tasksApi, noticesApi } from '../api';
import { CreateTaskDto, UpdateTaskDto } from '../../types';
import NetInfo from '@react-native-community/netinfo';

export type QueuedActionType =
  | 'create_comment'
  | 'update_task'
  | 'create_task'
  | 'upload_document'
  | 'update_notice_status';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  lastAttempt?: number;
  error?: string;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get queue from storage
 */
async function getQueue(): Promise<QueuedAction[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
  if (!json) return [];
  try {
    return JSON.parse(json) as QueuedAction[];
  } catch {
    return [];
  }
}

/**
 * Save queue to storage
 */
async function saveQueue(queue: QueuedAction[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
}

/**
 * Add action to queue
 */
export async function addToQueue(
  type: QueuedActionType,
  payload: Record<string, unknown>
): Promise<string> {
  const queue = await getQueue();

  // Check queue size limit
  if (queue.length >= OFFLINE_CONFIG.MAX_QUEUE_SIZE) {
    throw new Error('Offline queue is full. Please sync when online.');
  }

  const action: QueuedAction = {
    id: generateId(),
    type,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };

  queue.push(action);
  await saveQueue(queue);

  return action.id;
}

/**
 * Remove action from queue
 */
export async function removeFromQueue(actionId: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter(a => a.id !== actionId);
  await saveQueue(filtered);
}

/**
 * Update action in queue
 */
async function updateAction(action: QueuedAction): Promise<void> {
  const queue = await getQueue();
  const index = queue.findIndex(a => a.id === action.id);
  if (index !== -1) {
    queue[index] = action;
    await saveQueue(queue);
  }
}

/**
 * Process a single queued action
 */
async function processAction(action: QueuedAction): Promise<void> {
  const { type, payload } = action;

  switch (type) {
    case 'create_comment':
      await tasksApi.createComment(
        payload.noticeId as string,
        {
          content: payload.content as string,
          visibility: payload.visibility as 'all' | 'internal' | undefined,
          parentCommentId: payload.parentCommentId as string | undefined,
        }
      );
      break;

    case 'update_task':
      await tasksApi.updateTask(
        payload.taskId as string,
        payload.data as UpdateTaskDto
      );
      break;

    case 'create_task':
      await tasksApi.createTask(
        payload.noticeId as string,
        payload.data as CreateTaskDto
      );
      break;

    case 'update_notice_status':
      await noticesApi.updateStatus(
        payload.noticeId as string,
        payload.status as string
      );
      break;

    case 'upload_document':
      // Document uploads need special handling - may need to be re-captured
      throw new Error('Document uploads must be retried manually when online');

    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

/**
 * Process all queued actions
 */
export async function processQueue(): Promise<{
  processed: number;
  failed: number;
  remaining: number;
}> {
  // Check connectivity first
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    const queue = await getQueue();
    return { processed: 0, failed: 0, remaining: queue.length };
  }

  const queue = await getQueue();
  let processed = 0;
  let failed = 0;

  for (const action of queue) {
    try {
      await processAction(action);
      await removeFromQueue(action.id);
      processed++;
    } catch (error) {
      action.retries++;
      action.lastAttempt = Date.now();
      action.error = error instanceof Error ? error.message : 'Unknown error';

      if (action.retries >= OFFLINE_CONFIG.MAX_RETRIES) {
        // Move to failed state but keep in queue for manual retry
        await updateAction(action);
        failed++;
      } else {
        await updateAction(action);
      }
    }
  }

  const remaining = (await getQueue()).length;
  return { processed, failed, remaining };
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  total: number;
  pending: number;
  failed: number;
  actions: QueuedAction[];
}> {
  const queue = await getQueue();
  const failed = queue.filter(a => a.retries >= OFFLINE_CONFIG.MAX_RETRIES).length;

  return {
    total: queue.length,
    pending: queue.length - failed,
    failed,
    actions: queue,
  };
}

/**
 * Clear failed actions from queue
 */
export async function clearFailedActions(): Promise<void> {
  const queue = await getQueue();
  const pending = queue.filter(a => a.retries < OFFLINE_CONFIG.MAX_RETRIES);
  await saveQueue(pending);
}

/**
 * Clear entire queue
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
}

/**
 * Retry a specific failed action
 */
export async function retryAction(actionId: string): Promise<boolean> {
  const queue = await getQueue();
  const action = queue.find(a => a.id === actionId);

  if (!action) return false;

  try {
    await processAction(action);
    await removeFromQueue(actionId);
    return true;
  } catch {
    action.retries++;
    action.lastAttempt = Date.now();
    await updateAction(action);
    return false;
  }
}
