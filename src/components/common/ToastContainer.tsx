/**
 * ToastContainer
 * Renders the transient toasts held in the UI store. Previously the store held
 * toasts but nothing displayed them, so every showToast() call was invisible
 * (audit B-toast). Mount once near the app root.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useUIStore } from '../../stores';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

const TYPE_COLOR: Record<string, string> = {
  success: COLORS.success,
  error: COLORS.error,
  warning: COLORS.warning,
  info: COLORS.primary,
};

export function ToastContainer() {
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
            style={[styles.toast, { backgroundColor: TYPE_COLOR[toast.type] ?? COLORS.primary }]}
          >
            <Text style={styles.text}>{toast.message}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  text: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
});
