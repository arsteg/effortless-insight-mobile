/**
 * TC-MOB-065 — theme resolution and palette shape.
 */

import {
  LIGHT_PALETTE,
  DARK_PALETTE,
  resolvePalette,
  isDarkMode,
  THEME_MODES,
} from '../../src/theme/palettes';

describe('palette shape', () => {
  it('gives both palettes identical keys', () => {
    // The conversion relies on this: every screen reads the same token names,
    // so a key present in one palette and missing from the other would render
    // `undefined` as a colour on one theme only.
    expect(Object.keys(DARK_PALETTE).sort()).toEqual(Object.keys(LIGHT_PALETTE).sort());
    expect(Object.keys(DARK_PALETTE.gray).sort()).toEqual(
      Object.keys(LIGHT_PALETTE.gray).sort()
    );
  });

  it('defines every colour in both themes', () => {
    Object.values(DARK_PALETTE).forEach((value) => expect(value).toBeDefined());
    Object.values(DARK_PALETTE.gray).forEach((value) =>
      expect(value).toMatch(/^#[0-9a-f]{6}$/i)
    );
  });

  it('inverts the grey scale, so gray[900] stays "primary text"', () => {
    // Light: gray[900] is near-black text on a near-white gray[50].
    // Dark must be the reverse, or every screen renders dark text on dark.
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16);
    expect(lum(LIGHT_PALETTE.gray[900])).toBeLessThan(lum(LIGHT_PALETTE.gray[50]));
    expect(lum(DARK_PALETTE.gray[900])).toBeGreaterThan(lum(DARK_PALETTE.gray[50]));
  });

  it('makes the card surface lighter than the page behind it', () => {
    // A card the same colour as its background is not a card.
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16);
    expect(lum(DARK_PALETTE.white)).toBeGreaterThan(lum(DARK_PALETTE.gray[50]));
  });

  it('keeps the brand primary identical across themes', () => {
    expect(DARK_PALETTE.primary).toBe(LIGHT_PALETTE.primary);
  });
});

describe('resolvePalette', () => {
  it('returns the explicit choice regardless of the system', () => {
    expect(resolvePalette('dark', 'light')).toBe(DARK_PALETTE);
    expect(resolvePalette('light', 'dark')).toBe(LIGHT_PALETTE);
  });

  it('follows the system when asked to', () => {
    expect(resolvePalette('system', 'dark')).toBe(DARK_PALETTE);
    expect(resolvePalette('system', 'light')).toBe(LIGHT_PALETTE);
  });

  it('falls back to light for an unknown system scheme', () => {
    expect(resolvePalette('system', null)).toBe(LIGHT_PALETTE);
    expect(resolvePalette('system', 'unspecified')).toBe(LIGHT_PALETTE);
  });
});

describe('isDarkMode', () => {
  it('matches resolvePalette', () => {
    expect(isDarkMode('dark', 'light')).toBe(true);
    expect(isDarkMode('light', 'dark')).toBe(false);
    expect(isDarkMode('system', 'dark')).toBe(true);
    expect(isDarkMode('system', null)).toBe(false);
  });
});

describe('THEME_MODES', () => {
  it('offers exactly Light, Dark and System', () => {
    expect(THEME_MODES.map((m) => m.value)).toEqual(['light', 'dark', 'system']);
  });
});
