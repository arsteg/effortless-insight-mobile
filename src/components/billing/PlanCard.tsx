/**
 * PlanCard Component
 * Display plan with pricing, features, and select button
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, Star } from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { PlanDto, BillingCycle } from '../../types';
import { formatAmount } from '../../hooks/useBilling';

interface PlanCardProps {
  plan: PlanDto;
  billingCycle: BillingCycle;
  isCurrentPlan?: boolean;
  onSelect: (planCode: string) => void;
  isLoading?: boolean;
}

export function PlanCard({
  plan,
  billingCycle,
  isCurrentPlan = false,
  onSelect,
  isLoading = false,
}: PlanCardProps) {
  const price = billingCycle === 'monthly' ? plan.pricing.monthly : plan.pricing.annually;
  const priceLabel = billingCycle === 'monthly' ? '/mo' : '/yr';

  const handleSelect = () => {
    if (!isLoading && !isCurrentPlan && !plan.contactSales) {
      onSelect(plan.code);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        plan.isPopular && styles.popularContainer,
        isCurrentPlan && styles.currentContainer,
      ]}
      onPress={handleSelect}
      activeOpacity={isCurrentPlan || plan.contactSales ? 1 : 0.7}
      disabled={isLoading}
    >
      {/* Popular Badge */}
      {plan.isPopular && (
        <View style={styles.popularBadge}>
          <Star size={12} color={COLORS.white} fill={COLORS.white} />
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentText}>Current Plan</Text>
        </View>
      )}

      {/* Plan Name */}
      <Text style={styles.planName}>{plan.displayName}</Text>

      {/* Description */}
      {plan.description && (
        <Text style={styles.description} numberOfLines={2}>
          {plan.description}
        </Text>
      )}

      {/* Price */}
      <View style={styles.priceContainer}>
        {price !== null ? (
          <>
            <Text style={styles.price}>{formatAmount(price * 100)}</Text>
            <Text style={styles.priceLabel}>{priceLabel}</Text>
          </>
        ) : plan.contactSales ? (
          <Text style={styles.contactSales}>Contact Sales</Text>
        ) : (
          <Text style={styles.price}>Free</Text>
        )}
      </View>

      {/* Trial Badge */}
      {plan.trialDays > 0 && !isCurrentPlan && (
        <View style={styles.trialBadge}>
          <Text style={styles.trialText}>{plan.trialDays} day free trial</Text>
        </View>
      )}

      {/* Features */}
      <View style={styles.featuresContainer}>
        {plan.features.slice(0, 5).map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Check size={16} color={COLORS.success} />
            <Text style={styles.featureText} numberOfLines={1}>
              {feature}
            </Text>
          </View>
        ))}
        {plan.features.length > 5 && (
          <Text style={styles.moreFeatures}>
            +{plan.features.length - 5} more features
          </Text>
        )}
      </View>

      {/* Limits Summary */}
      <View style={styles.limitsContainer}>
        <LimitItem
          label="Notices"
          value={plan.limits.noticesPerMonth}
          suffix="/mo"
        />
        <LimitItem
          label="Users"
          value={plan.limits.users}
        />
        <LimitItem
          label="Storage"
          value={plan.limits.storageGb}
          suffix="GB"
        />
      </View>

      {/* Select Button */}
      {!isCurrentPlan && (
        <TouchableOpacity
          style={[
            styles.selectButton,
            plan.isPopular && styles.selectButtonPopular,
            plan.contactSales && styles.selectButtonOutline,
          ]}
          onPress={handleSelect}
          disabled={isLoading}
        >
          <Text
            style={[
              styles.selectButtonText,
              plan.contactSales && styles.selectButtonTextOutline,
            ]}
          >
            {plan.contactSales ? 'Contact Sales' : 'Select Plan'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function LimitItem({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  // 0 or very high numbers (>= 10000) typically mean unlimited
  const isUnlimited = value === 0 || value >= 10000;
  return (
    <View style={styles.limitItem}>
      <Text style={styles.limitValue}>
        {isUnlimited ? 'Unlimited' : `${value}${suffix}`}
      </Text>
      <Text style={styles.limitLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    marginBottom: SPACING.md,
  },
  popularContainer: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  currentContainer: {
    borderColor: COLORS.success,
    borderWidth: 2,
    backgroundColor: COLORS.gray[50],
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  popularText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.white,
  },
  currentBadge: {
    position: 'absolute',
    top: -12,
    left: SPACING.lg,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  currentText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.white,
  },
  planName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginTop: SPACING.xs,
  },
  description: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: SPACING.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: SPACING.md,
  },
  price: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '700',
    color: COLORS.gray[900],
  },
  priceLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    marginLeft: SPACING.xs,
  },
  contactSales: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.primary,
  },
  trialBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
  },
  trialText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  featuresContainer: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[700],
  },
  moreFeatures: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  limitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  limitItem: {
    alignItems: 'center',
  },
  limitValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  limitLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  selectButton: {
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  selectButtonPopular: {
    backgroundColor: COLORS.primary,
  },
  selectButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  selectButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  selectButtonTextOutline: {
    color: COLORS.primary,
  },
});
