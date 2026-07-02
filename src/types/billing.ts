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
  | 'paused'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'void' | 'refunded';

export type PaymentMethodType = 'card' | 'upi' | 'netbanking' | 'wallet';

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

// ============================================================================
// Plan Change Types
// ============================================================================

export interface ChangePlanRequest {
  newPlanCode: string;
  billingCycle: BillingCycle;
  additionalSeats?: number;
  effectiveDate: 'immediate' | 'period_end';
}

export interface ChangePlanResponse {
  type: 'upgrade' | 'downgrade';
  prorationAmount: number | null;
  newPlanAmount: number | null;
  totalDue: number | null;
  effectiveImmediately: boolean;
  razorpayOrder: RazorpayOrderDto | null;
  scheduledPlanCode: string | null;
  effectiveDate: string | null;
  message: string | null;
}

// ============================================================================
// Cancel Subscription Types
// ============================================================================

export interface CancelSubscriptionRequest {
  reason: string;
  feedback?: string;
  cancelImmediately: boolean;
}

export interface SubscriptionCancelledDto {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  cancellationDate: string | null;
}

export interface CancelSubscriptionResponse {
  subscription: SubscriptionCancelledDto;
  message: string;
}

// ============================================================================
// Pause/Resume Subscription Types
// ============================================================================

export interface PauseSubscriptionRequest {
  reason: string;
  resumeAt?: string;
}

export interface PauseSubscriptionResponse {
  subscriptionId: string;
  status: string;
  pausedAt: string | null;
  scheduledResumeAt: string | null;
}

export interface ResumeSubscriptionResponse {
  subscriptionId: string;
  status: string;
  currentPeriodEnd: string;
}

// ============================================================================
// Add Seats Types
// ============================================================================

export interface AddSeatsRequest {
  additionalSeats: number;
}

export interface AddSeatsResponse {
  totalSeats: number;
  prorationAmount: number;
  razorpayOrder: RazorpayOrderDto | null;
}

// ============================================================================
// Reactivate Subscription Types
// ============================================================================

export interface ReactivateSubscriptionResponse {
  subscription: SubscriptionDto;
}

// ============================================================================
// Payment Retry Types
// ============================================================================

export interface PaymentRetryResponse {
  success: boolean;
  message: string;
  newStatus: SubscriptionStatus;
  nextBillingDate: string | null;
}

// ============================================================================
// Invoice Types
// ============================================================================

export interface InvoiceDto {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  description: string | null;
  pdfUrl: string;
}

export interface InvoiceBillingDetailsDto {
  organizationName: string;
  gstin: string | null;
  address: string;
  city: string | null;
  state: string;
  stateCode: string | null;
  pincode: string;
  country: string;
  email: string | null;
  phone: string | null;
}

export interface InvoiceLineItemDto {
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  hsnCode: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface InvoiceDetailDto extends InvoiceDto {
  discountDescription: string | null;
  taxRate: number;
  taxAmount: number;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  amountPaid: number;
  amountDue: number;
  hsnCode: string;
  placeOfSupply: string | null;
  isInterState: boolean;
  billingDetails: InvoiceBillingDetailsDto;
  lineItems: InvoiceLineItemDto[];
  notes: string | null;
  paidAt: string | null;
}

export interface BillingPaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface InvoiceListResponse {
  invoices: InvoiceDto[];
  pagination: BillingPaginationDto;
}

// ============================================================================
// Payment Method Types
// ============================================================================

export interface PaymentMethodDto {
  id: string;
  type: PaymentMethodType;
  isDefault: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
  cardExpiryMonth: number | null;
  cardExpiryYear: number | null;
  cardName: string | null;
  upiId: string | null;
  lastUsedAt: string | null;
}

export interface PaymentMethodListResponse {
  paymentMethods: PaymentMethodDto[];
}

// ============================================================================
// Coupon Types
// ============================================================================

export interface ValidateCouponRequest {
  code: string;
  planCode: string;
  billingCycle: BillingCycle;
}

export interface CouponDetailsDto {
  code: string;
  description: string | null;
  discountType: 'percent' | 'fixed' | 'percentage';
  discountValue: number;
  maxDiscountAmount: number | null;
  calculatedDiscount: number;
}

export interface ValidateCouponResponse {
  isValid: boolean;
  errorMessage: string | null;
  coupon: CouponDetailsDto | null;
}
