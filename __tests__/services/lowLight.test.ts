/**
 * TC-MOB-026 — low light detection.
 */

import {
  nextLowLightState,
  isDarkCapture,
  luma,
  LOW_LIGHT_LUX,
  LOW_LIGHT_CLEAR_LUX,
  DARK_CAPTURE_LUMA,
} from '../../src/utils/lowLight';

describe('nextLowLightState', () => {
  it('warns once the light drops below the threshold', () => {
    expect(nextLowLightState(LOW_LIGHT_LUX - 1, false)).toBe(true);
  });

  it('stays quiet in ordinary indoor light', () => {
    expect(nextLowLightState(300, false)).toBe(false);
  });

  it('does not clear the moment it creeps back over the warn threshold', () => {
    // Hysteresis: a reading hovering on the line would otherwise flicker the
    // banner on and off, which reads as a glitch rather than advice.
    expect(nextLowLightState(LOW_LIGHT_LUX + 1, true)).toBe(true);
  });

  it('clears once it is comfortably bright again', () => {
    expect(nextLowLightState(LOW_LIGHT_CLEAR_LUX, true)).toBe(false);
  });

  it('holds the current state on an unusable reading', () => {
    // A bad sample must not flip the warning either way.
    expect(nextLowLightState(NaN, true)).toBe(true);
    expect(nextLowLightState(NaN, false)).toBe(false);
    expect(nextLowLightState(-1, false)).toBe(false);
  });

  it('warns in total darkness', () => {
    expect(nextLowLightState(0, false)).toBe(true);
  });
});

describe('isDarkCapture', () => {
  it('flags a capture below the luma threshold', () => {
    expect(isDarkCapture(DARK_CAPTURE_LUMA - 1)).toBe(true);
  });

  it('passes a normally lit page', () => {
    // A page in decent light is mostly white paper and averages far above this.
    expect(isDarkCapture(180)).toBe(false);
    expect(isDarkCapture(DARK_CAPTURE_LUMA)).toBe(false);
  });

  it('says nothing when brightness could not be measured', () => {
    // A failed measurement must not masquerade as a dark photo, or the app
    // nags about perfectly good scans.
    expect(isDarkCapture(null)).toBe(false);
    expect(isDarkCapture(NaN)).toBe(false);
  });
});

describe('luma', () => {
  it('maps black and white to the ends of the range', () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(Math.round(luma(255, 255, 255))).toBe(255);
  });

  it('weights green most heavily, as the eye does', () => {
    expect(luma(0, 255, 0)).toBeGreaterThan(luma(255, 0, 0));
    expect(luma(255, 0, 0)).toBeGreaterThan(luma(0, 0, 255));
  });
});
