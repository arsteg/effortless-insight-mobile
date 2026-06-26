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
      // Log for debugging
      if (isApiError(error)) {
        const status = error.response?.status;
        console.log('[Billing API] getCurrentSubscription error:', status, error.response?.data);

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
      } else {
        console.log('[Billing API] getCurrentSubscription non-API error:', error);
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
};
