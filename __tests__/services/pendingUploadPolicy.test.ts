/**
 * TC-MOB-058 — retry and reporting rules for scans queued offline.
 */

import {
  shouldAttempt,
  statusAfterFailure,
  retryDelay,
  uploadStatusLabel,
  pendingSummary,
  countByStatus,
  syncableUploads,
  MAX_UPLOAD_ATTEMPTS,
  PendingUpload,
  PendingUploadStatus,
} from '../../src/utils/pendingUploadPolicy';

const upload = (over: Partial<PendingUpload> = {}): PendingUpload => ({
  id: 'u1',
  localUri: 'file:///pending/u1.pdf',
  fileName: 'notice.pdf',
  contentType: 'application/pdf',
  size: 1024,
  createdAt: 0,
  attempts: 0,
  status: 'pending',
  ...over,
});

describe('shouldAttempt', () => {
  it('picks up a freshly queued scan', () => {
    expect(shouldAttempt(upload())).toBe(true);
  });

  it('retries one that failed but has attempts left', () => {
    expect(shouldAttempt(upload({ status: 'failed', attempts: 1 }))).toBe(true);
  });

  it('skips one already uploading, so a slow sync is not started twice', () => {
    expect(shouldAttempt(upload({ status: 'uploading' }))).toBe(false);
  });

  it('skips a blocked upload', () => {
    // Re-attempting on every reconnect would burn data and battery on
    // something that cannot succeed.
    expect(shouldAttempt(upload({ status: 'blocked', attempts: 3 }))).toBe(false);
  });

  it('stops once the attempt limit is reached, even if status lags', () => {
    expect(shouldAttempt(upload({ status: 'failed', attempts: MAX_UPLOAD_ATTEMPTS }))).toBe(
      false
    );
  });
});

describe('statusAfterFailure', () => {
  it('stays retryable below the limit', () => {
    expect(statusAfterFailure(1)).toBe('failed');
    expect(statusAfterFailure(MAX_UPLOAD_ATTEMPTS - 1)).toBe('failed');
  });

  it('blocks at the limit', () => {
    expect(statusAfterFailure(MAX_UPLOAD_ATTEMPTS)).toBe('blocked');
    expect(statusAfterFailure(MAX_UPLOAD_ATTEMPTS + 1)).toBe('blocked');
  });

  it('allows three attempts before giving up', () => {
    expect(MAX_UPLOAD_ATTEMPTS).toBe(3);
  });
});

describe('retryDelay', () => {
  it('backs off as attempts accumulate', () => {
    expect(retryDelay(1)).toBeLessThan(retryDelay(2));
    expect(retryDelay(2)).toBeLessThan(retryDelay(3));
  });

  it('is bounded, so a retry never stalls indefinitely', () => {
    expect(retryDelay(50)).toBe(30_000);
  });
});

describe('uploadStatusLabel', () => {
  it('says "Pending upload" for a queued scan — the test case wording', () => {
    expect(uploadStatusLabel('pending')).toBe('Pending upload');
  });

  it('gives every status a distinct label', () => {
    const statuses: PendingUploadStatus[] = ['pending', 'uploading', 'failed', 'blocked'];
    const labels = statuses.map(uploadStatusLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('distinguishes a failure that will retry from one that will not', () => {
    expect(uploadStatusLabel('failed')).toMatch(/retry/i);
    expect(uploadStatusLabel('blocked')).not.toMatch(/retry/i);
  });
});

describe('pendingSummary', () => {
  it('is undefined when nothing is queued, so the row can be hidden', () => {
    expect(pendingSummary([])).toBeUndefined();
  });

  it('counts a single upload in the singular', () => {
    expect(pendingSummary([upload()])).toBe('1 pending upload');
  });

  it('pluralises', () => {
    expect(pendingSummary([upload({ id: 'a' }), upload({ id: 'b' })])).toBe(
      '2 pending uploads'
    );
  });

  it('reports blocked uploads separately from waiting ones', () => {
    const summary = pendingSummary([
      upload({ id: 'a' }),
      upload({ id: 'b', status: 'blocked' }),
    ]);
    expect(summary).toBe('1 pending upload · 1 failed');
  });

  it('reports only failures when nothing is still waiting', () => {
    expect(pendingSummary([upload({ status: 'blocked' })])).toBe('1 failed');
  });
});

describe('countByStatus', () => {
  it('separates waiting from blocked', () => {
    expect(
      countByStatus([
        upload({ id: 'a' }),
        upload({ id: 'b', status: 'failed' }),
        upload({ id: 'c', status: 'blocked' }),
      ])
    ).toEqual({ waiting: 2, blocked: 1 });
  });

  it('handles an empty queue', () => {
    expect(countByStatus([])).toEqual({ waiting: 0, blocked: 0 });
  });
});

describe('syncableUploads', () => {
  it('keeps entries that can still be retried', () => {
    const items = [upload({ id: 'a' }), upload({ id: 'b', status: 'failed' })];
    expect(syncableUploads(items).map((u) => u.id)).toEqual(['a', 'b']);
  });

  it('excludes blocked entries', () => {
    // Counting these kept the offline banner on screen permanently once one
    // existed, which read as the header having grown taller on every tab.
    const items = [upload({ id: 'a' }), upload({ id: 'b', status: 'blocked' })];
    expect(syncableUploads(items).map((u) => u.id)).toEqual(['a']);
  });

  it('returns nothing when everything is blocked, so the banner hides', () => {
    expect(syncableUploads([upload({ status: 'blocked' })])).toEqual([]);
  });

  it('keeps an in-flight upload visible', () => {
    expect(syncableUploads([upload({ status: 'uploading' })])).toHaveLength(1);
  });
});
