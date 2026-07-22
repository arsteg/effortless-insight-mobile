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
  ChangePlanRequest,
  ChangePlanResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  PauseSubscriptionRequest,
  PauseSubscriptionResponse,
  ResumeSubscriptionResponse,
  AddSeatsRequest,
  AddSeatsResponse,
  SubscriptionDto,
  PaymentRetryResponse,
  InvoiceListResponse,
  InvoiceDetailDto,
  PaymentMethodListResponse,
  PaymentMethodDto,
  ValidateCouponRequest,
  ValidateCouponResponse,
} from '../types';
import { getApiErrorMessage } from '../services/api/client';

// Query keys
export const billingKeys = {
  all: ['billing'] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  usage: () => [...billingKeys.all, 'usage'] as const,
  usageCheck: (action: PaywallAction) => [...billingKeys.all, 'usageCheck', action] as const,
  invoices: () => [...billingKeys.all, 'invoices'] as const,
  invoiceList: (page: number, limit: number) => [...billingKeys.invoices(), 'list', page, limit] as const,
  invoiceDetail: (id: string) => [...billingKeys.invoices(), 'detail', id] as const,
  paymentMethods: () => [...billingKeys.all, 'paymentMethods'] as const,
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

/**
 * Change subscription plan (upgrade/downgrade)
 */
export function useChangePlan() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (data: ChangePlanRequest) => billingApi.changePlan(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
      queryClient.invalidateQueries({ queryKey: billingKeys.usage() });
      if (response.message) {
        showToast('success', response.message);
      }
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Cancel subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (data: CancelSubscriptionRequest) => billingApi.cancelSubscription(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
      showToast('success', response.message || 'Subscription cancelled');
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Pause subscription
 */
export function usePauseSubscription() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (data: PauseSubscriptionRequest) => billingApi.pauseSubscription(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
      showToast('success', 'Subscription paused');
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Resume paused subscription
 */
export function useResumeSubscription() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: () => billingApi.resumeSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
      showToast('success', 'Subscription resumed');
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Reactivate cancelled subscription
 */
export function useReactivateSubscription() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: () => billingApi.reactivateSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
      showToast('success', 'Subscription reactivated');
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Add additional seats
 */
export function useAddSeats() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (data: AddSeatsRequest) => billingApi.addSeats(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
      if (!response.razorpayOrder) {
        showToast('success', `Added seats. Total: ${response.totalSeats}`);
      }
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Retry failed payment
 */
export function useRetryPayment() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: () => billingApi.retryPayment(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
      showToast(response.success ? 'success' : 'error', response.message);
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Validate coupon code
 */
export function useValidateCoupon() {
  return useMutation({
    mutationFn: (data: ValidateCouponRequest) => billingApi.validateCoupon(data),
  });
}

// ============================================================================
// Invoice Hooks
// ============================================================================

/**
 * Fetch invoices with pagination
 */
export function useInvoices(page = 1, limit = 10) {
  return useQuery({
    queryKey: billingKeys.invoiceList(page, limit),
    queryFn: () => billingApi.getInvoices(page, limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch single invoice detail
 */
export function useInvoice(invoiceId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.invoiceDetail(invoiceId),
    queryFn: () => billingApi.getInvoice(invoiceId),
    enabled: enabled && !!invoiceId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// ============================================================================
// Payment Method Hooks
// ============================================================================

/**
 * Fetch payment methods
 */
export function usePaymentMethods() {
  return useQuery({
    queryKey: billingKeys.paymentMethods(),
    queryFn: billingApi.getPaymentMethods,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Set default payment method
 */
export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (paymentMethodId: string) => billingApi.setDefaultPaymentMethod(paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.paymentMethods() });
      showToast('success', 'Default payment method updated');
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Delete payment method
 */
export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (paymentMethodId: string) => billingApi.deletePaymentMethod(paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.paymentMethods() });
      showToast('success', 'Payment method removed');
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
  const { data, isLoading, isError, refetch } = useUsageCheck(action);

  if (isLoading) {
    return {
      isLoading: true,
      paywall: null,
      refetch,
    };
  }

  // Fail CLOSED: if the limit check errored we can't confirm the action is
  // allowed, so block it (with a retry) rather than letting it through and
  // leaking paid usage on an outage (audit B8).
  if (isError) {
    return {
      isLoading: false,
      paywall: {
        isBlocked: true,
        action,
        currentUsage: 0,
        limit: null,
        suggestedPlan: null,
        message: "We couldn't verify your plan limits. Please check your connection and try again.",
      },
      refetch,
    };
  }

  if (!data || data.allowed) {
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
    case 'paused':
      return '#3b82f6'; // blue
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
    case 'paused':
      return 'Paused';
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

/**
 * Get invoice status color
 */
export function getInvoiceStatusColor(status: string): string {
  switch (status) {
    case 'paid':
      return '#10b981'; // success/green
    case 'pending':
    case 'draft':
      return '#f59e0b'; // warning/amber
    case 'void':
    case 'refunded':
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
}

/**
 * Get invoice status label
 */
export function getInvoiceStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'pending':
      return 'Pending';
    case 'paid':
      return 'Paid';
    case 'void':
      return 'Void';
    case 'refunded':
      return 'Refunded';
    default:
      return status;
  }
}

/**
 * Format payment method display string
 */
export function formatPaymentMethod(method: PaymentMethodDto): string {
  switch (method.type) {
    case 'card':
      return `${method.cardBrand || 'Card'} •••• ${method.cardLast4 || '****'}`;
    case 'upi':
      return method.upiId || 'UPI';
    case 'netbanking':
      return 'Net Banking';
    case 'wallet':
      return 'Wallet';
    default:
      return method.type;
  }
}
