/**
 * Organization Types
 * Matches backend Organization DTOs
 */

// ============================================================================
// GSTIN Types
// ============================================================================

export interface GstinDto {
  id: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  isPrimary: boolean;
  status: string;
  addedAt: string;
}

export interface ValidateGstinResponse {
  isValid: boolean;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  entityType: string | null;
  errorMessage: string | null;
}

// ============================================================================
// Organization Types
// ============================================================================

export interface CreateOrganizationRequest {
  name: string;
  legalName?: string;
  gstin: string;
  industry?: string;
  state: string;
  city?: string;
  annualTurnoverRange?: string;
}

export interface CreateOrganizationResponse {
  id: string;
  name: string;
  legalName: string | null;
  gstins: GstinDto[];
  industry: string | null;
  state: string | null;
  city: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  memberCount: number;
  currentUserRole: string;
  createdAt: string;
  accessToken: string | null;
  expiresIn: number | null;
}

// OrganizationBasicDto is imported from auth.ts
import type { OrganizationBasicDto } from './auth';

export interface OrganizationListResponse {
  organizations: OrganizationBasicDto[];
}

export interface AddressDto {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
}

export interface SubscriptionInfoDto {
  planCode: string;
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
}

export interface OrganizationSettingsDto {
  defaultReminderDays: number[] | null;
  notificationEmail: boolean;
  notificationSms: boolean;
  allowCaAccess: boolean;
  requireResponseApproval: boolean;
  timezone: string;
  language: string;
  dateFormat: string;
}

export interface OrganizationDetailResponse {
  id: string;
  name: string;
  legalName: string | null;
  displayName: string | null;
  industry: string | null;
  subIndustry: string | null;
  businessType: string | null;
  annualTurnoverRange: string | null;
  employeeCountRange: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: AddressDto | null;
  pan: string | null;
  gstins: GstinDto[];
  subscription: SubscriptionInfoDto | null;
  settings: OrganizationSettingsDto | null;
  logoUrl: string | null;
  memberCount: number;
  currentUserRole: string;
  createdAt: string;
  updatedAt: string | null;
}

// ============================================================================
// Industry Options (for dropdown)
// ============================================================================

export const INDUSTRY_OPTIONS = [
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'trading', label: 'Trading' },
  { value: 'services', label: 'Services' },
  { value: 'retail', label: 'Retail' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'construction', label: 'Construction' },
  { value: 'it_software', label: 'IT & Software' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'logistics', label: 'Logistics & Transport' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'other', label: 'Other' },
] as const;

export const TURNOVER_OPTIONS = [
  { value: 'below_40l', label: 'Below ₹40 Lakhs' },
  { value: '40l_1cr', label: '₹40 Lakhs - ₹1 Crore' },
  { value: '1cr_5cr', label: '₹1 Crore - ₹5 Crore' },
  { value: '5cr_10cr', label: '₹5 Crore - ₹10 Crore' },
  { value: '10cr_50cr', label: '₹10 Crore - ₹50 Crore' },
  { value: 'above_50cr', label: 'Above ₹50 Crore' },
] as const;

export const INDIAN_STATES = [
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'CT', label: 'Chhattisgarh' },
  { value: 'DN', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'DL', label: 'Delhi' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OR', label: 'Odisha' },
  { value: 'PY', label: 'Puducherry' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UT', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
] as const;
