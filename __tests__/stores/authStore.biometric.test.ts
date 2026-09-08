/**
 * Biometric login/unlock behaviour — TC-MOB-003 and TC-MOB-004.
 *
 * These exercise the real store; only the native/HTTP edges are mocked.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '../../src/stores/authStore';
import {
  hasValidTokens,
  getUser,
  getBiometricEnabled,
  clearTokens,
} from '../../src/services/storage/secure';
import { authApi } from '../../src/services/api';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  cancelAuthenticate: jest.fn(),
}));

jest.mock('../../src/services/storage/secure', () => ({
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
  setUser: jest.fn(),
  getUser: jest.fn(),
  clearUser: jest.fn(),
  hasValidTokens: jest.fn(),
  getBiometricEnabled: jest.fn(),
  setBiometricEnabled: jest.fn(),
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
}));

jest.mock('../../src/services/api', () => ({
  authApi: { getProfile: jest.fn(), login: jest.fn(), logout: jest.fn() },
  organizationsApi: { createOrganization: jest.fn() },
}));

jest.mock('../../src/services/api/client', () => ({
  isApiError: () => false,
  setOnAuthFailure: jest.fn(),
}));

jest.mock('../../src/services/pushNotifications', () => ({
  unregisterPushToken: jest.fn().mockResolvedValue(undefined),
}));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const CACHED_USER = {
  id: 'u1',
  email: 'user@example.com',
  name: 'Test User',
  organization: { id: 'o1', name: 'Org', role: 'owner' },
  organizations: [],
} as any;

const PROFILE = {
  id: 'u1',
  email: 'user@example.com',
  name: 'Test User',
  mobile: null,
  avatarUrl: null,
  role: 'owner',
  organization: { id: 'o1', name: 'Org' },
  organizations: [],
} as any;

/** Device has a sensor, it's enrolled, the user turned biometric on. */
function deviceWithBiometricEnabled() {
  auth.hasHardwareAsync.mockResolvedValue(true);
  auth.isEnrolledAsync.mockResolvedValue(true);
  (getBiometricEnabled as jest.Mock).mockResolvedValue(true);
}

/** Secure storage holds a previous session. */
function withStoredSession() {
  (hasValidTokens as jest.Mock).mockResolvedValue(true);
  (getUser as jest.Mock).mockResolvedValue(CACHED_USER);
}

/** Secure storage is empty — e.g. after a logout. */
function withoutStoredSession() {
  (hasValidTokens as jest.Mock).mockResolvedValue(false);
  (getUser as jest.Mock).mockResolvedValue(null);
}

beforeEach(() => {
  jest.clearAllMocks();
  (authApi.getProfile as jest.Mock).mockResolvedValue(PROFILE);
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    user: null,
    biometricEnabled: false,
    biometricAvailable: false,
    hasStoredSession: false,
    biometricPromptedAtLaunch: false,
    requires2fa: false,
    partialToken: null,
    needsOnboarding: false,
  });
});

