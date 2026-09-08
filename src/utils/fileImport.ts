/**
 * Validation for files imported from the device's file system (TC-MOB-029).
 *
 * These rules deliberately mirror the API's `PresignedUploadRequestValidator`
 * so a file that will be rejected server-side is caught before the upload
 * starts, instead of after the user has waited through it.
 *
 * Keep in step with the API allowlist if that ever changes.
 */

/** Content types the API accepts on the notice upload endpoint. */
export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

/** Server limit, in bytes. */
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Extension -> content type, used when the picker reports a useless MIME. */
const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
};

export interface ImportedFile {
  name: string;
  /** What the picker reported. Often unreliable on Android. */
  mimeType?: string | null;
  /** Bytes, when the picker provides it. */
  size?: number | null;
}

export type ImportValidation =
  | { ok: true; contentType: string; isPdf: boolean }
  | { ok: false; error: string };

/** Lower-cased extension without the dot, or '' when there isn't one. */
export function extensionOf(fileName: string): string {
  const trimmed = fileName.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return '';
  return trimmed.slice(dot + 1).toLowerCase();
}

/**
 * Decide the content type to upload with, and reject anything the API would.
 *
 * Android file providers frequently report `application/octet-stream` for a
 * perfectly good PDF. Trusting that verbatim gets the upload rejected by the
 * server, so the extension is used as the fallback source of truth.
 */
export function validateImportedFile(file: ImportedFile): ImportValidation {
  const extension = extensionOf(file.name);
  const reported = (file.mimeType || '').toLowerCase().split(';')[0].trim();

  const contentType = (ALLOWED_CONTENT_TYPES as readonly string[]).includes(reported)
    ? reported
    : EXTENSION_TYPES[extension];

  if (!contentType) {
    return {
      ok: false,
      error: 'That file type is not supported. Choose a PDF or an image.',
    };
  }

  // Size is optional on some providers; only enforce it when known.
  if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE) {
    const megabytes = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `This file is ${megabytes}MB. The limit is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }

  if (typeof file.size === 'number' && file.size <= 0) {
    return { ok: false, error: 'That file is empty.' };
  }

  return { ok: true, contentType, isPdf: contentType === 'application/pdf' };
}
