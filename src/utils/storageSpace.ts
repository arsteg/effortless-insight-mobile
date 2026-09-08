/**
 * Deciding whether there is room to scan, and explaining it when there is not
 * (TC-MOB-087).
 *
 * A full disk used to surface as "PDF generation failed" — technically true,
 * useless to act on. The user is told something broke but not that their phone
 * is out of space, so they retry into the same failure. These helpers turn a
 * byte count into a decision and a sentence.
 */

/** Room we want free beyond the scan itself, so the OS is not left starved. */
export const STORAGE_HEADROOM_BYTES = 50 * 1024 * 1024; // 50MB

/** Below this, warn before the user starts scanning. */
export const LOW_STORAGE_WARNING_BYTES = 200 * 1024 * 1024; // 200MB

/** Rough bytes one captured page costs, including the PDF copy of it. */
export const ESTIMATED_BYTES_PER_PAGE = 1.5 * 1024 * 1024;

/** What a scan of `pageCount` pages needs, with headroom. */
export function estimatedScanBytes(pageCount: number): number {
  return Math.max(pageCount, 1) * ESTIMATED_BYTES_PER_PAGE + STORAGE_HEADROOM_BYTES;
}

/** Whether a scan of this size can be written with room to spare. */
export function hasRoomForScan(freeBytes: number | null, pageCount: number): boolean {
  // Unknown free space is treated as sufficient: refusing to scan because the
  // figure could not be read would block a user whose disk is perfectly fine.
  if (freeBytes === null) return true;
  return freeBytes >= estimatedScanBytes(pageCount);
}

/** Whether to warn the user before they start, without blocking them. */
export function isStorageLow(freeBytes: number | null): boolean {
  if (freeBytes === null) return false;
  return freeBytes < LOW_STORAGE_WARNING_BYTES;
}

/** A human figure, e.g. "180 MB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Whether a caught error is the disk being full.
 *
 * Each platform words it differently, and none of them set a usable code, so
 * this matches on the message. A miss only costs the specific wording, not
 * correctness — the generic error path still runs.
 */
export function isOutOfSpaceError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /ENOSPC|no space left|not enough space|insufficient (disk )?space|disk full|out of space/i.test(
    message
  );
}

/** Told to the user when a write fails for lack of room. */
export const OUT_OF_SPACE_MESSAGE =
  'Your device is out of storage, so this scan could not be saved. Free up space — you can clear cached documents in Profile → Storage — then try again.';

/** Shown before scanning when space is tight but a scan is still possible. */
export function lowStorageWarning(freeBytes: number): string {
  return `Only ${formatBytes(freeBytes)} of storage is left. Scanning may fail. You can free space by clearing cached documents in Profile → Storage.`;
}
