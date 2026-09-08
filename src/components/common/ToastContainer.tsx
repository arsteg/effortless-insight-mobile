/**
 * ToastContainer
 * Renders the transient toasts held in the UI store. Previously the store held
 * toasts but nothing displayed them, so every showToast() call was invisible
 * (audit B-toast). Mount once near the app root.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useUIStore } from '../../stores';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';

/** Built from the active palette rather than captured at module load. */
const typeColor = (COLORS: Palette): Record<string, string> => ({
  success: COLORS.success,
  error: COLORS.error,
  warning: COLORS.warning,
  info: COLORS.primary,
});

export function ToastContainer() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const toasts = useUIStore((state) => state.toasts);
  const hideToast = useUIStore((state) => state.hideToast);

  if (toasts.length === 0) return null;

  return (
    <SafeAreaView style={styles.wrap} pointerEvents="box-none">
      <View style={styles.stack} pointerEvents="box-none">
        {toasts.map((toast) => (
          <TouchableOpacity
            key={toast.id}
            activeOpacity={0.9}
            onPress={() => hideToast(toast.id)}
            style={[styles.toast, { backgroundColor: typeColor(COLORS)[toast.type] ?? COLORS.primary }]}
          >
            <View style={styles.row}>
              <Text style={[styles.text, toast.action && styles.textWithAction]}>
                {toast.message}
              </Text>

              {/*
                The action lives inside the toast rather than replacing the
                dismiss-on-tap, so an undo is one tap and dismissing still
                works everywhere else on the surface.
              */}
              {toast.action && (
                <TouchableOpacity
                  onPress={() => {
                    hideToast(toast.id);
                    toast.action?.onPress();
                  }}
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.actionText}>{toast.action.label}</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 0 : SPACING.md,
    alignItems: 'center',
  },
  stack: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  toast: {
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  text: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  textWithAction: {
    flex: 1,
    textAlign: 'left',
  },
  actionText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
