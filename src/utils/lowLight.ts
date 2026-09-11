/**
 * Telling the user the light is too poor to scan (TC-MOB-026).
 *
 * `expo-camera` exposes no frame callback — the only events are onCameraReady,
 * onMountError and onResponsiveOrientationChanged — so the app cannot inspect
 * what the viewfinder sees. That leaves two honest signals, and this module
 * holds the arithmetic for both so it can be tested without a camera:
 *
 *  - **Before the shot (Android):** the hardware ambient-light sensor, in lux.
 *    iOS exposes no equivalent to apps, so there the warning cannot exist.
 *  - **After the shot (both):** the mean brightness of the captured image.
 *
 * An earlier attempt at frame analysis in this screen faked itself with
 * Math.random(); the rule since then is that a warning must come from a real
 * measurement or not be shown at all.
 */

/* ------------------------------------------------------------------ *
 * Ambient light (Android only)
 * ------------------------------------------------------------------ */

/**
 * Below this, warn. Office lighting is 300-500 lux and a dim living room
 * around 50; at 30 a document photo is already noisy enough to hurt OCR.
 */
export const LOW_LIGHT_LUX = 30;

/**
 * Clear the warning only once it is comfortably bright again. Without this gap
 * a reading hovering on the threshold flickers the banner on and off, which
 * reads as a glitch rather than advice.
 */
export const LOW_LIGHT_CLEAR_LUX = 60;

/**
 * Next warning state, given the reading and what is on screen now.
 *
 * Written as a transition rather than a predicate because the thresholds are
 * asymmetric — see LOW_LIGHT_CLEAR_LUX.
 */
export function nextLowLightState(lux: number, showing: boolean): boolean {
  if (!Number.isFinite(lux) || lux < 0) return showing; // bad reading: hold
  if (showing) return lux < LOW_LIGHT_CLEAR_LUX;
  return lux < LOW_LIGHT_LUX;
}

/* ------------------------------------------------------------------ *
 * Captured-image brightness (both platforms)
 * ------------------------------------------------------------------ */

/**
 * Mean luma below which a capture is called dark, 0-255.
 *
 * A page shot in reasonable light averages well above 120 — it is mostly white
 * paper. 70 is dim enough that the text is going grey against the background.
 */
export const DARK_CAPTURE_LUMA = 70;

/** Rec. 601 luma. Matches how the eye weights the channels. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function isDarkCapture(meanLuma: number | null): boolean {
  // Unknown brightness is not a reason to nag: a failed measurement must not
  // masquerade as a dark photo.
  if (meanLuma === null || !Number.isFinite(meanLuma)) return false;
  return meanLuma < DARK_CAPTURE_LUMA;
}

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

export const LOW_LIGHT_KEY = 'upload.lowLightDetected';
export const LOW_LIGHT_HINT_KEY = 'upload.lowLightHint';
export const DARK_CAPTURE_TITLE_KEY = 'upload.darkScanTitle';
export const DARK_CAPTURE_BODY_KEY = 'upload.darkScanBody';
