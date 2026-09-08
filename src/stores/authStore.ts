/**
 * Auth Store
 * Manages authentication state using Zustand
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { UserDto, LoginResponse, TwoFactorRequiredResponse, CreateOrganizationRequest } from '../types';

const isWeb = Platform.OS === 'web';

/**
 * Prompt outcomes that mean "the user (or the system) backed out", as opposed
 * to a rejected scan. `user_fallback` is the OS "use passcode" affordance.
 */
const CANCEL_ERRORS = new Set<string>(['user_cancel', 'app_cancel', 'system_cancel', 'user_fallback']);
import { authApi, organizationsApi } from '../services/api';
import { isApiError, setOnAuthFailure } from '../services/api/client';
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
import { clearAll as clearDocumentCache } from '../services/documentCache';
import { clearPendingUploads } from '../services/pendingUploads';
import { useUIStore } from './uiStore';

/**
 * Why a biometric unlock ended. A deliberate cancel is not a failure and must
 * not be reported to the user as one, so the reason has to survive the call
 * instead of being flattened to a boolean.
 */
export type BiometricOutcome =
  | 'success'
  /** The user dismissed the OS prompt, or the system did (incoming call, etc.). */
  | 'cancelled'
  /** The scan was rejected, the sensor is locked out, or it errored. */
  | 'failed'
  /** Scan passed, but secure storage held no session to restore. */
  | 'no-session'
  /** Biometric is off, unavailable, or unsupported on this platform. */
  | 'unavailable';

