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
  ChangePasswordRequest,
  UpdateProfileRequest,
  TwoFactorLoginRequest,
  TwoFactorLoginResponse,
  TwoFactorRequiredResponse,
  SessionListResponse,
  OAuthProvidersResponse,
  OAuthLoginUrlResponse,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
} from '../../types';

// API Response wrapper type (backend wraps all responses)
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

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
    const response = await apiClient.post<ApiResponse<LoginResponse | TwoFactorRequiredResponse>>('/auth/login', payload);
    return response.data.data;
  },

  /**
   * Register new user
   */
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<ApiResponse<RegisterResponse>>('/auth/register', data);
    return response.data.data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string): Promise<TokenResponse> => {
    const response = await apiClient.post<ApiResponse<TokenResponse>>('/auth/refresh', { refreshToken });
    return response.data.data;
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
    const response = await apiClient.get<ApiResponse<UserProfileDto>>('/auth/me');
    return response.data.data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfileDto> => {
    const response = await apiClient.patch<ApiResponse<UserProfileDto>>('/auth/me', data);
    return response.data.data;
  },

  /**
   * Change password (authenticated user)
   */
  changePassword: async (data: ChangePasswordRequest): Promise<{ message: string }> => {
    const response = await apiClient.put<ApiResponse<{ message: string }>>('/auth/change-password', data);
    return response.data.data;
  },

  /**
   * Request password reset
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const payload: ForgotPasswordRequest = { email };
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/forgot-password', payload);
    return response.data.data;
  },

  /**
   * Reset password with token
   */
  resetPassword: async (data: ResetPasswordRequest): Promise<{ message: string }> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/reset-password', data);
    return response.data.data;
  },

  /**
   * Verify email with token
   */
  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/verify-email', { token });
    return response.data.data;
  },

  /**
   * Request email verification resend
   */
  resendVerificationEmail: async (): Promise<{ message: string }> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/verify-email/resend');
    return response.data.data;
  },

  /**
   * Complete 2FA login
   */
  twoFactorLogin: async (data: TwoFactorLoginRequest): Promise<TwoFactorLoginResponse> => {
    const response = await apiClient.post<ApiResponse<TwoFactorLoginResponse>>('/auth/2fa/login', data);
    return response.data.data;
  },

  /**
   * Get active sessions
   */
  getSessions: async (): Promise<SessionListResponse> => {
    const response = await apiClient.get<ApiResponse<SessionListResponse>>('/auth/sessions');
    return response.data.data;
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
    const response = await apiClient.post<ApiResponse<TokenResponse>>('/auth/switch-organization', { organizationId });
    return response.data.data;
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

  // ============================================
  // OAuth Methods
  // ============================================

  /**
   * Get enabled OAuth providers
   */
  getOAuthProviders: async (): Promise<OAuthProvidersResponse> => {
    const response = await apiClient.get<ApiResponse<OAuthProvidersResponse>>('/auth/oauth/providers');
    return response.data.data;
  },

  /**
   * Get OAuth login URL for a provider
   */
  getOAuthLoginUrl: async (
    provider: string,
    options?: { state?: string; forceReauth?: boolean; redirectUri?: string }
  ): Promise<OAuthLoginUrlResponse> => {
    const params = new URLSearchParams();
    if (options?.state) params.append('state', options.state);
    if (options?.forceReauth) params.append('forceReauth', 'true');
    if (options?.redirectUri) params.append('redirectUri', options.redirectUri);
    // Always pass platform for mobile
    params.append('platform', Platform.OS);

    const queryString = params.toString();
    const url = `/auth/oauth/${provider}/login${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<ApiResponse<OAuthLoginUrlResponse>>(url);
    return response.data.data;
  },

  /**
   * Handle OAuth callback
   */
  handleOAuthCallback: async (
    provider: string,
    data: OAuthCallbackRequest
  ): Promise<OAuthCallbackResponse> => {
    const response = await apiClient.post<ApiResponse<OAuthCallbackResponse>>(
      `/auth/oauth/${provider}/callback`,
      {
        ...data,
        deviceInfo: getDeviceInfo(),
      }
    );
    return response.data.data;
  },
};
