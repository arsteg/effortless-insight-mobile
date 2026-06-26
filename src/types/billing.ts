/**
 * Billing Types
 * Matches backend Billing DTOs
 */

// ============================================================================
// Enums
// ============================================================================

export type BillingCycle = 'monthly' | 'annually';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

// ============================================================================
// Plan Types
// ============================================================================

export interface PlanLimitsDto {
  noticesPerMonth: number;
  users: number;
  storageGb: number;
  organizationsCount: number;
  additionalUsersAllowed: boolean;
  apiCalls: number;
}

export interface PerSeatPricingDto {
  monthly: number | null;
  annually: number | null;
}

export interface PlanPricingDto {
  monthly: number | null;
  annually: number | null;
  currency: string;
  annualDiscount: number | null;
  perSeat: PerSeatPricingDto | null;
}

export interface PlanDto {
  id: string;
  code: string;
  name: string;
  displayName: string;
  description: string | null;
  pricing: PlanPricingDto;
  limits: PlanLimitsDto;
  features: string[];
  isPopular: boolean;
  trialDays: number;
  contactSales: boolean;
}

export interface AddOnDto {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
}

export interface PlansResponse {
  plans: PlanDto[];
  addOns: AddOnDto[] | null;
}

// ============================================================================
// Subscription Types
// ============================================================================

export interface SeatsDto {
  included: number;
  additional: number;
  used: number;
}

export interface SubscriptionPricingDto {
  baseAmount: number;
  additionalSeatsAmount: number;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  currency: string;
}

export interface PaymentMethodSummaryDto {
  type: string;
  last4: string | null;
  brand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  upiId: string | null;
}

export interface ScheduledChangeDto {
  planCode: string;
  billingCycle: string | null;
  effectiveDate: string;
}

export interface SubscriptionDto {
  id: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  seats: SeatsDto;
  pricing: SubscriptionPricingDto;
  nextBillingDate: string;
  paymentMethod: PaymentMethodSummaryDto | null;
  razorpaySubscriptionId: string | null;
  scheduledChange: ScheduledChangeDto | null;
}

// ============================================================================
// Usage Types
// ============================================================================

export interface UsagePeriodDto {
  start: string;
  end: string;
}

export interface UsageMetricDto {
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
}

export interface StorageUsageDto {
  usedBytes: number;
  usedGb: number;
  limitGb: number;
  percentage: number;
  remainingGb: number;
}

export interface UsageAlertDto {
  type: string;
  level: string;
  message: string;
}

export interface UsageDto {
  period: UsagePeriodDto;
  notices: UsageMetricDto;
  users: UsageMetricDto;
  storage: StorageUsageDto;
  apiCalls: UsageMetricDto | null;
  alerts: UsageAlertDto[] | null;
}

export interface CurrentSubscriptionResponse {
  subscription: SubscriptionDto | null;
  usage: UsageDto | null;
}

// Extended response with plan details (used by mobile app)
export interface CurrentSubscriptionWithPlanResponse extends CurrentSubscriptionResponse {
  plan?: PlanDto | null;
}

export interface UsageCheckResponse {
  allowed: boolean;
  reason: string | null;
  currentUsage: number;
  limit: number | null;
  upgradeRequired: boolean;
  suggestedPlan: string | null;
}

// ============================================================================
// Checkout Types
// ============================================================================

export interface BillingDetailsRequest {
  organizationName: string;
  gstin?: string;
  address: string;
  addressLine2?: string;
  city?: string;
  state: string;
  pincode: string;
  email?: string;
  phone?: string;
}

export interface CreateSubscriptionRequest {
  planCode: string;
  billingCycle: BillingCycle;
  additionalSeats?: number;
  billingDetails?: BillingDetailsRequest;
  couponCode?: string;
  autoRenew?: boolean;
}

export interface RazorpayOrderDto {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  key: string;
}

export interface CheckoutPrefillDto {
  name: string | null;
  email: string | null;
  contact: string | null;
}

export interface CheckoutThemeDto {
  color: string;
}

export interface CheckoutOptionsDto {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  orderId: string;
  prefill: CheckoutPrefillDto;
  theme: CheckoutThemeDto;
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  razorpayOrder: RazorpayOrderDto;
  checkoutOptions: CheckoutOptionsDto;
}

export interface VerifyPaymentRequest {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export interface SubscriptionActivatedDto {
  id: string;
  status: string;
  planCode: string;
  activatedAt: string;
}

export interface InvoiceSummaryDto {
  id: string;
  number: string;
  downloadUrl: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  subscription: SubscriptionActivatedDto;
  invoice: InvoiceSummaryDto | null;
}

// ============================================================================
// Paywall Types
// ============================================================================

export type PaywallAction =
  | 'create_notice'
  | 'add_user'
  | 'upload_file'
  | 'ai_analysis';

export interface PaywallState {
  isBlocked: boolean;
  action: PaywallAction;
  currentUsage: number;
  limit: number | null;
  suggestedPlan: string | null;
  message: string;
}
