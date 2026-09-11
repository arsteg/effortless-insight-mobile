/**
 * Measuring how bright a captured photo is (TC-MOB-026).
 *
 * `expo-image-manipulator` hands back base64, not pixels, so the brightness has
 * to be decoded out of an encoded image. The trick that keeps this cheap and
 * correct is to resize the capture to a **single pixel** first: the resampler
 * averages the whole frame for us, and a 1x1 PNG is trivial to decode.
 *
 * It also sidesteps PNG's row filters. Every filter predicts from the pixel to
 * the left and the row above; for the only pixel in a 1x1 image both are out of
 * bounds and therefore zero, so the stored byte IS the raw byte whichever
 * filter the encoder picked. No un-filtering, no edge cases.
 *
 * JPEG is not usable here — decoding it needs a full DCT implementation.
 */

import pako from 'pako';
import { luma } from './lowLight';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Channels per pixel, by PNG colour type. Types 3 (palette) is unsupported. */
const CHANNELS: Record<number, number> = {
  0: 1, // greyscale
  2: 3, // truecolour
  4: 2, // greyscale + alpha
  6: 4, // truecolour + alpha
};

function base64ToBytes(base64: string): Uint8Array {
  // Hermes provides atob; guard anyway so a missing one reads as "unknown"
  // rather than throwing into the caller.
  const decode = (globalThis as { atob?: (s: string) => string }).atob;
  if (!decode) throw new Error('atob unavailable');
  const binary = decode(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

/**
 * Mean luma (0-255) of a 1x1 PNG, or null when it cannot be read.
 *
 * Returns null rather than guessing: a failed measurement must not read as a
 * dark photo, or the app nags about perfectly good scans.
 */
export function meanLumaFrom1x1Png(base64: string): number | null {
  try {
    const bytes = base64ToBytes(base64);

    if (bytes.length < 8) return null;
    for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
      if (bytes[i] !== PNG_SIGNATURE[i]) return null;
    }

    let bitDepth = 8;
    let colorType = 6;
    const idatParts: Uint8Array[] = [];

    // Walk the chunk list: length(4) type(4) data(length) crc(4).
    let offset = 8;
    while (offset + 8 <= bytes.length) {
      const length = readUint32(bytes, offset);
      const type = String.fromCharCode(
        bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]
      );
      const dataStart = offset + 8;
      if (dataStart + length > bytes.length) return null;

      if (type === 'IHDR') {
        bitDepth = bytes[dataStart + 8];
        colorType = bytes[dataStart + 9];
        const interlaced = bytes[dataStart + 12];
        // 16-bit and interlaced images would need wider handling; a 1x1 written
        // by the manipulator is neither.
        if (bitDepth !== 8 || interlaced !== 0) return null;
      } else if (type === 'IDAT') {
        idatParts.push(bytes.subarray(dataStart, dataStart + length));
      } else if (type === 'IEND') {
        break;
      }

      offset = dataStart + length + 4;
    }

    const channels = CHANNELS[colorType];
    if (!channels || idatParts.length === 0) return null;

    // Concatenate IDAT chunks — the zlib stream may be split across them.
    const totalLength = idatParts.reduce((sum, part) => sum + part.length, 0);
    const compressed = new Uint8Array(totalLength);
    let written = 0;
    for (const part of idatParts) {
      compressed.set(part, written);
      written += part.length;
    }

    const raw = pako.inflate(compressed);
    // One scanline: a filter byte, then the pixel's channels.
    if (raw.length < 1 + channels) return null;

    if (channels <= 2) {
      const grey = raw[1]; // greyscale, with or without alpha
      return grey;
    }
    return luma(raw[1], raw[2], raw[3]);
  } catch {
    // Malformed data, a missing atob, an inflate failure — all mean "unknown".
    return null;
  }
}
