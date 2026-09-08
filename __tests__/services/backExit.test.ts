/**
 * TC-MOB-075 — double-back-to-exit at a navigation root.
 */

import { shouldExitOnBack, EXIT_WINDOW_MS } from '../../src/utils/backExit';

const now = 1_000_000;

describe('shouldExitOnBack', () => {
  it('does not exit on the first press', () => {
    // The whole point: a stray press must warn, not close the app.
    expect(shouldExitOnBack(null, now)).toBe(false);
  });

  it('exits on a second press inside the window', () => {
    expect(shouldExitOnBack(now - 500, now)).toBe(true);
  });

  it('exits on a press exactly at the boundary', () => {
    expect(shouldExitOnBack(now - EXIT_WINDOW_MS, now)).toBe(true);
  });

  it('does not exit once the window has passed', () => {
    // Back pressed a minute ago is not "again" — it starts over.
    expect(shouldExitOnBack(now - EXIT_WINDOW_MS - 1, now)).toBe(false);
    expect(shouldExitOnBack(now - 60_000, now)).toBe(false);
  });

  it('gives the user a real two seconds', () => {
    expect(EXIT_WINDOW_MS).toBe(2000);
  });

  it('does not exit when the clock has moved backwards', () => {
    // A timezone change or a manually set clock would otherwise produce a
    // negative elapsed time, which reads as "within the window".
    expect(shouldExitOnBack(now + 5000, now)).toBe(false);
  });

  it('honours a custom window', () => {
    expect(shouldExitOnBack(now - 3000, now, 5000)).toBe(true);
    expect(shouldExitOnBack(now - 6000, now, 5000)).toBe(false);
  });
});
