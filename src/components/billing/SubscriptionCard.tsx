/**
 * SubscriptionCard Component
 * Display current subscription status
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CreditCard, Calendar, Users, ChevronRight, AlertCircle } from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { SubscriptionDto } from '../../types';
import {
  formatAmount,
  getBillingCycleLabel,
  getSubscriptionStatusColor,
  getSubscriptionStatusLabel,
} from '../../hooks/useBilling';

interface SubscriptionCardProps {
  subscription: SubscriptionDto;
  onManage?: () => void;
  onChangePlan?: () => void;
}

export function SubscriptionCard({
  subscription,
  onManage,
  onChangePlan,
}: SubscriptionCardProps) {
  const statusColor = getSubscriptionStatusColor(subscription.status);
  const statusLabel = getSubscriptionStatusLabel(subscription.status);
  const isTrialing = subscription.status === 'trialing';
  const isPastDue = subscription.status === 'past_due';

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDaysRemaining = () => {
    if (subscription.trialEnd) {
      const days = Math.ceil(
        (new Date(subscription.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return days > 0 ? days : 0;
    }
    if (subscription.currentPeriodEnd) {
      const days = Math.ceil(
        (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return days > 0 ? days : 0;
    }
    return null;
  };

  const daysRemaining = getDaysRemaining();

  const totalSeats = subscription.seats.included + subscription.seats.additional;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.planName}>{subscription.planName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        {onManage && (
          <TouchableOpacity style={styles.manageButton} onPress={onManage}>
            <Text style={styles.manageButtonText}>Manage</Text>
            <ChevronRight size={16} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Warning Banner */}
      {isPastDue && (
        <View style={styles.warningBanner}>
          <AlertCircle size={16} color={COLORS.error} />
          <Text style={styles.warningText}>
            Payment failed. Please update your payment method.
          </Text>
        </View>
      )}

      {/* Trial Banner */}
      {isTrialing && daysRemaining !== null && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerText}>
            {daysRemaining} days remaining in your trial
          </Text>
        </View>
      )}

      {/* Details */}
      <View style={styles.detailsContainer}>
        {/* Price */}
        <View style={styles.detailRow}>
          <CreditCard size={18} color={COLORS.gray[400]} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Billing</Text>
            <Text style={styles.detailValue}>
              {formatAmount(subscription.pricing.total)} {getBillingCycleLabel(subscription.billingCycle)}
            </Text>
          </View>
        </View>

        {/* Next Billing */}
        <View style={styles.detailRow}>
          <Calendar size={18} color={COLORS.gray[400]} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>
              {subscription.cancelAtPeriodEnd ? 'Expires on' : 'Next billing'}
            </Text>
            <Text style={styles.detailValue}>
              {formatDate(subscription.nextBillingDate || subscription.currentPeriodEnd)}
            </Text>
          </View>
        </View>

        {/* Seats */}
        <View style={styles.detailRow}>
          <Users size={18} color={COLORS.gray[400]} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Team seats</Text>
            <Text style={styles.detailValue}>
              {subscription.seats.used} / {totalSeats} used
            </Text>
          </View>
        </View>
      </View>

      {/* Cancellation Notice */}
      {subscription.cancelAtPeriodEnd && (
        <View style={styles.cancellationNotice}>
          <Text style={styles.cancellationText}>
            Your subscription will end on {formatDate(subscription.currentPeriodEnd)}
          </Text>
        </View>
      )}

      {/* Change Plan Button */}
      {onChangePlan && !subscription.cancelAtPeriodEnd && (
        <TouchableOpacity style={styles.changePlanButton} onPress={onChangePlan}>
          <Text style={styles.changePlanButtonText}>Change Plan</Text>
        </TouchableOpacity>
      )}
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.xs,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  manageButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.primary,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#fef2f2',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  warningText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
  },
  trialBanner: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  trialBannerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  detailsContainer: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
  detailValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
    marginTop: 2,
  },
  cancellationNotice: {
    backgroundColor: COLORS.gray[100],
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  cancellationText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    textAlign: 'center',
  },
  changePlanButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  changePlanButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
