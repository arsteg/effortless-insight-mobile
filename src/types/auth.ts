/**
 * Authentication Types
 * Matches backend auth DTOs
 */

import { UserRole } from './api';

// Login
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  platform: 'ios' | 'android';
  deviceName?: string;
  appVersion?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserDto;
}

export interface TwoFactorRequiredResponse {
  requires2fa: true;
  partialToken: string;
  expiresIn: number;
  methods: ('authenticator' | 'sms')[];
}

// Registration
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  mobile?: string;
  acceptTerms: boolean;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  message: string;
}

// Token Management
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// User Profile
export interface UserDto {
  id: string;
  email: string;
  name: string;
  mobile?: string;
  avatarUrl?: string;
  role: UserRole;
  organizationId?: string;
  organizationName?: string;
}

export interface UserProfileDto {
  id: string;
  email: string;
  name: string;
  mobile?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  is2faEnabled: boolean;
  role: UserRole;
  organization?: OrganizationBasicDto;
  organizations: OrganizationMembershipDto[];
  preferences?: UserPreferencesDto;
  createdAt: string;
  lastLogin?: string;
}

export interface OrganizationBasicDto {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface OrganizationMembershipDto {
  organizationId: string;
  organizationName: string;
  role: UserRole;
  isDefault: boolean;
}

export interface UserPreferencesDto {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  smsNotifications?: boolean;
}

// Sessions
export interface SessionDto {
  id: string;
  deviceName?: string;
  platform: string;
  ipAddress: string;
  location?: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface SessionListResponse {
  currentSessionId: string;
  sessions: SessionDto[];
}

// Two-Factor Authentication
export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export interface TwoFactorLoginRequest {
  partialToken: string;
  code: string;
}

export interface TwoFactorLoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  backupCodeUsed: boolean;
}

// OTP
export interface OtpResponse {
  message: string;
  maskedMobile: string;
  expiresIn: number;
  retryAfter: number;
}

export interface OtpVerifyRequest {
  mobile: string;
  otp: string;
}

// Password Reset
export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

// Auth State
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  biometricEnabled: boolean;
}
