/**
 * Theme access for screens (TC-MOB-065).
 *
 * Two hooks, because screens need colours in two different places:
 *
 *  - `useColors()` for values used inline in JSX (icon props, dynamic styles).
 *  - `useThemedStyles(factory)` for the StyleSheet, which must be rebuilt when
 *    the palette changes — `StyleSheet.create` captures its values once, so a
 *    module-scope stylesheet can never react to a theme switch.
 *
 * The factory's parameter is named `COLORS` at every call site, so converting
 * an existing screen is a two-line change and the hundreds of `COLORS.gray[500]`
 * references inside its stylesheet keep working untouched.
 */

import { useMemo } from 'react';
// Imported directly rather than through the stores barrel: the barrel pulls
// in navigation dependencies, which drags them into anything that imports a
// themed component — including pure unit tests.
import { useUIStore } from '../stores/uiStore';
import { Palette, resolvePalette, isDarkMode } from './palettes';

/** The active palette. */
export function useColors(): Palette {
  const themeMode = useUIStore((state) => state.themeMode);
  const systemScheme = useUIStore((state) => state.colorScheme);

  return useMemo(
    () => resolvePalette(themeMode, systemScheme),
    [themeMode, systemScheme]
  );
}

/** Whether the resolved theme is dark. For status bar and navigation chrome. */
export function useIsDark(): boolean {
  const themeMode = useUIStore((state) => state.themeMode);
  const systemScheme = useUIStore((state) => state.colorScheme);

  return isDarkMode(themeMode, systemScheme);
}

/**
 * Build a stylesheet from the active palette, rebuilding only when it changes.
 *
 * The factory must be defined at module scope so its identity is stable;
 * defining it inside the component would rebuild the stylesheet every render.
 */
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
