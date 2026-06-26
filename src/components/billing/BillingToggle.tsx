/**
 * BillingToggle Component
 * Toggle between monthly and annual billing
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { BillingCycle } from '../../types';

interface BillingToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  annualDiscount?: number;
}

export function BillingToggle({ value, onChange, annualDiscount }: BillingToggleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.option, value === 'monthly' && styles.optionActive]}
          onPress={() => onChange('monthly')}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, value === 'monthly' && styles.optionTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, value === 'annually' && styles.optionActive]}
          onPress={() => onChange('annually')}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, value === 'annually' && styles.optionTextActive]}>
            Annual
          </Text>
          {annualDiscount && annualDiscount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>Save {annualDiscount}%</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  optionActive: {
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[500],
  },
  optionTextActive: {
    color: COLORS.gray[900],
  },
  discountBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  discountText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.white,
  },
});
