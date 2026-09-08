/**
 * Double-back-to-exit on Android (TC-MOB-075).
 *
 * Pressing back at a tab root closed the app immediately. That is Android's
 * default, but it is not what people expect, and it matters more here than in
 * most apps: a stray press while a scan is queued or a form is half-filled
 * closes the product with no warning.
 */

/** How long the second press has to arrive. Long enough to be deliberate. */
export const EXIT_WINDOW_MS = 2000;

/**
 * Whether this back press should exit.
 *
 * `lastPressAt` is null when back has not been pressed recently, so the first
 * press always warns and only a second one inside the window exits.
 */
export function shouldExitOnBack(
  lastPressAt: number | null,
  now: number,
  windowMs: number = EXIT_WINDOW_MS
): boolean {
  if (lastPressAt === null) return false;

  const elapsed = now - lastPressAt;
  // A clock that has moved backwards would otherwise produce a negative
  // elapsed time and read as "within the window".
  if (elapsed < 0) return false;

  return elapsed <= windowMs;
}

/** Shown on the first press. */
export const EXIT_HINT_KEY = 'common.pressBackAgainToExit';
