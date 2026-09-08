/**
 * Crop coordinate maths — TC-MOB-021.
 *
 * The preview is letterboxed by `resizeMode: contain`, so the selection the
 * user drags (container points) and the crop the manipulator needs (source
 * pixels) differ by BOTH a scale factor and an offset. Getting either wrong
 * silently crops the wrong region — which looks like a rendering bug, not a
 * maths bug, so it is worth pinning down here.
 */
import { toSourceCrop, fullRectFrom, clamp } from '../../src/components/scanner/CropEditor';

/** A 4000x3000 photo shown letterboxed inside a 300x300 canvas. */
const NATURAL = { width: 4000, height: 3000 };
// contain fit: scale = 300/4000 = 0.075 -> 300x225, centred vertically
const FRAME = { x: 0, y: 37.5, width: 300, height: 225, scale: 0.075 };

describe('toSourceCrop', () => {
  it('maps a full-image selection back to the whole source', () => {
    const full = fullRectFrom(FRAME)!;

    expect(toSourceCrop(full, FRAME, NATURAL)).toEqual({
      originX: 0,
      originY: 0,
      width: 4000,
      height: 3000,
    });
  });

  it('removes the letterbox offset — a crop at the image top is y=0, not y=37.5', () => {
    const topHalf = { left: 0, top: FRAME.y, right: 300, bottom: FRAME.y + 112.5 };

    const result = toSourceCrop(topHalf, FRAME, NATURAL);

    expect(result.originY).toBe(0);
    expect(result.height).toBe(1500); // half of 3000
  });

  it('scales an inset selection into source pixels', () => {
    // 30pt in from the left, 22.5pt down from the image top.
    const inset = {
      left: 30,
      top: FRAME.y + 22.5,
      right: 270,
      bottom: FRAME.y + 202.5,
    };

    expect(toSourceCrop(inset, FRAME, NATURAL)).toEqual({
      originX: 400, // 30 / 0.075
      originY: 300, // 22.5 / 0.075
      width: 3200, // 240 / 0.075
      height: 2400, // 180 / 0.075
    });
  });

  it('never returns a crop that runs past the source bounds', () => {
    // A drag that ended slightly outside the frame.
    const overshoot = { left: -20, top: FRAME.y - 20, right: 320, bottom: FRAME.y + 245 };

    const r = toSourceCrop(overshoot, FRAME, NATURAL);

    expect(r.originX).toBeGreaterThanOrEqual(0);
    expect(r.originY).toBeGreaterThanOrEqual(0);
    expect(r.originX + r.width).toBeLessThanOrEqual(NATURAL.width);
    expect(r.originY + r.height).toBeLessThanOrEqual(NATURAL.height);
  });

  it('always returns whole pixels — the native manipulator rejects fractions', () => {
    const odd = { left: 13.7, top: FRAME.y + 9.3, right: 271.1, bottom: FRAME.y + 199.9 };

    const r = toSourceCrop(odd, FRAME, NATURAL);

    for (const v of [r.originX, r.originY, r.width, r.height]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('never returns a zero-sized crop', () => {
    const degenerate = { left: 100, top: FRAME.y + 100, right: 100, bottom: FRAME.y + 100 };

    const r = toSourceCrop(degenerate, FRAME, NATURAL);

    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  it('handles a portrait image letterboxed horizontally', () => {
    const portrait = { width: 3000, height: 4000 };
    const frame = { x: 37.5, y: 0, width: 225, height: 300, scale: 0.075 };

    expect(toSourceCrop(fullRectFrom(frame)!, frame, portrait)).toEqual({
      originX: 0,
      originY: 0,
      width: 3000,
      height: 4000,
    });
  });
});

describe('fullRectFrom', () => {
  it('returns null before layout is known', () => {
    expect(fullRectFrom(null)).toBeNull();
  });

  it('covers exactly the visible image', () => {
    expect(fullRectFrom(FRAME)).toEqual({ left: 0, top: 37.5, right: 300, bottom: 262.5 });
  });
});

describe('clamp', () => {
  it('bounds a value both ways', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('survives an inverted range instead of returning NaN', () => {
    // Happens transiently when the crop is smaller than the minimum size.
    expect(clamp(5, 10, 0)).toBe(10);
  });
});
