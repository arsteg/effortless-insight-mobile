/**
 * Billing Overview Screen
 * Current subscription + usage overview
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { CreditCard, AlertCircle } from 'lucide-react-native';
import { useCurrentSubscription } from '../../src/hooks';
import { SubscriptionCard, UsageSummary } from '../../src/components/billing';
import { LoadingSpinner, Button, EmptyState } from '../../src/components';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

export default function BillingScreen() {
  const router = useRouter();
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useCurrentSubscription();

  const handleChangePlan = () => {
    router.push('/billing/plans');
  };

  const handleManage = () => {
    // For now, show plans to manage subscription
    router.push('/billing/plans');
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <EmptyState
          type="error"
          icon={<AlertCircle size={48} color={COLORS.error} />}
          title="Failed to load subscription"
          message="Please check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const { subscription, usage } = data || {};

  // No subscription - show prompt to subscribe
  if (!subscription) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View style={styles.noSubscriptionCard}>
          <View style={styles.iconContainer}>
            <CreditCard size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.noSubscriptionTitle}>No Active Subscription</Text>
          <Text style={styles.noSubscriptionDescription}>
            Choose a plan to unlock all features and start managing your GST notices efficiently.
          </Text>
          <Button
            title="View Plans"
            onPress={handleChangePlan}
            variant="primary"
            fullWidth
            style={styles.viewPlansButton}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Current Subscription */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Plan</Text>
        <SubscriptionCard
          subscription={subscription}
          onManage={handleManage}
          onChangePlan={handleChangePlan}
        />
      </View>

      {/* Usage Summary */}
      {usage && (
        <View style={styles.section}>
          <UsageSummary
            notices={usage.notices}
            users={usage.users}
            storage={usage.storage}
            apiCalls={usage.apiCalls}
          />
        </View>
      )}

      {/* Billing Period Info */}
      {usage && (
        <View style={styles.periodInfo}>
          <Text style={styles.periodText}>
            Billing period: {formatDate(usage.period.start)} - {formatDate(usage.period.end)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  noSubscriptionCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  noSubscriptionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
  },
  noSubscriptionDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  viewPlansButton: {
    marginTop: SPACING.xl,
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.md,
  },
  periodInfo: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  periodText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
});
