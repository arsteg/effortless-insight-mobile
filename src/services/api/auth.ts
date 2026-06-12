/**
 * Authentication API Service
 */

import { Platform } from 'react-native';
import { apiClient } from './client';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  TokenResponse,
  UserProfileDto,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  TwoFactorLoginRequest,
  TwoFactorLoginResponse,
  TwoFactorRequiredResponse,
  SessionListResponse,
} from '../../types';

// Get device info for login tracking
const getDeviceInfo = () => ({
  platform: Platform.OS as 'ios' | 'android',
  deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
  appVersion: '1.0.0', // TODO: Get from app.json
});

export const authApi = {
  /**
   * Login user
   */
  login: async (email: string, password: string, rememberMe = false): Promise<LoginResponse | TwoFactorRequiredResponse> => {
    const payload: LoginRequest = {
      email,
      password,
      rememberMe,
      deviceInfo: getDeviceInfo(),
    };
    const response = await apiClient.post<LoginResponse | TwoFactorRequiredResponse>('/auth/login', payload);
    return response.data;
  },

  /**
   * Register new user
   */
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<UserProfileDto> => {
    const response = await apiClient.get<UserProfileDto>('/auth/me');
    return response.data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: Partial<UserProfileDto>): Promise<UserProfileDto> => {
    const response = await apiClient.patch<UserProfileDto>('/auth/me', data);
    return response.data;
  },

  /**
   * Request password reset
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const payload: ForgotPasswordRequest = { email };
    const response = await apiClient.post<{ message: string }>('/auth/forgot-password', payload);
    return response.data;
  },

  /**
   * Reset password with token
   */
  resetPassword: async (data: ResetPasswordRequest): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/reset-password', data);
    return response.data;
  },

  /**
   * Verify email with token
   */
  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/verify-email', { token });
    return response.data;
  },

  /**
   * Request email verification resend
   */
  resendVerificationEmail: async (): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/verify-email/resend');
    return response.data;
  },

  /**
   * Complete 2FA login
   */
  twoFactorLogin: async (data: TwoFactorLoginRequest): Promise<TwoFactorLoginResponse> => {
    const response = await apiClient.post<TwoFactorLoginResponse>('/auth/2fa/login', data);
    return response.data;
  },

  /**
   * Get active sessions
   */
  getSessions: async (): Promise<SessionListResponse> => {
    const response = await apiClient.get<SessionListResponse>('/auth/sessions');
    return response.data;
  },

  /**
   * Revoke a session
   */
  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/auth/sessions/${sessionId}`);
  },

  /**
   * Switch organization context
   */
  switchOrganization: async (organizationId: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/switch-organization', { organizationId });
    return response.data;
  },

  /**
   * Register push notification token
   */
  registerPushToken: async (token: string): Promise<void> => {
    await apiClient.post('/notifications/register', {
      token,
      platform: Platform.OS,
    });
  },

  /**
   * Unregister push notification token
   */
  unregisterPushToken: async (token: string): Promise<void> => {
    await apiClient.delete('/notifications/unregister', {
      data: { token },
    });
  },
};
