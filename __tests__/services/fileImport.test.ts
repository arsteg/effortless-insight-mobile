/**
 * Imported-file validation — TC-MOB-029.
 *
 * These mirror the API's PresignedUploadRequestValidator. The point is to fail
 * BEFORE the upload rather than after it, and — critically — to survive the
 * Android file providers that report a useless MIME type for a valid PDF.
 */
import {
  validateImportedFile,
  extensionOf,
  MAX_FILE_SIZE,
} from '../../src/utils/fileImport';

describe('extensionOf', () => {
  it('reads a plain extension', () => {
    expect(extensionOf('notice.pdf')).toBe('pdf');
  });

  it('is case-insensitive', () => {
    expect(extensionOf('NOTICE.PDF')).toBe('pdf');
  });

  it('uses the last extension only', () => {
    expect(extensionOf('scan.2026.01.notice.pdf')).toBe('pdf');
  });

  it('returns empty for a name with no extension', () => {
    expect(extensionOf('notice')).toBe('');
    expect(extensionOf('notice.')).toBe('');
    expect(extensionOf('.hidden')).toBe('');
  });
});

describe('validateImportedFile', () => {
  it('accepts a PDF the picker identified correctly', () => {
    const result = validateImportedFile({
      name: 'notice.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    });

    expect(result).toEqual({ ok: true, contentType: 'application/pdf', isPdf: true });
  });

  it('rescues a PDF that Android reported as octet-stream', () => {
    // The exact failure this guards: passing octet-stream through gets the
    // upload rejected by the server's content-type allowlist.
    const result = validateImportedFile({
      name: 'notice.pdf',
      mimeType: 'application/octet-stream',
      size: 2048,
    });

    expect(result).toEqual({ ok: true, contentType: 'application/pdf', isPdf: true });
  });

  it('rescues a PDF with no MIME type at all', () => {
    const result = validateImportedFile({ name: 'notice.PDF', mimeType: null, size: 2048 });

    expect(result.ok).toBe(true);
    expect(result.ok && result.contentType).toBe('application/pdf');
  });

  it('strips MIME parameters before matching', () => {
    const result = validateImportedFile({
      name: 'notice.pdf',
      mimeType: 'application/pdf; charset=binary',
      size: 100,
    });

    expect(result.ok).toBe(true);
  });

  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['photo.png', 'image/png'],
    ['photo.heic', 'image/heic'],
    ['photo.heif', 'image/heif'],
  ])('accepts %s as an image, not a PDF', (name, expected) => {
    const result = validateImportedFile({ name, mimeType: null, size: 500 });

    expect(result.ok && result.contentType).toBe(expected);
    expect(result.ok && result.isPdf).toBe(false);
  });

  it('rejects a type the server would refuse', () => {
    const result = validateImportedFile({
      name: 'notice.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 500,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/not supported/i);
  });

  it('rejects a file over the server limit, naming the size', () => {
    const result = validateImportedFile({
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      size: MAX_FILE_SIZE + 1,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/25MB/);
  });

  it('accepts a file exactly on the limit', () => {
    const result = validateImportedFile({
      name: 'big.pdf',
      mimeType: 'application/pdf',
      size: MAX_FILE_SIZE,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects an empty file', () => {
    const result = validateImportedFile({ name: 'empty.pdf', mimeType: 'application/pdf', size: 0 });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/empty/i);
  });

  it('accepts when the picker gives no size', () => {
    // Some providers omit it; that must not block a valid import.
    const result = validateImportedFile({ name: 'notice.pdf', mimeType: 'application/pdf' });

    expect(result.ok).toBe(true);
  });

  it('rejects a file with neither a usable MIME nor extension', () => {
    const result = validateImportedFile({ name: 'scan', mimeType: 'application/octet-stream' });

    expect(result.ok).toBe(false);
  });
});
