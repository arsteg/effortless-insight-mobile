/**
 * Billing API Service
 */

import { apiClient, isApiError } from './client';
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
} from '../../types';

// API Response wrapper type (backend wraps all responses)
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const billingApi = {
  // ============================================================================
  // Plans
  // ============================================================================

  /**
   * Get all available plans
   */
  getPlans: async (): Promise<PlansResponse> => {
    const response = await apiClient.get<ApiResponse<PlansResponse>>('/plans');
    return response.data.data;
  },

  // ============================================================================
  // Subscriptions
  // ============================================================================

  /**
   * Get current subscription with usage
   * Returns null values if no subscription exists (404) or no org selected
   */
  getCurrentSubscription: async (): Promise<CurrentSubscriptionResponse> => {
    try {
      const response = await apiClient.get<ApiResponse<CurrentSubscriptionResponse>>('/subscriptions/current');
      // Handle case where response might not have nested data structure
      const data = response.data;
      if (data && 'data' in data) {
        return (data as ApiResponse<CurrentSubscriptionResponse>).data;
      }
      // Fallback if response isn't wrapped
      return data as unknown as CurrentSubscriptionResponse;
    } catch (error) {
      if (isApiError(error)) {
        const status = error.response?.status;

        // 404 = no subscription/org, treat as empty
        if (status === 404) {
          return {
            subscription: null,
            usage: null,
          };
        }

        // 401 = unauthorized, let the auth interceptor handle it
        if (status === 401) {
          throw error;
        }
      }

      // For any other error, return empty response instead of failing
      // This allows the UI to show "No Subscription" state
      return {
        subscription: null,
        usage: null,
      };
    }
  },

  /**
   * Create a new subscription (initiate checkout)
   */
  createSubscription: async (data: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> => {
    const response = await apiClient.post<ApiResponse<CreateSubscriptionResponse>>('/subscriptions', data);
    return response.data.data;
  },

  /**
   * Verify Razorpay payment after checkout
   */
  verifyPayment: async (data: VerifyPaymentRequest): Promise<VerifyPaymentResponse> => {
    const response = await apiClient.post<ApiResponse<VerifyPaymentResponse>>('/subscriptions/verify', data);
    return response.data.data;
  },

  // ============================================================================
  // Usage
  // ============================================================================

  /**
   * Get current usage metrics
   */
  getUsage: async (): Promise<UsageDto> => {
    const response = await apiClient.get<ApiResponse<UsageDto>>('/usage');
    return response.data.data;
  },

  /**
   * Check if an action is allowed based on usage limits
   */
  checkUsage: async (action: PaywallAction): Promise<UsageCheckResponse> => {
    try {
      const response = await apiClient.get<ApiResponse<UsageCheckResponse>>(`/usage/check/${action}`);
      return response.data.data;
    } catch (error) {
      // If usage check fails, default to allowed
      if (isApiError(error) && error.response?.status === 404) {
        return {
          allowed: true,
          reason: null,
          currentUsage: 0,
          limit: null,
          upgradeRequired: false,
          suggestedPlan: null,
        };
      }
      throw error;
    }
  },

  // ============================================================================
  // Plan Management
  // ============================================================================

  /**
   * Change subscription plan (upgrade/downgrade)
   */
  changePlan: async (data: ChangePlanRequest): Promise<ChangePlanResponse> => {
    const response = await apiClient.put<ApiResponse<ChangePlanResponse>>(
      '/subscriptions/current/plan',
      data
    );
    return response.data.data;
  },

  /**
   * Cancel subscription
   */
  cancelSubscription: async (data: CancelSubscriptionRequest): Promise<CancelSubscriptionResponse> => {
    const response = await apiClient.delete<ApiResponse<CancelSubscriptionResponse>>(
      '/subscriptions/current',
      { data }
    );
    return response.data.data;
  },

  /**
   * Pause subscription
   */
  pauseSubscription: async (data: PauseSubscriptionRequest): Promise<PauseSubscriptionResponse> => {
    const response = await apiClient.post<ApiResponse<PauseSubscriptionResponse>>(
      '/subscriptions/current/pause',
      data
    );
    return response.data.data;
  },

  /**
   * Resume a paused subscription
   */
  resumeSubscription: async (): Promise<ResumeSubscriptionResponse> => {
    const response = await apiClient.post<ApiResponse<ResumeSubscriptionResponse>>(
      '/subscriptions/current/resume'
    );
    return response.data.data;
  },

  /**
   * Reactivate a cancelled subscription
   */
  reactivateSubscription: async (): Promise<SubscriptionDto> => {
    const response = await apiClient.post<ApiResponse<SubscriptionDto>>(
      '/subscriptions/current/reactivate'
    );
    return response.data.data;
  },

  /**
   * Add additional seats to subscription
   */
  addSeats: async (data: AddSeatsRequest): Promise<AddSeatsResponse> => {
    const response = await apiClient.post<ApiResponse<AddSeatsResponse>>(
      '/subscriptions/current/seats',
      data
    );
    return response.data.data;
  },

  /**
   * Retry failed payment for past_due subscription
   */
  retryPayment: async (): Promise<PaymentRetryResponse> => {
    const response = await apiClient.post<ApiResponse<PaymentRetryResponse>>(
      '/subscriptions/current/retry-payment'
    );
    return response.data.data;
  },

  // ============================================================================
  // Invoices
  // ============================================================================

  /**
   * Get organization's invoices
   */
  getInvoices: async (page = 1, limit = 10): Promise<InvoiceListResponse> => {
    const response = await apiClient.get<ApiResponse<InvoiceListResponse>>(
      '/invoices',
      { params: { page, limit } }
    );
    return response.data.data;
  },

  /**
   * Get a specific invoice
   */
  getInvoice: async (invoiceId: string): Promise<InvoiceDetailDto> => {
    const response = await apiClient.get<ApiResponse<InvoiceDetailDto>>(
      `/invoices/${invoiceId}`
    );
    return response.data.data;
  },

  /**
   * Download invoice PDF
   * Returns the PDF as a blob for saving/sharing
   */
  downloadInvoicePdf: async (invoiceId: string): Promise<Blob> => {
    const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // ============================================================================
  // Payment Methods
  // ============================================================================

  /**
   * Get saved payment methods
   */
  getPaymentMethods: async (): Promise<PaymentMethodListResponse> => {
    const response = await apiClient.get<ApiResponse<PaymentMethodListResponse>>(
      '/payment-methods'
    );
    return response.data.data;
  },

  /**
   * Set a payment method as default
   */
  setDefaultPaymentMethod: async (paymentMethodId: string): Promise<PaymentMethodDto> => {
    const response = await apiClient.post<ApiResponse<PaymentMethodDto>>(
      `/payment-methods/${paymentMethodId}/set-default`
    );
    return response.data.data;
  },

  /**
   * Delete a payment method
   */
  deletePaymentMethod: async (paymentMethodId: string): Promise<void> => {
    await apiClient.delete(`/payment-methods/${paymentMethodId}`);
  },

  // ============================================================================
  // Coupons
  // ============================================================================

  /**
   * Validate a coupon code
   */
  validateCoupon: async (data: ValidateCouponRequest): Promise<ValidateCouponResponse> => {
    const response = await apiClient.post<ApiResponse<ValidateCouponResponse>>(
      '/coupons/validate',
      data
    );
    return response.data.data;
  },
};
