/**
 * Rules for scans waiting to upload (TC-MOB-058).
 *
 * A queued upload is not like the other queued actions. A status change is a
 * small JSON payload that either applies or does not; an upload carries a file
 * that must survive an app restart, runs as a three-step sequence against a
 * short-lived presigned URL, and can fail halfway through on mobile data.
 *
 * The decisions that follow from that — when to retry, when to stop, what to
 * tell the user — are pure, and live here.
 */

export type PendingUploadStatus =
  /** Waiting for a connection. */
  | 'pending'
  /** Currently uploading. */
  | 'uploading'
  /** Failed, but worth another go. */
  | 'failed'
  /** Failed enough times that retrying automatically is just noise. */
  | 'blocked';

export interface PendingUpload {
  id: string;
  /**
   * Durable copy of the scan — NOT the camera's temp URI, which the OS
   * reclaims. Rebuilt from `storedName` on every read: the absolute path does
   * not survive an app update (TC-MOB-088).
   */
  localUri: string;
  /** The file's own name on disk. The half that stays valid across updates. */
  storedName?: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: number;
  attempts: number;
  status: PendingUploadStatus;
  lastError?: string;
}

/**
 * Attempts before a queued upload stops retrying on its own.
 *
 * Three covers a bad connection or a server blip. Beyond that the cause is
 * usually permanent — a file the server rejects, an expired plan — and silent
 * re-attempts every time the device reconnects would burn data and battery
 * without ever succeeding.
 */
export const MAX_UPLOAD_ATTEMPTS = 3;

/** Whether the sync pass should pick this one up. */
export function shouldAttempt(upload: PendingUpload): boolean {
  if (upload.status === 'uploading' || upload.status === 'blocked') return false;
  return upload.attempts < MAX_UPLOAD_ATTEMPTS;
}

/** The status an upload moves to after a failure. */
export function statusAfterFailure(attempts: number): PendingUploadStatus {
  return attempts >= MAX_UPLOAD_ATTEMPTS ? 'blocked' : 'failed';
}

/** Backoff before the next attempt, in ms. Bounded so it never stalls forever. */
export function retryDelay(attempts: number): number {
  const seconds = Math.min(2 ** attempts, 30);
  return seconds * 1000;
}

const STATUS_LABELS: Record<PendingUploadStatus, string> = {
  pending: 'Pending upload',
  uploading: 'Uploading...',
  failed: 'Upload failed — will retry',
  blocked: 'Upload failed',
};

export function uploadStatusLabel(status: PendingUploadStatus): string {
  return STATUS_LABELS[status];
}

/** Summary line for the queue, or undefined when there is nothing waiting. */
export function pendingSummary(uploads: PendingUpload[]): string | undefined {
  if (uploads.length === 0) return undefined;

  const blocked = uploads.filter((u) => u.status === 'blocked').length;
  const waiting = uploads.length - blocked;

  const parts: string[] = [];
  if (waiting > 0) parts.push(`${waiting} pending upload${waiting === 1 ? '' : 's'}`);
  if (blocked > 0) parts.push(`${blocked} failed`);
  return parts.join(' · ');
}

/** Counts driving the badge and the storage row. */
export function countByStatus(uploads: PendingUpload[]): {
  waiting: number;
  blocked: number;
} {
  return {
    waiting: uploads.filter((u) => u.status !== 'blocked').length,
    blocked: uploads.filter((u) => u.status === 'blocked').length,
  };
}

/** Message shown on the scanner when a scan is queued rather than uploaded. */
export const QUEUED_OFFLINE_MESSAGE =
  'Saved on your device. It will upload automatically when you are back online.';

/**
 * The uploads the banner should account for.
 *
 * Blocked entries are excluded: they have exhausted their retries and need a
 * decision, so counting them kept the banner on screen permanently once one
 * existed — which read as the header having grown taller. They are surfaced in
 * Profile → Storage instead, where Retry and Discard live.
 */
export function syncableUploads(uploads: PendingUpload[]): PendingUpload[] {
  return uploads.filter((upload) => upload.status !== 'blocked');
}
