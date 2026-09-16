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
  /**
   * Calm Intelligence accent families (see ../../DESIGN_SYSTEM.md). Each owns a
   * domain meaning: mint = success/low-risk, coral = high-risk/urgent,
   * amber = medium-risk/pending, lavender = AI/analysis. The `*Light` values are
   * the soft tint backgrounds (dark low-luminance versions in the dark palette).
   */
  mint: string;
  mintLight: string;
  coral: string;
  coralLight: string;
  amber: string;
  amberLight: string;
  lavender: string;
  lavenderLight: string;
  /** Risk-level color language, shared with web + admin. */
  risk: {
    low: string;
    medium: string;
    high: string;
    critical: string;
  };
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
  primary: '#0e93e0', // refined azure — brand
  primaryLight: '#eaf5fd',
  primaryDark: '#0a78bd',
  secondary: '#7f5fdd', // lavender
  success: '#1f9968', // mint
  warning: '#e08d17', // amber
  error: '#e8563e', // coral (warm, not harsh red)
  info: '#0e93e0',
  mint: '#1f9968',
  mintLight: '#e6f6ef',
  coral: '#e8563e',
  coralLight: '#fdeee9',
  amber: '#e08d17',
  amberLight: '#fdf4e3',
  lavender: '#7f5fdd',
  lavenderLight: '#f1eefc',
  risk: {
    low: '#1f9968',
    medium: '#e08d17',
    high: '#e8563e',
    critical: '#cf3d28',
  },
  // Card surface — near-white for a crisp lift off the warm page.
  white: '#ffffff',
  black: '#000000',
  gray: {
    // Warm neutrals for surfaces; readable cool slate for text.
    50: '#fbfaf6', // warm paper — page behind cards
    100: '#f4f1ea', // subtle fills: chips, inactive tabs, search bars
    200: '#e9e5dc', // borders and dividers
    300: '#d8d2c6',
    400: '#a8a296', // muted icons / placeholder
    500: '#6b7280', // muted text
    600: '#4b5563',
    700: '#374151',
    800: '#262d3d',
    900: '#1b2338', // ink navy — primary text
  },
};

export const DARK_PALETTE: Palette = {
  // Brand azure, lifted for contrast against dark surfaces.
  primary: '#3aaeee',
  // The light tint would glare on a dark ground; low-luminance azure instead.
  primaryLight: '#0d4f7b',
  primaryDark: '#74bcef',
  secondary: '#b19cf0', // lavender, lifted
  // Accent/status colours lifted a step for contrast on near-black.
  success: '#5ec69b', // mint
  warning: '#f0b451', // amber
  error: '#f28a72', // coral
  info: '#74bcef',
  mint: '#5ec69b',
  mintLight: '#0d4d37',
  coral: '#f28a72',
  coralLight: '#5a2418',
  amber: '#f0b451',
  amberLight: '#4a3410',
  lavender: '#b19cf0',
  lavenderLight: '#362a63',
  risk: {
    low: '#5ec69b',
    medium: '#f0b451',
    high: '#f28a72',
    critical: '#ee6a54',
  },

  // `white` is the card surface — one calm step above the page behind it.
  white: '#161d2f',
  // `black` is used for shadows; it stays black so elevation still reads.
  black: '#000000',

  gray: {
    // The page behind cards — a deep calm navy (not pure black).
    50: '#0d1220',
    // Subtle fills: chips, inactive tabs, search bars.
    100: '#1c2436',
    // Borders and dividers.
    200: '#263041',
    300: '#384254',
    // Muted text.
    400: '#94a3b8',
    500: '#cbd5e1',
    600: '#e2e8f0',
    700: '#f1f5f9',
    800: '#f8fafc',
    // Primary text.
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
