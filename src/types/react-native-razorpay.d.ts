/**
 * Type declarations for react-native-razorpay
 * This module provides Razorpay payment integration for React Native
 */

declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name?: string;
    description?: string;
    image?: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
      backdrop_color?: string;
    };
  }

  export interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  export interface RazorpayErrorResponse {
    code: number;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  }

  export interface RazorpayCheckoutModule {
    open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>;
  }

  const RazorpayCheckout: RazorpayCheckoutModule;
  export default RazorpayCheckout;
}
