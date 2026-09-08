/**
 * Scans captured offline, waiting to upload (TC-MOB-058).
 *
 * The scanner previously called the upload API unconditionally, so going
 * offline mid-scan lost the capture entirely — the generic failure looked no
 * different from a server error, and nothing was retained.
 *
 * Two things make this different from the other queued actions:
 *
 *  - The file must outlive the app. The camera hands back a temp URI the OS
 *    reclaims, so the bytes are copied into the app's own directory before
 *    anything is queued.
 *  - It is stored separately from the document cache, which evicts under
 *    pressure. A pending upload is unsent user work; losing it to make room
 *    for a downloaded PDF would be indefensible.
 */

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { noticesApi } from './api/notices';
import {
  PendingUpload,
  shouldAttempt,
  statusAfterFailure,
  MAX_UPLOAD_ATTEMPTS,
} from '../utils/pendingUploadPolicy';
import { rehydrateAll, fileNameFromUri } from '../utils/portableStorage';

const QUEUE_KEY = '@pending_uploads';
const UPLOAD_DIR = `${FileSystem.documentDirectory}pending-uploads/`;

async function readQueue(): Promise<PendingUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    // The stored absolute path is stale after an app update — the container
    // directory changes — so it is rebuilt from the file name every read
    // (TC-MOB-088). Entries written before this change carry no `storedName`
    // and recover it from their own stale path, so the migration is automatic.
    return rehydrateAll(UPLOAD_DIR, JSON.parse(raw) as PendingUpload[]);
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingUpload[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Nothing useful to do; the file remains on disk for the next write.
  }
}

async function ensureDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(UPLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(UPLOAD_DIR, { intermediates: true });
  }
}

/**
 * Copy a scan somewhere durable and queue it.
 *
 * Returns the queued entry, or null when the file could not be copied — the
 * caller then reports a real failure rather than claiming the scan was saved.
 */
export async function queueUpload(params: {
  uri: string;
  fileName: string;
  contentType: string;
}): Promise<PendingUpload | null> {
  try {
    await ensureDirectory();

    const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // The name is what gets persisted; the directory is re-derived on read.
    const storedName = `${id}-${params.fileName}`;
    const localUri = `${UPLOAD_DIR}${storedName}`;

    // Copy, never move: the source may be a temp file the caller still needs,
    // and a move would leave nothing behind if the write failed halfway.
    await FileSystem.copyAsync({ from: params.uri, to: localUri });

    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) return null;

    const entry: PendingUpload = {
      id,
      localUri,
      storedName,
      fileName: params.fileName,
      contentType: params.contentType,
      size: 'size' in info ? (info.size as number) : 0,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
    };

    const queue = await readQueue();
    queue.push(entry);
    await writeQueue(queue);
    return entry;
  } catch {
    return null;
  }
}

export async function listPendingUploads(): Promise<PendingUpload[]> {
  return (await readQueue()).sort((a, b) => b.createdAt - a.createdAt);
}

/** Delete a queued upload and its file. */
export async function removePendingUpload(id: string): Promise<void> {
  const queue = await readQueue();
  const entry = queue.find((item) => item.id === id);
  if (entry) {
    await FileSystem.deleteAsync(entry.localUri, { idempotent: true }).catch(() => {});
  }
  await writeQueue(queue.filter((item) => item.id !== id));
}

/** Put a blocked upload back in the queue, for the manual Retry control. */
export async function resetPendingUpload(id: string): Promise<void> {
  const queue = await readQueue();
  const entry = queue.find((item) => item.id === id);
  if (!entry) return;

  entry.attempts = 0;
  entry.status = 'pending';
  entry.lastError = undefined;
  await writeQueue(queue);
}

async function updateEntry(
  id: string,
  apply: (entry: PendingUpload) => void
): Promise<void> {
  const queue = await readQueue();
  const entry = queue.find((item) => item.id === id);
  if (!entry) return;
  apply(entry);
  await writeQueue(queue);
}

export interface SyncResult {
  uploaded: number;
  failed: number;
  remaining: number;
}

/**
 * Upload everything waiting.
 *
 * The whole request sequence runs here rather than being captured at queue
 * time: an upload needs a presigned URL, and those expire — a URL obtained
 * while offline would be dead by the time the device reconnected.
 *
 * Entries are processed one at a time. Parallel uploads of multi-megabyte
 * scans over mobile data tend to make every one of them slower and more
 * likely to time out.
 */
export async function syncPendingUploads(): Promise<SyncResult> {
  const queue = await readQueue();
  const candidates = queue.filter(shouldAttempt);

  let uploaded = 0;
  let failed = 0;

  for (const entry of candidates) {
    await updateEntry(entry.id, (item) => {
      item.status = 'uploading';
    });

    try {
      await noticesApi.uploadNotice({
        uri: entry.localUri,
        type: entry.contentType,
        name: entry.fileName,
      });

      // Only remove once the server has it. Deleting on the optimistic path
      // would lose the scan if the confirm step failed.
      await removePendingUpload(entry.id);
      uploaded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Upload failed';
      await updateEntry(entry.id, (item) => {
        item.attempts += 1;
        item.status = statusAfterFailure(item.attempts);
        item.lastError = message;
      });
    }
  }

  const remaining = (await readQueue()).length;
  return { uploaded, failed, remaining };
}

/** Total bytes held by pending uploads, for the storage row. */
export async function getPendingUploadBytes(): Promise<number> {
  return (await readQueue()).reduce((sum, entry) => sum + entry.size, 0);
}

/**
 * Drop every pending upload.
 *
 * Called on logout: a queued scan is an unsent document belonging to the user
 * who captured it, and must not upload under the next account on the device.
 */
export async function clearPendingUploads(): Promise<void> {
  await FileSystem.deleteAsync(UPLOAD_DIR, { idempotent: true }).catch(() => {});
  await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
}

export { MAX_UPLOAD_ATTEMPTS };
