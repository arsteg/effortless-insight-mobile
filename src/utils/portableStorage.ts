/**
 * Keeping persisted file references valid across an app update (TC-MOB-088).
 *
 * The queue and the document cache both stored an absolute `file:///.../
 * pending-uploads/x.pdf` in AsyncStorage. Apple documents the app container
 * path as unstable — it changes on reinstall and can change across updates —
 * so after an update every stored path pointed at a directory that no longer
 * existed. Queued scans failed with file-not-found and cached documents read
 * as missing: the user's unsent work, silently destroyed by an update.
 *
 * The fix is to persist only the file's own name and rebuild the absolute path
 * at read time against the directory as it is *now*. Callers keep using
 * `entry.localUri`; it is simply reconstituted on the way out of storage.
 */

/** Bump when a persisted shape changes in a way older readers cannot handle. */
export const STORAGE_SCHEMA_VERSION = 1;

/** Anything persisted that points at a file on disk. */
export interface PortableFileEntry {
  /** The file's own name, with no directory part. The durable half. */
  storedName?: string;
  /** Absolute path. Rebuilt on read; never trusted from storage. */
  localUri: string;
}

/**
 * The file's own name, with any directory part removed.
 *
 * Tolerates a trailing slash and a query string so a URI that arrived from
 * elsewhere still yields something usable.
 */
export function fileNameFromUri(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  const trimmed = withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
  const lastSlash = trimmed.lastIndexOf('/');
  return lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
}

/**
 * Rebuild an entry's absolute path against the current directory.
 *
 * Entries written before this change carry no `storedName`, so it is recovered
 * from the stale absolute path — the directory is wrong after an update, but
 * the file name never was. That makes the migration automatic: no version
 * check, no one-time upgrade step that could itself fail halfway.
 */
export function rehydrateEntry<T extends PortableFileEntry>(directory: string, entry: T): T {
  const storedName = entry.storedName || fileNameFromUri(entry.localUri);
  return { ...entry, storedName, localUri: `${directory}${storedName}` };
}

/** `rehydrateEntry` across a list. */
export function rehydrateAll<T extends PortableFileEntry>(directory: string, entries: T[]): T[] {
  return entries.map((entry) => rehydrateEntry(directory, entry));
}

/** `rehydrateEntry` across a keyed manifest. */
export function rehydrateManifest<T extends PortableFileEntry>(
  directory: string,
  manifest: Record<string, T>
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, entry] of Object.entries(manifest)) {
    out[key] = rehydrateEntry(directory, entry);
  }
  return out;
}
