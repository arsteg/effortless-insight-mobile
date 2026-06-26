/**
 * Checkout Screen
 * Billing details + Razorpay payment
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CreditCard, Check, AlertCircle, Shield } from 'lucide-react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { usePlans, useCreateSubscription, useVerifyPayment, formatAmount } from '../../src/hooks';
import { useAuthStore } from '../../src/stores';
import { Button, LoadingSpinner } from '../../src/components';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { BillingCycle, PlanDto } from '../../src/types';

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ planCode: string; billingCycle: string }>();
  const { user } = useAuthStore();

  const [selectedPlan, setSelectedPlan] = useState<PlanDto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const billingCycle = (params.billingCycle as BillingCycle) || 'annually';
  const planCode = params.planCode;

  const { data: plansData, isLoading: isLoadingPlans } = usePlans();
  const createSubscription = useCreateSubscription();
  const verifyPayment = useVerifyPayment();

  // Find selected plan
  useEffect(() => {
    if (plansData?.plans && planCode) {
      const plan = plansData.plans.find((p) => p.code === planCode);
      setSelectedPlan(plan || null);
    }
  }, [plansData, planCode]);

  const handleCheckout = async () => {
    if (!selectedPlan || !user) return;

    setIsProcessing(true);

    try {
      // Create subscription on backend
      const response = await createSubscription.mutateAsync({
        planCode: selectedPlan.code,
        billingCycle,
      });

      const { checkoutOptions } = response;

      // Open Razorpay checkout
      const razorpayOptions = {
        key: checkoutOptions.key,
        amount: checkoutOptions.amount,
        currency: checkoutOptions.currency,
        order_id: checkoutOptions.orderId,
        name: checkoutOptions.name,
        description: checkoutOptions.description,
        prefill: {
          email: checkoutOptions.prefill.email || undefined,
          contact: checkoutOptions.prefill.contact || undefined,
        },
        theme: {
          color: COLORS.primary,
        },
      };

      const paymentData = await RazorpayCheckout.open(razorpayOptions);

      // Verify payment
      await verifyPayment.mutateAsync({
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpaySignature: paymentData.razorpay_signature,
      });

      // Success - navigate back to billing
      router.replace('/billing');
    } catch (error: any) {
      // Handle Razorpay checkout dismissal
      if (error?.code === 0 || error?.description?.includes('cancelled')) {
        // User cancelled - do nothing
        setIsProcessing(false);
        return;
      }

      Alert.alert(
        'Payment Failed',
        error?.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingPlans) {
    return <LoadingSpinner fullScreen />;
  }

  if (!selectedPlan) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color={COLORS.error} />
        <Text style={styles.errorText}>Plan not found</Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="outline"
          style={styles.errorButton}
        />
      </View>
    );
  }

  const price =
    billingCycle === 'monthly'
      ? selectedPlan.pricing.monthly
      : selectedPlan.pricing.annually;

  const pricePerMonth =
    billingCycle === 'annually' && price
      ? Math.round(price / 12)
      : price;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryCard}>
          {/* Plan Info */}
          <View style={styles.planRow}>
            <View>
              <Text style={styles.planName}>{selectedPlan.displayName}</Text>
              <Text style={styles.billingCycle}>
                {billingCycle === 'monthly' ? 'Monthly' : 'Annual'} billing
              </Text>
            </View>
            <Text style={styles.planPrice}>
              {price ? formatAmount(price * 100) : 'Free'}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Price Breakdown */}
          {billingCycle === 'annually' && price && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Monthly equivalent</Text>
              <Text style={styles.priceValue}>
                {formatAmount((pricePerMonth || 0) * 100)}/mo
              </Text>
            </View>
          )}

          {selectedPlan.pricing.annualDiscount &&
            selectedPlan.pricing.annualDiscount > 0 &&
            billingCycle === 'annually' && (
              <View style={styles.priceRow}>
                <Text style={styles.savingsLabel}>Annual savings</Text>
                <Text style={styles.savingsValue}>
                  {selectedPlan.pricing.annualDiscount}% off
                </Text>
              </View>
            )}

          {/* Trial Info */}
          {selectedPlan.trialDays > 0 && (
            <View style={styles.trialBanner}>
              <Check size={16} color={COLORS.success} />
              <Text style={styles.trialText}>
                {selectedPlan.trialDays}-day free trial included
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {selectedPlan.trialDays > 0 ? 'Due after trial' : 'Total due today'}
            </Text>
            <Text style={styles.totalValue}>
              {price ? formatAmount(price * 100) : 'Free'}
            </Text>
          </View>
        </View>
      </View>

      {/* Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What's Included</Text>
        <View style={styles.featuresCard}>
          {selectedPlan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Check size={16} color={COLORS.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Payment Security */}
      <View style={styles.securityInfo}>
        <Shield size={16} color={COLORS.gray[400]} />
        <Text style={styles.securityText}>
          Secure payment powered by Razorpay. Your payment information is encrypted.
        </Text>
      </View>

      {/* Checkout Button */}
      <View style={styles.checkoutContainer}>
        <Button
          title={
            isProcessing
              ? 'Processing...'
              : selectedPlan.trialDays > 0
              ? 'Start Free Trial'
              : 'Subscribe Now'
          }
          onPress={handleCheckout}
          variant="primary"
          fullWidth
          disabled={isProcessing}
          loading={isProcessing}
          icon={!isProcessing ? <CreditCard size={18} color={COLORS.white} /> : undefined}
        />

        <Text style={styles.checkoutNote}>
          {selectedPlan.trialDays > 0
            ? `You won't be charged until your trial ends. Cancel anytime.`
            : `By subscribing, you agree to our Terms of Service.`}
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
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.gray[600],
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorButton: {
    minWidth: 120,
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
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  billingCycle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  planPrice: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray[100],
    marginVertical: SPACING.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  priceLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  priceValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[700],
  },
  savingsLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
  },
  savingsValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.success,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ecfdf5',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  trialText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  totalValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  featuresCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
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
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  securityText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
  checkoutContainer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  checkoutNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
