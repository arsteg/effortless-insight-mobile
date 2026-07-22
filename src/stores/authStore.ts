/**
 * Auth Store
 * Manages authentication state using Zustand
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { UserDto, LoginResponse, TwoFactorRequiredResponse, CreateOrganizationRequest } from '../types';

const isWeb = Platform.OS === 'web';
import { authApi, organizationsApi } from '../services/api';
import {
  setTokens,
  clearTokens,
  setUser,
  getUser,
  clearUser,
  hasValidTokens,
  getBiometricEnabled,
  setBiometricEnabled,
  getAccessToken,
  getRefreshToken,
} from '../services/storage/secure';
import { unregisterPushToken } from '../services/pushNotifications';

interface AuthState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  user: UserDto | null;
  biometricEnabled: boolean;
  biometricAvailable: boolean;

  // 2FA state
  requires2fa: boolean;
  partialToken: string | null;

  // Onboarding state
  needsOnboarding: boolean;

  // Actions
  initialize: () => Promise<void>;
  restoreSession: (cachedUser: UserDto) => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  complete2fa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkBiometricAvailability: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<boolean>;
  /**
   * Prompt biometric and, on success, restore the authenticated session from
   * the tokens/user already in secure storage. Returns false if biometric
   * fails or there is no stored session to restore (audit B4).
   */
  unlockWithBiometric: () => Promise<boolean>;
  completeOnboarding: (data: CreateOrganizationRequest) => Promise<void>;
}

