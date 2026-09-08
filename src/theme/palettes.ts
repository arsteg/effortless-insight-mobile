/**
 * Light and dark palettes (TC-MOB-065).
 *
 * The dark palette keeps the SAME SHAPE and the same *meaning* as the light
 * one, rather than adding new token names. Every screen already reads
 * `COLORS.gray[900]` for primary text, `COLORS.white` for a card surface and
 * `COLORS.gray[50]` for the page behind it — so inverting the scale, instead
 * of renaming anything, makes ~47 existing screens correct without rewriting
 * a single colour reference.
 *
 * That is the whole trick here: `gray[50]` does not mean "very light grey", it
 * means "the surface behind cards". In dark mode that is nearly black.
 *
 * Hues are taken from the web app's shadcn tokens (`globals.css`) so the two
 * products look like the same product: slate for the neutrals, and the same
 * `#0ea5e9` primary in both themes.
 */

export interface Palette {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  /** Card / elevated surface. Named for its role, not its literal colour. */
  white: string;
  black: string;
  gray: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
}

export const LIGHT_PALETTE: Palette = {
  primary: '#0ea5e9',
  primaryLight: '#e0f2fe',
  primaryDark: '#0284c7',
  secondary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

export const DARK_PALETTE: Palette = {
  // Primary stays put: it is the brand, it carries the same meaning in both
  // themes, and it clears 4.5:1 against the dark surfaces below.
  primary: '#0ea5e9',
  // The light tint would glare on a dark ground; this is the same hue at low
  // luminance, so "primary-tinted background" still reads as tinted.
  primaryLight: '#0c4a6e',
  primaryDark: '#38bdf8',
  secondary: '#818cf8',
  // Status colours lifted a step: the light-mode values are tuned for contrast
  // against white and go muddy on near-black.
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',

  // `white` is the card surface. Slate-900, one step above the page behind it,
  // because a card the same colour as its background is not a card.
  white: '#0f172a',
  // `black` is used for shadows; it stays black so elevation still reads.
  black: '#000000',

  gray: {
    // The page behind cards — darkest, matching the web's --background.
    50: '#020817',
    // Subtle fills: chips, inactive tabs, search bars.
    100: '#1e293b',
    // Borders and dividers.
    200: '#1e293b',
    300: '#334155',
    // Muted text — the web's --muted-foreground.
    400: '#94a3b8',
    500: '#cbd5e1',
    600: '#e2e8f0',
    700: '#f1f5f9',
    800: '#f8fafc',
    // Primary text — the web's --foreground.
    900: '#f8fafc',
  },
};

export type ThemeMode = 'light' | 'dark' | 'system';

/** The palette for a mode, resolving `system` against the OS setting. */
export type SystemScheme = 'light' | 'dark' | 'unspecified' | null | undefined;

export function resolvePalette(mode: ThemeMode, systemScheme: SystemScheme): Palette {
  if (mode === 'system') {
    return systemScheme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  }
  return mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

/** Whether the resolved theme is dark — drives status bar and nav theming. */
export function isDarkMode(mode: ThemeMode, systemScheme: SystemScheme): boolean {
  if (mode === 'system') return systemScheme === 'dark';
  return mode === 'dark';
}

export const THEME_MODES: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;
