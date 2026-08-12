/**
 * Tests the REAL offline queue implementation (enqueue, size-cap eviction,
 * clearing) against a mocked AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addToQueue,
  removeFromQueue,
  getQueueStatus,
  clearQueue,
} from '../../src/services/storage/offlineQueue';
import { OFFLINE_CONFIG, STORAGE_KEYS } from '../../src/utils/constants';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: false, isInternetReachable: false }),
  addEventListener: jest.fn(() => jest.fn()),
}));

async function readRawQueue(): Promise<Array<{ id: string; payload: Record<string, unknown> }>> {
  const json = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
  return json ? JSON.parse(json) : [];
}

describe('offlineQueue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('enqueues an action and reports it as pending', async () => {
    const id = await addToQueue('create_comment', { noticeId: 'n1', content: 'hello' });
    expect(id).toBeTruthy();

    const status = await getQueueStatus();
    expect(status.pending).toBe(1);

    const raw = await readRawQueue();
    expect(raw).toHaveLength(1);
    expect(raw[0].payload).toEqual({ noticeId: 'n1', content: 'hello' });
  });

  it('removes a queued action by id', async () => {
    const id = await addToQueue('update_task', { taskId: 't1' });
    await removeFromQueue(id);
    expect(await readRawQueue()).toHaveLength(0);
  });

  it('evicts the oldest entry once MAX_QUEUE_SIZE is reached', async () => {
    for (let i = 0; i < OFFLINE_CONFIG.MAX_QUEUE_SIZE + 1; i++) {
      await addToQueue('update_task', { taskId: `t${i}` });
    }

    const raw = await readRawQueue();
    expect(raw).toHaveLength(OFFLINE_CONFIG.MAX_QUEUE_SIZE);
    // The first-enqueued item (t0) must have been dropped, not the newest.
    expect(raw[0].payload).toEqual({ taskId: 't1' });
    expect(raw[raw.length - 1].payload).toEqual({
      taskId: `t${OFFLINE_CONFIG.MAX_QUEUE_SIZE}`,
    });
  });

  it('clearQueue empties the queue', async () => {
    await addToQueue('update_task', { taskId: 't1' });
    await clearQueue();
    expect(await readRawQueue()).toHaveLength(0);
  });
});