// Maps the profile API response to the app's UserDto (shared by initialize and
// biometric unlock so the session-restore logic lives in one place).
function mapProfileToUser(profile: Awaited<ReturnType<typeof authApi.getProfile>>): UserDto {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    mobile: profile.mobile,
    avatarUrl: profile.avatarUrl,
    role: profile.role,
    organization: profile.organization
      ? { id: profile.organization.id, name: profile.organization.name, role: profile.role }
      : undefined,
    organizations: profile.organizations.map((org) => ({
      id: org.organizationId,
      name: org.organizationName,
      role: org.role,
    })),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  user: null,
  biometricEnabled: false,
  biometricAvailable: false,
  requires2fa: false,
  partialToken: null,
  needsOnboarding: false,

  /**
   * Initialize auth state from storage
   */
  initialize: async () => {
    try {
      set({ isLoading: true });

      const biometricEnabled = await getBiometricEnabled();
      await get().checkBiometricAvailability();
      set({ biometricEnabled });

      const hasTokens = await hasValidTokens();
      const cachedUser = hasTokens ? await getUser() : null;

      if (hasTokens && cachedUser) {
        // If biometric is enabled, REQUIRE it before restoring the session —
        // otherwise it was never actually enforced (audit B4). On failure we
        // keep the tokens but stay unauthenticated; the login screen offers an
        // "Unlock" retry and a password fallback.
        if (biometricEnabled && get().biometricAvailable) {
          const unlocked = await get().authenticateWithBiometric();
          if (!unlocked) {
            set({ isLoading: false, isInitialized: true, isAuthenticated: false });
            return;
          }
        }
        await get().restoreSession(cachedUser);
      }

      set({ isLoading: false, isInitialized: true });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        user: null,
      });
    }
  },

  /**
   * Restore the authenticated session from a cached user, then refresh the
   * profile in the background. Shared by initialize() and biometric unlock.
   */
  restoreSession: async (cachedUser: UserDto) => {
    set({
      isAuthenticated: true,
      user: cachedUser,
      needsOnboarding: !cachedUser.organization?.id,
    });
    try {
      const profile = await authApi.getProfile();
      const user = mapProfileToUser(profile);
      await setUser(user);
      set({ user, needsOnboarding: !user.organization?.id });
    } catch {
      // Tokens likely invalid — clear and de-authenticate.
      await clearTokens();
      await clearUser();
      set({ isAuthenticated: false, user: null, needsOnboarding: false });
    }
  },

  unlockWithBiometric: async () => {
    const ok = await get().authenticateWithBiometric();
    if (!ok) return false;
    const hasTokens = await hasValidTokens();
    const cachedUser = hasTokens ? await getUser() : null;
    if (!hasTokens || !cachedUser) return false;
    await get().restoreSession(cachedUser);
    return true;
  },

  /**
   * Login with email and password
   */
  login: async (email: string, password: string, rememberMe = false) => {
    set({ isLoading: true });

    try {
      const response = await authApi.login(email, password, rememberMe);

      // Check if 2FA is required
      if ('requires2fa' in response && response.requires2fa) {
        const twoFaResponse = response as TwoFactorRequiredResponse;
        set({
          isLoading: false,
          requires2fa: true,
          partialToken: twoFaResponse.partialToken,
        });
        return;
      }

      // Normal login success
      const loginResponse = response as LoginResponse;
      await setTokens(loginResponse.accessToken, loginResponse.refreshToken);

      const user = loginResponse.user;
      if (user) {
        await setUser(user);
      }

      set({
        isLoading: false,
        isAuthenticated: true,
        user: user || null,
        requires2fa: false,
        partialToken: null,
        needsOnboarding: !user?.organization?.id,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Complete 2FA login
   */
  complete2fa: async (code: string) => {
    const { partialToken } = get();

    if (!partialToken) {
      throw new Error('No 2FA session active');
    }

    set({ isLoading: true });

    try {
      const response = await authApi.twoFactorLogin({
        partialToken,
        code,
      });

      await setTokens(response.accessToken, response.refreshToken);

      // Fetch user profile after 2FA
      const profile = await authApi.getProfile();
      const user: UserDto = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        mobile: profile.mobile,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
        organization: profile.organization ? {
          id: profile.organization.id,
          name: profile.organization.name,
          role: profile.role,
        } : undefined,
        organizations: profile.organizations.map(org => ({
          id: org.organizationId,
          name: org.organizationName,
          role: org.role,
        })),
      };
      await setUser(user);

      set({
        isLoading: false,
        isAuthenticated: true,
        user,
        requires2fa: false,
        partialToken: null,
        needsOnboarding: !user.organization?.id,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Logout
   */
  logout: async () => {
    set({ isLoading: true });

    try {
      // Deactivate this device's push token BEFORE clearing auth, while the
      // access token is still valid. Otherwise the device stays registered to
      // this user and the next user on the same device receives their pushes
      // (audit MO-01 / CC-10).
      await unregisterPushToken().catch(() => {
        // Best effort — must not block logout
      });

      // Call logout API (best effort)
      const token = await getAccessToken();
      if (token) {
        await authApi.logout().catch(() => {
          // Ignore logout API errors
        });
      }
    } finally {
      // Clear local state
      await clearTokens();
      await clearUser();

      set({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        requires2fa: false,
        partialToken: null,
        needsOnboarding: false,
      });
    }
  },

  /**
   * Refresh user profile
   */
  refreshProfile: async () => {
    try {
      const profile = await authApi.getProfile();
      const user: UserDto = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        mobile: profile.mobile,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
        organization: profile.organization ? {
          id: profile.organization.id,
          name: profile.organization.name,
          role: profile.role,
        } : undefined,
        organizations: profile.organizations.map(org => ({
          id: org.organizationId,
          name: org.organizationName,
          role: org.role,
        })),
      };
      await setUser(user);
      set({ user, needsOnboarding: !user.organization?.id });
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      throw error;
    }
  },

  /**
   * Check if biometric auth is available on device
   */
  checkBiometricAvailability: async () => {
    if (isWeb) {
      set({ biometricAvailable: false });
      return;
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      set({ biometricAvailable: hasHardware && isEnrolled });
    } catch {
      set({ biometricAvailable: false });
    }
  },

  /**
   * Enable biometric authentication
   */
  enableBiometric: async () => {
    if (isWeb) return false;

    const { biometricAvailable } = get();

    if (!biometricAvailable) {
      return false;
    }

    try {
      // Test biometric auth
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await setBiometricEnabled(true);
        set({ biometricEnabled: true });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  },

  /**
   * Disable biometric authentication
   */
  disableBiometric: async () => {
    await setBiometricEnabled(false);
    set({ biometricEnabled: false });
  },

  /**
   * Authenticate using biometric
   */
  authenticateWithBiometric: async () => {
    if (isWeb) return false;

    const { biometricEnabled, biometricAvailable } = get();

    if (!biometricEnabled || !biometricAvailable) {
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with biometrics',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch {
      return false;
    }
  },

  /**
   * Complete onboarding by creating an organization
   */
  completeOnboarding: async (data: CreateOrganizationRequest) => {
    set({ isLoading: true });

    try {
      const response = await organizationsApi.createOrganization(data);

      // If response includes new tokens, update them
      if (response.accessToken) {
        const refreshToken = await getRefreshToken();
        await setTokens(response.accessToken, refreshToken || '');
      }

      // Update user with organization info
      const { user } = get();
      if (user) {
        const updatedUser: UserDto = {
          ...user,
          organization: {
            id: response.id,
            name: response.name,
            role: response.currentUserRole,
          },
          organizations: [
            ...user.organizations,
            {
              id: response.id,
              name: response.name,
              role: response.currentUserRole,
            },
          ],
        };
        await setUser(updatedUser);
        set({
          user: updatedUser,
          needsOnboarding: false,
          isLoading: false,
        });
      } else {
        // Fetch profile to get updated user data
        await get().refreshProfile();
        set({
          needsOnboarding: false,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
