/**
 * On-device store for notice PDFs and attachments (TC-MOB-057).
 *
 * Documents were previously streamed straight from a presigned URL into the
 * system browser, so nothing survived the view — a PDF opened seconds earlier
 * was unavailable the moment the device went offline. This downloads to the
 * app's document directory and keeps a manifest alongside it.
 *
 * Two properties matter and are easy to get wrong:
 *
 *  - The cache is bounded. Notice PDFs are large; `selectForEviction` drops
 *    least-recently-opened unpinned files to stay under the ceiling.
 *  - It holds confidential tax documents, so `clearAll` runs on logout. A
 *    shared or resold device must not carry the previous user's notices.
 */

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CachedDocument,
  DocumentManifest,
  documentKey,
  localFileName,
  selectForEviction,
  canEverFit,
  totalSize,
} from '../utils/documentCachePolicy';
import { rehydrateManifest } from '../utils/portableStorage';

const MANIFEST_KEY = '@document_cache_manifest';
const CACHE_DIR = `${FileSystem.documentDirectory}notice-documents/`;

async function readManifest(): Promise<DocumentManifest> {
  try {
    const raw = await AsyncStorage.getItem(MANIFEST_KEY);
    if (!raw) return {};
    // Absolute paths do not survive an app update, so they are rebuilt against
    // the current cache directory on every read (TC-MOB-088). Without this,
    // every document cached before an update read as missing.
    return rehydrateManifest(CACHE_DIR, JSON.parse(raw) as DocumentManifest);
  } catch {
    return {};
  }
}

async function writeManifest(manifest: DocumentManifest): Promise<void> {
  try {
    await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    // A lost manifest orphans files rather than corrupting anything; the next
    // clearAll reclaims them.
  }
}

async function ensureDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/**
 * The cached copy, if there is one and the file still exists.
 *
 * The existence check matters: iOS can reclaim files under storage pressure,
 * and a manifest entry pointing at a deleted file would send the viewer to a
 * path that opens nothing.
 */
export async function getCachedDocument(
  noticeId: string,
  attachmentId?: string
): Promise<CachedDocument | null> {
  const manifest = await readManifest();
  const entry = manifest[documentKey(noticeId, attachmentId)];
  if (!entry) return null;

  const info = await FileSystem.getInfoAsync(entry.localUri);
  if (!info.exists) {
    delete manifest[entry.key];
    await writeManifest(manifest);
    return null;
  }

  return entry;
}

/** Record that a document was opened, so LRU eviction reflects real use. */
export async function touchDocument(noticeId: string, attachmentId?: string): Promise<void> {
  const manifest = await readManifest();
  const entry = manifest[documentKey(noticeId, attachmentId)];
  if (!entry) return;

  entry.lastOpenedAt = Date.now();
  await writeManifest(manifest);
}

export interface DownloadOptions {
  noticeId: string;
  attachmentId?: string;
  fileName: string;
  /** Presigned URL. Short-lived, so it is used immediately and not stored. */
  url: string;
  /** Explicitly saved by the user, and therefore exempt from eviction. */
  pinned?: boolean;
}

/**
 * Download and store a document, evicting older unpinned files if needed.
 *
 * Returns the entry, or null when the download failed — callers fall back to
 * streaming from the URL rather than failing the user's tap.
 */
export async function cacheDocument(
  options: DownloadOptions
): Promise<CachedDocument | null> {
  const { noticeId, attachmentId, fileName, url, pinned = false } = options;
  const key = documentKey(noticeId, attachmentId);

  try {
    await ensureDirectory();
    const storedName = localFileName(key, fileName);
    const localUri = `${CACHE_DIR}${storedName}`;

    const result = await FileSystem.downloadAsync(url, localUri);
    if (result.status !== 200) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      return null;
    }

    const info = await FileSystem.getInfoAsync(localUri);
    const size = info.exists && 'size' in info ? (info.size as number) : 0;

    const manifest = await readManifest();
    // Exclude any previous copy of this same document from the budget maths,
    // otherwise re-downloading a file counts it twice.
    delete manifest[key];

    if (!canEverFit(manifest, size)) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      return null;
    }

    for (const victim of selectForEviction(manifest, size)) {
      await FileSystem.deleteAsync(victim.localUri, { idempotent: true });
      delete manifest[victim.key];
    }

    const entry: CachedDocument = {
      key,
      noticeId,
      attachmentId,
      fileName,
      localUri,
      storedName,
      size,
      cachedAt: Date.now(),
      pinned,
      lastOpenedAt: Date.now(),
    };

    manifest[key] = entry;
    await writeManifest(manifest);
    return entry;
  } catch {
    return null;
  }
}

/** Mark an already-cached document as pinned, exempting it from eviction. */
export async function setPinned(
  noticeId: string,
  attachmentId: string | undefined,
  pinned: boolean
): Promise<void> {
  const manifest = await readManifest();
  const entry = manifest[documentKey(noticeId, attachmentId)];
  if (!entry) return;

  entry.pinned = pinned;
  await writeManifest(manifest);
}

/** Remove one cached document. */
export async function removeDocument(
  noticeId: string,
  attachmentId?: string
): Promise<void> {
  const manifest = await readManifest();
  const key = documentKey(noticeId, attachmentId);
  const entry = manifest[key];
  if (!entry) return;

  await FileSystem.deleteAsync(entry.localUri, { idempotent: true }).catch(() => {});
  delete manifest[key];
  await writeManifest(manifest);
}

/** Bytes currently held, for the settings row. */
export async function getCacheSize(): Promise<number> {
  return totalSize(await readManifest());
}

export async function getCachedCount(): Promise<number> {
  return Object.keys(await readManifest()).length;
}

/**
 * Delete every cached document.
 *
 * Called on logout: these are confidential tax documents, and leaving them in
 * the sandbox for the next person to sign in on the device is not acceptable.
 * Also exposed in settings as "Clear downloads".
 */
export async function clearAll(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  } catch {
    // Directory may not exist yet.
  }
  await AsyncStorage.removeItem(MANIFEST_KEY).catch(() => {});
}

/** Every cached document, for the settings list and the saved-state badges. */
export async function listCachedDocuments(): Promise<CachedDocument[]> {
  const manifest = await readManifest();
  return Object.values(manifest).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}
