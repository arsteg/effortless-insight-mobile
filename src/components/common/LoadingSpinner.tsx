/**
 * Loading Spinner Component
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SPACING, FONT_SIZES } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = 'large',
  color,
  message,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const content = (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color ?? COLORS.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }

  return content;
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  container: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
});
