/**
 * TC-MOB-088 — persisted file references surviving an app update.
 */

import type { PortableFileEntry } from '../../src/utils/portableStorage';
import {
  fileNameFromUri,
  rehydrateEntry,
  rehydrateAll,
  rehydrateManifest,
} from '../../src/utils/portableStorage';

// The container UUID differs between installs; that is the whole problem.
const OLD_DIR = 'file:///var/mobile/Containers/Data/Application/AAAA-1111/Documents/pending-uploads/';
const NEW_DIR = 'file:///var/mobile/Containers/Data/Application/BBBB-2222/Documents/pending-uploads/';

describe('fileNameFromUri', () => {
  it('takes the last path segment', () => {
    expect(fileNameFromUri(`${OLD_DIR}upload-1-notice.pdf`)).toBe('upload-1-notice.pdf');
  });

  it('ignores a query string', () => {
    expect(fileNameFromUri('https://x.test/a/b/scan.jpg?token=abc')).toBe('scan.jpg');
  });

  it('tolerates a trailing slash', () => {
    expect(fileNameFromUri('file:///a/b/')).toBe('b');
  });

  it('returns a bare name unchanged', () => {
    expect(fileNameFromUri('scan.jpg')).toBe('scan.jpg');
  });
});

describe('rehydrateEntry', () => {
  it('repoints a stale path at the current directory', () => {
    // The exact failure this fixes: an entry written by the previous install.
    const stored = { localUri: `${OLD_DIR}upload-1-notice.pdf` };
    expect(rehydrateEntry(NEW_DIR, stored).localUri).toBe(`${NEW_DIR}upload-1-notice.pdf`);
  });

  it('recovers storedName from a legacy entry that has none', () => {
    // Migration has to be automatic — there is no upgrade step to run.
    const stored: PortableFileEntry = { localUri: `${OLD_DIR}upload-1-notice.pdf` };
    expect(rehydrateEntry(NEW_DIR, stored).storedName).toBe('upload-1-notice.pdf');
  });

  it('prefers storedName over the stale path', () => {
    const stored = { storedName: 'real.pdf', localUri: `${OLD_DIR}stale.pdf` };
    expect(rehydrateEntry(NEW_DIR, stored).localUri).toBe(`${NEW_DIR}real.pdf`);
  });

  it('is stable when the directory has not changed', () => {
    const stored = { storedName: 'a.pdf', localUri: `${OLD_DIR}a.pdf` };
    expect(rehydrateEntry(OLD_DIR, stored)).toEqual(stored);
  });

  it('keeps every other field intact', () => {
    const stored = { storedName: 'a.pdf', localUri: `${OLD_DIR}a.pdf`, size: 42, pinned: true };
    const out = rehydrateEntry(NEW_DIR, stored);
    expect(out.size).toBe(42);
    expect(out.pinned).toBe(true);
  });
});

describe('rehydrateAll / rehydrateManifest', () => {
  it('repoints every queued upload', () => {
    const out = rehydrateAll(NEW_DIR, [
      { localUri: `${OLD_DIR}a.pdf` },
      { localUri: `${OLD_DIR}b.jpg` },
    ]);
    expect(out.map((e) => e.localUri)).toEqual([`${NEW_DIR}a.pdf`, `${NEW_DIR}b.jpg`]);
  });

  it('repoints a manifest without losing its keys', () => {
    const out = rehydrateManifest(NEW_DIR, {
      'notice-1': { localUri: `${OLD_DIR}x.pdf` },
    });
    expect(Object.keys(out)).toEqual(['notice-1']);
    expect(out['notice-1'].localUri).toBe(`${NEW_DIR}x.pdf`);
  });

  it('handles an empty store', () => {
    expect(rehydrateAll(NEW_DIR, [])).toEqual([]);
    expect(rehydrateManifest(NEW_DIR, {})).toEqual({});
  });
});
