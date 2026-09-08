/**
 * TC-MOB-057 — bounds and eviction for the offline document cache.
 */

import {
  documentKey,
  localFileName,
  totalSize,
  selectForEviction,
  canEverFit,
  formatBytes,
  MAX_CACHE_BYTES,
  CachedDocument,
  DocumentManifest,
} from '../../src/utils/documentCachePolicy';

const MB = 1024 * 1024;

const doc = (over: Partial<CachedDocument> & { key: string }): CachedDocument => ({
  noticeId: 'n1',
  fileName: 'notice.pdf',
  localUri: `file:///${over.key}`,
  size: MB,
  cachedAt: 0,
  pinned: false,
  lastOpenedAt: 0,
  ...over,
});

const manifestOf = (...docs: CachedDocument[]): DocumentManifest =>
  Object.fromEntries(docs.map((d) => [d.key, d]));

describe('documentKey', () => {
  it('distinguishes a notice PDF from its attachments', () => {
    // Sharing a key would let the first attachment opened overwrite the
    // notice's own document on disk.
    expect(documentKey('n1')).not.toBe(documentKey('n1', 'a1'));
  });

  it('is stable for the same inputs', () => {
    expect(documentKey('n1', 'a1')).toBe(documentKey('n1', 'a1'));
  });

  it('gives different attachments different keys', () => {
    expect(documentKey('n1', 'a1')).not.toBe(documentKey('n1', 'a2'));
  });
});

describe('localFileName', () => {
  it('keeps the extension so viewers pick the right app', () => {
    expect(localFileName('notice:n1', 'return.pdf')).toMatch(/\.pdf$/);
  });

  it('strips characters that are not safe in a path', () => {
    const name = localFileName('attachment:a/1', 'x.pdf');
    expect(name).not.toMatch(/[:/]/);
  });

  it('copes with a file that has no extension', () => {
    expect(localFileName('notice:n1', 'scan')).toBe('notice_n1');
  });
});

describe('totalSize', () => {
  it('sums every entry', () => {
    expect(totalSize(manifestOf(doc({ key: 'a' }), doc({ key: 'b', size: 2 * MB })))).toBe(3 * MB);
  });

  it('is zero for an empty cache', () => {
    expect(totalSize({})).toBe(0);
  });
});

describe('selectForEviction', () => {
  it('evicts nothing when the incoming file fits', () => {
    const manifest = manifestOf(doc({ key: 'a' }));
    expect(selectForEviction(manifest, MB, 10 * MB)).toEqual([]);
  });

  it('evicts the least recently opened first', () => {
    const manifest = manifestOf(
      doc({ key: 'old', lastOpenedAt: 100 }),
      doc({ key: 'new', lastOpenedAt: 900 }),
      doc({ key: 'middle', lastOpenedAt: 500 })
    );
    const evicted = selectForEviction(manifest, MB, 3 * MB);
    expect(evicted.map((e) => e.key)).toEqual(['old']);
  });

  it('evicts as many as needed, oldest first', () => {
    const manifest = manifestOf(
      doc({ key: 'a', lastOpenedAt: 1 }),
      doc({ key: 'b', lastOpenedAt: 2 }),
      doc({ key: 'c', lastOpenedAt: 3 })
    );
    const evicted = selectForEviction(manifest, 2 * MB, 3 * MB);
    expect(evicted.map((e) => e.key)).toEqual(['a', 'b']);
  });

  it('never evicts a pinned document', () => {
    // The user asked for these specifically; dropping them would silently
    // undo an explicit request.
    const manifest = manifestOf(
      doc({ key: 'pinned', pinned: true, lastOpenedAt: 1 }),
      doc({ key: 'loose', lastOpenedAt: 999 })
    );
    const evicted = selectForEviction(manifest, 2 * MB, 2 * MB);
    expect(evicted.map((e) => e.key)).toEqual(['loose']);
  });

  it('returns every unpinned entry when even that will not make room', () => {
    const manifest = manifestOf(doc({ key: 'a' }), doc({ key: 'b' }));
    const evicted = selectForEviction(manifest, 100 * MB, 3 * MB);
    expect(evicted).toHaveLength(2);
  });

  it('has a sane default ceiling', () => {
    expect(MAX_CACHE_BYTES).toBe(200 * MB);
  });
});

describe('canEverFit', () => {
  it('accepts a file that fits alongside the pinned ones', () => {
    const manifest = manifestOf(doc({ key: 'p', pinned: true, size: MB }));
    expect(canEverFit(manifest, MB, 10 * MB)).toBe(true);
  });

  it('rejects a file larger than the whole budget', () => {
    expect(canEverFit({}, 300 * MB, 200 * MB)).toBe(false);
  });

  it('rejects a file that cannot fit beside the pinned ones', () => {
    // Unpinned entries can be evicted; pinned ones cannot, so they set the
    // real ceiling for anything new.
    const manifest = manifestOf(doc({ key: 'p', pinned: true, size: 9 * MB }));
    expect(canEverFit(manifest, 2 * MB, 10 * MB)).toBe(false);
  });

  it('ignores unpinned entries, which can be evicted to make room', () => {
    const manifest = manifestOf(doc({ key: 'loose', size: 9 * MB }));
    expect(canEverFit(manifest, 2 * MB, 10 * MB)).toBe(true);
  });
});

describe('formatBytes', () => {
  it('handles zero and negatives', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
  });

  it('uses bytes, KB and MB at sensible thresholds', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * MB)).toBe('5.0 MB');
  });

  it('drops the decimal once the number is large enough not to need it', () => {
    expect(formatBytes(47 * MB)).toBe('47 MB');
  });
});
