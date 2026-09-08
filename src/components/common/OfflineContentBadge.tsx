/**
 * Marks content as coming from the cache (TC-MOB-056).
 *
 * The global OfflineBanner says the *device* is offline. This says something
 * different and more useful: what you are reading was fetched a while ago and
 * may no longer be true. For a screen showing a notice's status or deadline,
 * that distinction matters.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { formatCacheAge, isStale } from '../../utils/cacheFreshness';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';

interface OfflineContentBadgeProps {
  /** When this content was cached, from `getCached*Age`. */
  cachedAt: number | null;
  /** Hidden while online — live data needs no caveat. */
  visible: boolean;
}

export function OfflineContentBadge({ cachedAt, visible }: OfflineContentBadgeProps) {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  if (!visible) return null;

  const age = formatCacheAge(cachedAt);
  const stale = isStale(cachedAt);

  return (
    <View
      style={[styles.badge, stale && styles.badgeStale]}
      accessibilityRole="text"
      accessibilityLabel={`Showing saved data. ${age ?? 'Age unknown'}`}
    >
      <CloudOff size={13} color={stale ? COLORS.warning : COLORS.gray[500]} />
      <Text style={[styles.text, stale && styles.textStale]}>
        Showing saved data{age ? ` · ${age}` : ''}
      </Text>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  badgeStale: {
    backgroundColor: '#fef3c7',
  },
  text: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  textStale: {
    color: '#92400e',
    fontWeight: '500',
  },
});