describe('TC-MOB-003 biometric grants access on launch', () => {
  it('prompts on launch and restores the session on a successful scan', async () => {
    deviceWithBiometricEnabled();
    withStoredSession();
    auth.authenticateAsync.mockResolvedValue({ success: true } as any);

    await useAuthStore.getState().initialize();

    expect(auth.authenticateAsync).toHaveBeenCalledTimes(1);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toMatchObject({ id: 'u1', email: 'user@example.com' });
    expect(state.hasStoredSession).toBe(true);
  });

  it('does not prompt when there is no stored session to unlock', async () => {
    deviceWithBiometricEnabled();
    withoutStoredSession();

    await useAuthStore.getState().initialize();

    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    expect(useAuthStore.getState().hasStoredSession).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('falls back to password when the sensor is no longer enrolled', async () => {
    (getBiometricEnabled as jest.Mock).mockResolvedValue(true);
    auth.hasHardwareAsync.mockResolvedValue(true);
    auth.isEnrolledAsync.mockResolvedValue(false); // unenrolled since enabling
    withStoredSession();

    await useAuthStore.getState().initialize();

    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false); // gate NOT bypassed
  });

  it('logout clears the unlockable session so biometric is not offered', async () => {
    useAuthStore.setState({ hasStoredSession: true, isAuthenticated: true, biometricEnabled: true });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(clearTokens).toHaveBeenCalled();
    expect(state.hasStoredSession).toBe(false);
    expect(state.biometricEnabled).toBe(true); // preference survives, re-arms on next login
  });

  it('reports no-session when a scan passes but storage is empty', async () => {
    useAuthStore.setState({
      biometricEnabled: true,
      biometricAvailable: true,
      hasStoredSession: true,
    });
    withoutStoredSession();
    auth.authenticateAsync.mockResolvedValue({ success: true } as any);

    const outcome = await useAuthStore.getState().unlockWithBiometric();

    expect(outcome).toBe('no-session');
    expect(useAuthStore.getState().hasStoredSession).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('TC-MOB-004 cancelling falls back to password', () => {
  it('marks the launch prompt as spent so the login screen will not re-prompt', async () => {
    deviceWithBiometricEnabled();
    withStoredSession();
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' } as any);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.biometricPromptedAtLaunch).toBe(true);
    expect(state.isAuthenticated).toBe(false);
    // Tokens are kept, so a retry via "Use Biometrics" still works.
    expect(clearTokens).not.toHaveBeenCalled();
    expect(state.hasStoredSession).toBe(true);
  });

  it.each([
    ['user_cancel', 'cancelled'],
    ['app_cancel', 'cancelled'],
    ['system_cancel', 'cancelled'],
    ['user_fallback', 'cancelled'],
    ['authentication_failed', 'failed'],
    ['lockout', 'failed'],
  ])('reports %s as %s', async (error, expected) => {
    useAuthStore.setState({ biometricEnabled: true, biometricAvailable: true });
    auth.authenticateAsync.mockResolvedValue({ success: false, error } as any);

    await expect(useAuthStore.getState().authenticateWithBiometric()).resolves.toBe(expected);
  });

  it('propagates the cancel reason through unlockWithBiometric', async () => {
    useAuthStore.setState({
      biometricEnabled: true,
      biometricAvailable: true,
      hasStoredSession: true,
    });
    withStoredSession();
    auth.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' } as any);

    const outcome = await useAuthStore.getState().unlockWithBiometric();

    expect(outcome).toBe('cancelled');
    // A cancel must not destroy the session — the user can retry.
    expect(useAuthStore.getState().hasStoredSession).toBe(true);
  });

  it('retrying after a cancel succeeds', async () => {
    useAuthStore.setState({
      biometricEnabled: true,
      biometricAvailable: true,
      hasStoredSession: true,
    });
    withStoredSession();
    auth.authenticateAsync
      .mockResolvedValueOnce({ success: false, error: 'user_cancel' } as any)
      .mockResolvedValueOnce({ success: true } as any);

    expect(await useAuthStore.getState().unlockWithBiometric()).toBe('cancelled');
    expect(await useAuthStore.getState().unlockWithBiometric()).toBe('success');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('treats a thrown prompt as a failure, not a crash', async () => {
    useAuthStore.setState({ biometricEnabled: true, biometricAvailable: true });
    auth.authenticateAsync.mockRejectedValue(new Error('sensor exploded'));

    await expect(useAuthStore.getState().authenticateWithBiometric()).resolves.toBe('failed');
  });

  it('reports unavailable when biometric is switched off', async () => {
    useAuthStore.setState({ biometricEnabled: false, biometricAvailable: true });

    await expect(useAuthStore.getState().authenticateWithBiometric()).resolves.toBe('unavailable');
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });
});

describe('TC-MOB-007 abandoning a pending 2FA sign-in', () => {
  it('clears the 2FA state so the login screen does not bounce the user back', () => {
    useAuthStore.setState({ requires2fa: true, partialToken: 'partial-abc', isLoading: true });

    useAuthStore.getState().cancel2fa();

    const state = useAuthStore.getState();
    expect(state.requires2fa).toBe(false);
    expect(state.partialToken).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('leaves an authenticated session untouched', () => {
    useAuthStore.setState({ requires2fa: true, partialToken: 'p', isAuthenticated: true });

    useAuthStore.getState().cancel2fa();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
