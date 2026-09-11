/**
 * TC-MOB-038 — MIME typing for the Android document-view intent.
 *
 * The intent's `type` decides which app Android offers. Get it wrong and the
 * chooser is empty, which looks identical to the Custom Tab bug this replaced.
 */

import { mimeTypeFor } from '../../src/services/documentViewer';

describe('mimeTypeFor', () => {
  it('types a PDF, the common case for a notice', () => {
    expect(mimeTypeFor('notice.pdf')).toBe('application/pdf');
  });

  it('ignores case in the extension', () => {
    expect(mimeTypeFor('NOTICE.PDF')).toBe('application/pdf');
    expect(mimeTypeFor('Scan.JPG')).toBe('image/jpeg');
  });

  it('types the image formats a scan can arrive in', () => {
    expect(mimeTypeFor('a.png')).toBe('image/png');
    expect(mimeTypeFor('a.jpg')).toBe('image/jpeg');
    expect(mimeTypeFor('a.jpeg')).toBe('image/jpeg');
    expect(mimeTypeFor('a.heic')).toBe('image/heic');
    expect(mimeTypeFor('a.webp')).toBe('image/webp');
  });

  it('falls back to a wildcard rather than asserting a wrong type', () => {
    // A wrong type gives an empty chooser; the wildcard lets the OS decide.
    expect(mimeTypeFor('mystery.xyz')).toBe('*/*');
    expect(mimeTypeFor('noextension')).toBe('*/*');
    expect(mimeTypeFor('')).toBe('*/*');
  });

  it('uses the last extension on a multi-dotted name', () => {
    expect(mimeTypeFor('GST.notice.2026.pdf')).toBe('application/pdf');
  });

  it('is not fooled by a dot in a directory name', () => {
    expect(mimeTypeFor('my.folder/notice.pdf')).toBe('application/pdf');
  });
});
