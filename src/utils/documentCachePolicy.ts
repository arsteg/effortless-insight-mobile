/**
 * Rules for the on-device document cache (TC-MOB-057).
 *
 * GST notices arrive as multi-megabyte PDFs. Caching them without a ceiling is
 * how an app quietly grows to hundreds of megabytes and gets uninstalled, so
 * the size cap and the eviction order live here as pure functions, testable
 * without touching the file system.
 */

/**
 * Ceiling for the whole document cache.
 *
 * 200MB is roughly a few hundred notice PDFs — generous for the working set a
 * practitioner actually revisits, small enough not to dominate device storage.
 */
export const MAX_CACHE_BYTES = 200 * 1024 * 1024;

/** One cached file. `pinned` entries are kept regardless of age. */
export interface CachedDocument {
  /** Stable identity — see `documentKey`. */
  key: string;
  noticeId: string;
  attachmentId?: string;
  fileName: string;
  /**
   * file:// path on the device. Rebuilt from `storedName` on every read: the
   * container directory changes across an app update (TC-MOB-088).
   */
  localUri: string;
  /** The file's own name on disk. The half that stays valid across updates. */
  storedName?: string;
  size: number;
  cachedAt: number;
  /** Explicitly saved by the user, rather than cached as a side effect. */
  pinned: boolean;
  /** Drives LRU eviction. */
  lastOpenedAt: number;
}

export type DocumentManifest = Record<string, CachedDocument>;

/**
 * Identity for a cached document.
 *
 * A notice's own PDF and its attachments share a notice id, so the attachment
 * id has to be part of the key or the original would be overwritten by the
 * first attachment opened.
 */
export function documentKey(noticeId: string, attachmentId?: string): string {
  return attachmentId ? `attachment:${attachmentId}` : `notice:${noticeId}`;
}

/** A safe on-disk filename. Keeps the extension so viewers pick the right app. */
export function localFileName(key: string, fileName: string): string {
  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeKey}${extension}`;
}

/** Total bytes held. */
export function totalSize(manifest: DocumentManifest): number {
  return Object.values(manifest).reduce((sum, entry) => sum + entry.size, 0);
}

/**
 * Which entries to delete to fit `incomingBytes`.
 *
 * Least-recently-opened first, and **pinned entries are never chosen** — the
 * user asked for those specifically, so evicting them would silently undo an
 * explicit request. Returns [] when nothing needs removing, and every
 * unpinned entry when even that is not enough, so the caller can tell the
 * difference between "made room" and "cannot fit".
 */
export function selectForEviction(
  manifest: DocumentManifest,
  incomingBytes: number,
  maxBytes: number = MAX_CACHE_BYTES
): CachedDocument[] {
  const current = totalSize(manifest);
  let overBy = current + incomingBytes - maxBytes;
  if (overBy <= 0) return [];

  const candidates = Object.values(manifest)
    .filter((entry) => !entry.pinned)
    .sort((a, b) => a.lastOpenedAt - b.lastOpenedAt);

  const evict: CachedDocument[] = [];
  for (const entry of candidates) {
    if (overBy <= 0) break;
    evict.push(entry);
    overBy -= entry.size;
  }
  return evict;
}

/**
 * Whether a file can ever be stored, even with the cache emptied of unpinned
 * entries. Guards against a single download larger than the whole budget.
 */
export function canEverFit(
  manifest: DocumentManifest,
  incomingBytes: number,
  maxBytes: number = MAX_CACHE_BYTES
): boolean {
  if (incomingBytes > maxBytes) return false;
  const pinnedBytes = Object.values(manifest)
    .filter((entry) => entry.pinned)
    .reduce((sum, entry) => sum + entry.size, 0);
  return pinnedBytes + incomingBytes <= maxBytes;
}

/** Human-readable size. Used in settings and on attachment rows. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
}

/** Message shown when a document is wanted offline but was never saved. */
export const NOT_CACHED_OFFLINE_MESSAGE =
  "This document isn't saved on your device. Connect to the internet to open it.";
