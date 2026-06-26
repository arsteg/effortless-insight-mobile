/**
 * Plans Selection Screen
 * Display available plans for selection
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { usePlans, useCurrentSubscription } from '../../src/hooks';
import { BillingToggle, PlanCard } from '../../src/components/billing';
import { LoadingSpinner, EmptyState } from '../../src/components';
import { COLORS, SPACING, FONT_SIZES } from '../../src/utils/constants';
import { BillingCycle } from '../../src/types';

export default function PlansScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cycle?: string }>();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    (params.cycle as BillingCycle) || 'annually'
  );

  const {
    data: plansData,
    isLoading: isLoadingPlans,
    isRefetching,
    refetch,
    error: plansError,
  } = usePlans();

  const {
    data: subscriptionData,
    isLoading: isLoadingSubscription,
  } = useCurrentSubscription();

  const handleSelectPlan = (planCode: string) => {
    router.push({
      pathname: '/billing/checkout',
      params: { planCode, billingCycle },
    });
  };

  const isLoading = isLoadingPlans || isLoadingSubscription;

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (plansError) {
    return (
      <View style={styles.errorContainer}>
        <EmptyState
          type="error"
          icon={<AlertCircle size={48} color={COLORS.error} />}
          title="Failed to load plans"
          message="Please check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const plans = plansData?.plans || [];
  const currentPlanCode = subscriptionData?.subscription?.planCode;

  // Calculate max annual discount
  const discounts = plans
    .filter(p => p.pricing?.annualDiscount)
    .map(p => p.pricing.annualDiscount || 0);
  const maxDiscount = discounts.length > 0 ? Math.max(...discounts) : 0;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>
          Select the plan that best fits your needs
        </Text>
      </View>

      {/* Billing Toggle */}
      <BillingToggle
        value={billingCycle}
        onChange={setBillingCycle}
        annualDiscount={maxDiscount > 0 ? maxDiscount : undefined}
      />

      {/* Plans List */}
      <View style={styles.plansContainer}>
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billingCycle={billingCycle}
            isCurrentPlan={plan.code === currentPlanCode}
            onSelect={handleSelectPlan}
          />
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          All plans include a {plans[0]?.trialDays || 14}-day free trial.
        </Text>
        <Text style={styles.footerText}>
          Cancel anytime, no questions asked.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.gray[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  plansContainer: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  footer: {
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
});
