/**
 * TC-MOB-026 — reading brightness out of a 1x1 PNG.
 *
 * The fixtures are real PNGs built here with pako, so the decoder is tested
 * against actual encoded bytes rather than a hand-waved stand-in.
 */

import pako from 'pako';
import { meanLumaFrom1x1Png } from '../../src/utils/imageBrightness';
import { luma } from '../../src/utils/lowLight';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** base64 without Buffer — this project carries no Node type definitions. */
function toBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : chars[b2 & 63];
  }
  return out;
}

function chunk(type: string, data: number[]): number[] {
  const typeBytes = [...type].map((c) => c.charCodeAt(0));
  const body = Uint8Array.from([...typeBytes, ...data]);
  const crc = crc32(body);
  const len = data.length;
  return [
    (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255,
    ...body,
    (crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255,
  ];
}

/** A real 1x1 PNG. `filter` proves filter type is irrelevant at this size. */
function png1x1(channels: number[], colorType: number, filter = 0): string {
  const ihdr = [0, 0, 0, 1, 0, 0, 0, 1, 8, colorType, 0, 0, 0];
  const idat: number[] = Array.from(pako.deflate(Uint8Array.from([filter, ...channels])));
  const bytes = Uint8Array.from([
    ...SIGNATURE,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', idat),
    ...chunk('IEND', []),
  ]);
  return toBase64(bytes);
}

describe('meanLumaFrom1x1Png', () => {
  it('reads a mid-grey truecolour pixel', () => {
    expect(meanLumaFrom1x1Png(png1x1([128, 128, 128], 2))).toBeCloseTo(128, 0);
  });

  it('reads black and white', () => {
    expect(meanLumaFrom1x1Png(png1x1([0, 0, 0], 2))).toBeCloseTo(0, 0);
    expect(meanLumaFrom1x1Png(png1x1([255, 255, 255], 2))).toBeCloseTo(255, 0);
  });

  it('handles RGBA, ignoring the alpha channel', () => {
    expect(meanLumaFrom1x1Png(png1x1([10, 200, 40, 255], 6))).toBeCloseTo(luma(10, 200, 40), 0);
  });

  it('handles greyscale', () => {
    expect(meanLumaFrom1x1Png(png1x1([90], 0))).toBe(90);
    expect(meanLumaFrom1x1Png(png1x1([90, 255], 4))).toBe(90);
  });

  it('is unaffected by which row filter the encoder chose', () => {
    // At 1x1 every predictor references out-of-bounds pixels, which are zero,
    // so the stored byte IS the raw byte. This is why no un-filtering is done.
    for (const filter of [0, 1, 2, 3, 4]) {
      expect(meanLumaFrom1x1Png(png1x1([70, 70, 70], 2, filter))).toBeCloseTo(70, 0);
    }
  });

  it('returns null for data that is not a PNG', () => {
    // Null means "unknown", and the caller must not treat it as darkness.
    expect(meanLumaFrom1x1Png(toBase64(Uint8Array.from([104, 101, 108, 108, 111])))).toBeNull();
    expect(meanLumaFrom1x1Png('')).toBeNull();
    expect(meanLumaFrom1x1Png('!!!not base64!!!')).toBeNull();
  });

  it('returns null for a truncated PNG rather than throwing', () => {
    const valid = png1x1([128, 128, 128], 2);
    const decoded = globalThis.atob(valid);
    const bytes = Uint8Array.from([...decoded].slice(0, 20).map((c) => c.charCodeAt(0)));
    const truncated = toBase64(bytes);
    expect(meanLumaFrom1x1Png(truncated)).toBeNull();
  });

  it('returns null for a palette image it cannot interpret', () => {
    expect(meanLumaFrom1x1Png(png1x1([0], 3))).toBeNull();
  });
});
