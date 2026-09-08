/**
 * TC-MOB-087 — low storage handling.
 */

import {
  hasRoomForScan,
  isStorageLow,
  isOutOfSpaceError,
  formatBytes,
  estimatedScanBytes,
  STORAGE_HEADROOM_BYTES,
  LOW_STORAGE_WARNING_BYTES,
} from '../../src/utils/storageSpace';

const MB = 1024 * 1024;

describe('hasRoomForScan', () => {
  it('allows a scan when there is plenty of room', () => {
    expect(hasRoomForScan(2000 * MB, 10)).toBe(true);
  });

  it('refuses when the estimate exceeds free space', () => {
    expect(hasRoomForScan(10 * MB, 10)).toBe(false);
  });

  it('treats unknown free space as sufficient', () => {
    // Blocking a scan because the figure could not be read would strand a user
    // whose disk is perfectly fine.
    expect(hasRoomForScan(null, 30)).toBe(true);
  });

  it('reserves headroom beyond the scan itself', () => {
    // Exactly the scan size is not enough; the OS needs room too.
    expect(hasRoomForScan(estimatedScanBytes(5) - 1, 5)).toBe(false);
    expect(hasRoomForScan(estimatedScanBytes(5), 5)).toBe(true);
  });

  it('costs more for more pages', () => {
    expect(estimatedScanBytes(20)).toBeGreaterThan(estimatedScanBytes(2));
  });

  it('never estimates below one page', () => {
    expect(estimatedScanBytes(0)).toBeGreaterThan(STORAGE_HEADROOM_BYTES);
  });
});

describe('isStorageLow', () => {
  it('warns below the threshold', () => {
    expect(isStorageLow(LOW_STORAGE_WARNING_BYTES - 1)).toBe(true);
  });

  it('stays quiet at or above it', () => {
    expect(isStorageLow(LOW_STORAGE_WARNING_BYTES)).toBe(false);
    expect(isStorageLow(5000 * MB)).toBe(false);
  });

  it('does not warn when free space is unknown', () => {
    expect(isStorageLow(null)).toBe(false);
  });
});

describe('isOutOfSpaceError', () => {
  it('recognises each platform wording', () => {
    expect(isOutOfSpaceError(new Error('ENOSPC: no space left on device'))).toBe(true);
    expect(isOutOfSpaceError(new Error('There is not enough space on the disk.'))).toBe(true);
    expect(isOutOfSpaceError(new Error('Insufficient disk space'))).toBe(true);
    expect(isOutOfSpaceError('disk full')).toBe(true);
  });

  it('does not claim an unrelated failure was a full disk', () => {
    // A wrong diagnosis sends the user to delete files for no reason.
    expect(isOutOfSpaceError(new Error('Network request failed'))).toBe(false);
    expect(isOutOfSpaceError(new Error('401 Unauthorized'))).toBe(false);
  });

  it('handles a non-error value', () => {
    expect(isOutOfSpaceError(null)).toBe(false);
    expect(isOutOfSpaceError(undefined)).toBe(false);
    expect(isOutOfSpaceError({ weird: true })).toBe(false);
  });
});

describe('formatBytes', () => {
  it('scales the unit to the size', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(200 * 1024)).toBe('200 KB');
    expect(formatBytes(180 * MB)).toBe('180 MB');
    expect(formatBytes(2 * 1024 * MB)).toBe('2.0 GB');
  });
});