interface AuthState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  user: UserDto | null;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  /**
   * Whether secure storage still holds a session that biometric can unlock.
   * Biometric restores an existing session — it is not a credential — so with
   * no stored session (fresh install, or after an explicit logout, which the
   * server revokes) a successful scan has nothing to restore. Screens gate the
   * prompt on this so we never ask for a fingerprint we cannot act on.
   */
  hasStoredSession: boolean;
  /**
   * Set once `initialize()` has shown the launch prompt, so the login screen
   * does not fire a second one on top of a cancel (TC-MOB-004).
   */
  biometricPromptedAtLaunch: boolean;
  /**
   * Set when the session ends for a reason the user didn't choose (refresh
   * failed, session revoked). The login screen shows it, so an expiry is
   * explained rather than dumping the user on a blank sign-in form.
   */
  sessionNotice: string | null;

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
  /**
   * Abandon a pending 2FA step and return to a clean signed-out state. Without
   * this the login screen's `requires2fa` effect bounces the user straight back
   * to the 2FA screen, trapping them with no way to sign in as someone else.
   */
  cancel2fa: () => void;
  /** Clears the expiry notice once the login screen has shown it. */
  clearSessionNotice: () => void;
  /**
   * Revalidate the session against the server. Used when the app returns to
   * the foreground: expiry is otherwise only noticed on the next request, so
   * a resumed app sits showing stale data while silently unauthenticated.
   */
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkBiometricAvailability: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<BiometricOutcome>;
  /** Dismisses the native prompt where the platform supports it (Android). */
  cancelBiometricPrompt: () => Promise<void>;
  /**
   * Prompt biometric and, on success, restore the authenticated session from
   * the tokens/user already in secure storage. Returns false if biometric
   * fails or there is no stored session to restore (audit B4).
   */
  unlockWithBiometric: () => Promise<BiometricOutcome>;
  completeOnboarding: (data: CreateOrganizationRequest) => Promise<void>;
  /**
   * Finish an OAuth sign-in once the provider has returned tokens. Owns token
   * persistence, profile mapping and store state so the login and register
   * screens cannot drift apart (they previously duplicated this and both
   * skipped `mapProfileToUser`).
   */
  completeOAuthLogin: (params: {
    accessToken: string;
    refreshToken: string;
    /** Present only when the backend already returned a mapped user. */
    user?: UserDto;
  }) => Promise<void>;
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
  hasStoredSession: false,
  biometricPromptedAtLaunch: false,
  sessionNotice: null,
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
      set({ hasStoredSession: !!(hasTokens && cachedUser) });

      if (hasTokens && cachedUser) {
        // If biometric is enabled, REQUIRE it before restoring the session —
        // otherwise it was never actually enforced (audit B4). On failure we
        // keep the tokens but stay unauthenticated; the login screen offers an
        // "Unlock" retry and a password fallback. If the sensor has become
        // unavailable/unenrolled since it was enabled, that must NOT silently
        // bypass the gate — fall back to password login (audit C3).
        if (biometricEnabled) {
          if (!get().biometricAvailable) {
            set({ isLoading: false, isInitialized: true, isAuthenticated: false });
            return;
          }
          set({ biometricPromptedAtLaunch: true });
          const outcome = await get().authenticateWithBiometric();
          if (outcome !== 'success') {
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
    } catch (error) {
      // Only de-authenticate when the server actually rejected the tokens.
      // A network failure (offline cold start) must keep the cached session,
      // otherwise offline support is defeated by being logged out on launch.
      const status = isApiError(error) ? error.response?.status : undefined;
      if (status === 401 || status === 403) {
        await clearTokens();
        await clearUser();
        set({
          isAuthenticated: false,
          user: null,
          needsOnboarding: false,
          hasStoredSession: false,
        });
      }
    }
  },

  unlockWithBiometric: async () => {
    const outcome = await get().authenticateWithBiometric();
    if (outcome !== 'success') return outcome;
    const hasTokens = await hasValidTokens();
    const cachedUser = hasTokens ? await getUser() : null;
    if (!hasTokens || !cachedUser) {
      // The scan succeeded but there is nothing to unlock. Record that so the
      // UI stops offering biometric and falls back to password (audit B4).
      set({ hasStoredSession: false });
      return 'no-session';
    }
    await get().restoreSession(cachedUser);
    return 'success';
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
        // A password login re-arms biometric unlock for the next launch.
        hasStoredSession: true,
        sessionNotice: null,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  cancel2fa: () => {
    set({ requires2fa: false, partialToken: null, isLoading: false });
  },

  clearSessionNotice: () => set({ sessionNotice: null }),

  checkSession: async () => {
    if (!get().isAuthenticated) return;
    // Offline is not expiry. A request that never reaches the server says
    // nothing about the session, and acting on it would break offline use.
    if (!useUIStore.getState().isOnline) return;
    try {
      await get().refreshProfile();
    } catch {
      // A 401 is handled by the client interceptor, which either refreshes the
      // token or fires onAuthFailure. Anything else is not the session's fault.
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
      // `mapProfileToUser` is the single definition of this mapping; two
      // hand-rolled copies had drifted alongside it.
      const user = mapProfileToUser(await authApi.getProfile());
      await setUser(user);

      set({
        isLoading: false,
        isAuthenticated: true,
        user,
        requires2fa: false,
        partialToken: null,
        needsOnboarding: !user.organization?.id,
        // 2FA login stores tokens too, so biometric unlock is armed again.
        hasStoredSession: true,
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

      // Downloaded notices are confidential tax documents. Leaving them in the
      // app sandbox would expose the previous user's filings to whoever signs
      // in next on a shared device (TC-MOB-057).
      await clearDocumentCache().catch(() => {
        // Best effort — must not block logout.
      });

      // A queued scan is an unsent document belonging to whoever captured it;
      // it must never upload under the next account on this device.
      await clearPendingUploads().catch(() => {
        // Best effort — must not block logout.
      });

      set({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        requires2fa: false,
        partialToken: null,
        needsOnboarding: false,
        // Logout revokes the session server-side, so there is no longer
        // anything for biometric to restore. The biometric *preference* is
        // kept, so the next password login re-arms it.
        hasStoredSession: false,
      });
    }
  },

  /**
   * Refresh user profile
   */
  refreshProfile: async () => {
    try {
      // `mapProfileToUser` is the single definition of this mapping; two
      // hand-rolled copies had drifted alongside it.
      const user = mapProfileToUser(await authApi.getProfile());
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
    if (isWeb) return 'unavailable';

    const { biometricEnabled, biometricAvailable } = get();

    if (!biometricEnabled || !biometricAvailable) {
      return 'unavailable';
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with biometrics',
        disableDeviceFallback: false,
      });

      if (result.success) return 'success';

      // Distinguish "the user chose not to" from "the sensor rejected them" —
      // only the latter deserves an error message (TC-MOB-004).
      return CANCEL_ERRORS.has(result.error) ? 'cancelled' : 'failed';
    } catch {
      return 'failed';
    }
  },

  cancelBiometricPrompt: async () => {
    // Android can dismiss the system dialog programmatically; iOS cannot, so
    // there the button simply stops the app from re-prompting.
    if (Platform.OS !== 'android') return;
    try {
      await LocalAuthentication.cancelAuthenticate();
    } catch {
      // Nothing to cancel — not an error.
    }
  },

  completeOAuthLogin: async ({ accessToken, refreshToken, user }) => {
    set({ isLoading: true });
    try {
      // Tokens must land before any authenticated call — the request
      // interceptor reads them from storage.
      await setTokens(accessToken, refreshToken);

      // The token callback carries no user, so fetch it. `mapProfileToUser`
      // is what turns the API profile into a UserDto; skipping it left
      // `organizations[].id` undefined throughout the app.
      const resolved = user ?? mapProfileToUser(await authApi.getProfile());
      await setUser(resolved);

      set({
        isLoading: false,
        isAuthenticated: true,
        user: resolved,
        requires2fa: false,
        partialToken: null,
        needsOnboarding: !resolved.organization?.id,
        // Arms biometric unlock for the next launch, same as a password login.
        hasStoredSession: true,
      });
    } catch (error) {
      // Never strand tokens: a half-finished OAuth login that left them in
      // storage would silently authenticate on the next launch even though
      // the user was shown an error.
      await clearTokens();
      await clearUser();
      set({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        hasStoredSession: false,
      });
      throw error;
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

// When the API client's token refresh definitively fails it clears stored
// tokens; without this hook the in-memory store would keep reporting an
// authenticated session whose every request 401s until app restart.
setOnAuthFailure(() => {
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    requires2fa: false,
    partialToken: null,
    needsOnboarding: false,
    // The interceptor already cleared the tokens, so there is nothing left for
    // biometric to unlock. Without this the login screen prompts for a scan
    // that cannot possibly succeed.
    hasStoredSession: false,
    sessionNotice: 'Session expired. Please sign in again.',
  });
});
