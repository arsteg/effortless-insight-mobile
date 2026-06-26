/**
 * Billing Hooks
 * React Query hooks for billing data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../services/api';
import { useUIStore } from '../stores';
import {
  PlansResponse,
  CurrentSubscriptionResponse,
  UsageDto,
  UsageCheckResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  PaywallAction,
  PaywallState,
} from '../types';
import { getApiErrorMessage } from '../services/api/client';

// Query keys
export const billingKeys = {
  all: ['billing'] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  usage: () => [...billingKeys.all, 'usage'] as const,
  usageCheck: (action: PaywallAction) => [...billingKeys.all, 'usageCheck', action] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch available plans
 */
export function usePlans() {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: billingApi.getPlans,
    staleTime: 1000 * 60 * 60, // 1 hour - plans don't change often
  });
}

/**
 * Fetch current subscription with usage
 */
export function useCurrentSubscription() {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: billingApi.getCurrentSubscription,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch usage metrics
 */
export function useUsage() {
  return useQuery({
    queryKey: billingKeys.usage(),
    queryFn: billingApi.getUsage,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Check if action is allowed
 */
export function useUsageCheck(action: PaywallAction, enabled = true) {
  return useQuery({
    queryKey: billingKeys.usageCheck(action),
    queryFn: () => billingApi.checkUsage(action),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create subscription (initiate checkout)
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => billingApi.createSubscription(data),
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Verify payment after Razorpay checkout
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (data: VerifyPaymentRequest) => billingApi.verifyPayment(data),
    onSuccess: () => {
      // Invalidate subscription and usage queries
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
      queryClient.invalidateQueries({ queryKey: billingKeys.usage() });
      showToast('success', 'Subscription activated successfully!');
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Paywall hook - checks if action is blocked and provides upgrade prompt
 */
export function usePaywall(action: PaywallAction): {
  isLoading: boolean;
  paywall: PaywallState | null;
  refetch: () => void;
} {
  const { data, isLoading, refetch } = useUsageCheck(action);

  if (isLoading || !data) {
    return {
      isLoading,
      paywall: null,
      refetch,
    };
  }

  if (data.allowed) {
    return {
      isLoading: false,
      paywall: null,
      refetch,
    };
  }

  const paywall: PaywallState = {
    isBlocked: true,
    action,
    currentUsage: data.currentUsage,
    limit: data.limit,
    suggestedPlan: data.suggestedPlan,
    message: data.reason || 'You have reached your plan limit.',
  };

  return {
    isLoading: false,
    paywall,
    refetch,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format amount from paise to rupees
 */
export function formatAmount(amountInPaise: number, currency = 'INR'): string {
  const amount = amountInPaise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get billing cycle label
 */
export function getBillingCycleLabel(cycle: string): string {
  switch (cycle) {
    case 'monthly':
      return 'per month';
    case 'annually':
      return 'per year';
    default:
      return cycle;
  }
}

/**
 * Get subscription status color
 */
export function getSubscriptionStatusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return '#10b981'; // success/green
    case 'past_due':
      return '#f59e0b'; // warning/amber
    case 'cancelled':
    case 'expired':
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
}

/**
 * Get subscription status label
 */
export function getSubscriptionStatusLabel(status: string): string {
  switch (status) {
    case 'trialing':
      return 'Trial';
    case 'active':
      return 'Active';
    case 'past_due':
      return 'Past Due';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
}
