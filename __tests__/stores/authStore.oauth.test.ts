/**
 * OAuth sign-in completion — TC-MOB-005.
 *
 * The live mobile path returns tokens on the deep link with no user attached,
 * so the store must fetch and MAP the profile itself.
 */
import { useAuthStore } from '../../src/stores/authStore';
import { setTokens, setUser, clearTokens, clearUser } from '../../src/services/storage/secure';
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
  authApi: { getProfile: jest.fn() },
  organizationsApi: { createOrganization: jest.fn() },
}));

jest.mock('../../src/services/api/client', () => ({
  isApiError: () => false,
  setOnAuthFailure: jest.fn(),
}));

jest.mock('../../src/services/pushNotifications', () => ({
  unregisterPushToken: jest.fn().mockResolvedValue(undefined),
}));

/** Exactly what /auth/me returns — note the organizationId/organizationName keys. */
const GOOGLE_PROFILE = {
  id: 'u1',
  email: 'user@gmail.com',
  name: 'Google User',
  mobile: undefined,
  avatarUrl: 'https://lh3.googleusercontent.com/a/photo',
  role: 'owner',
  emailVerified: true,
  mobileVerified: false,
  is2faEnabled: false,
  organization: { id: 'o1', name: 'Acme' },
  organizations: [{ organizationId: 'o1', organizationName: 'Acme', role: 'owner' }],
  createdAt: '2026-01-01T00:00:00Z',
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    hasStoredSession: false,
    needsOnboarding: false,
    requires2fa: false,
    partialToken: null,
  });
});

describe('TC-MOB-005 Google OAuth completion', () => {
  it('fetches and MAPS the profile when the callback carries only tokens', async () => {
    (authApi.getProfile as jest.Mock).mockResolvedValue(GOOGLE_PROFILE);

    await useAuthStore.getState().completeOAuthLogin({
      accessToken: 'at',
      refreshToken: 'rt',
    });

    expect(setTokens).toHaveBeenCalledWith('at', 'rt');
    const { user, isAuthenticated } = useAuthStore.getState();
    expect(isAuthenticated).toBe(true);
    // Profile populated from Google (expected result 4).
    expect(user).toMatchObject({
      email: 'user@gmail.com',
      name: 'Google User',
      avatarUrl: 'https://lh3.googleusercontent.com/a/photo',
    });
    // The bug this fixes: organizations were stored in the API's shape.
    expect(user?.organizations).toEqual([{ id: 'o1', name: 'Acme', role: 'owner' }]);
    expect(user?.organization).toMatchObject({ id: 'o1', name: 'Acme', role: 'owner' });
    // The mis-shaped raw profile must never reach storage.
    expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ organizations: [{ id: 'o1', name: 'Acme', role: 'owner' }] }));
  });

  it('arms biometric unlock, like a password login', async () => {
    (authApi.getProfile as jest.Mock).mockResolvedValue(GOOGLE_PROFILE);

    await useAuthStore.getState().completeOAuthLogin({ accessToken: 'at', refreshToken: 'rt' });

    expect(useAuthStore.getState().hasStoredSession).toBe(true);
  });

  it('uses a user supplied by the code-exchange path without refetching', async () => {
    const mapped = {
      id: 'u1',
      email: 'user@gmail.com',
      name: 'Google User',
      role: 'owner',
      organization: { id: 'o1', name: 'Acme', role: 'owner' },
      organizations: [{ id: 'o1', name: 'Acme', role: 'owner' }],
    } as any;

    await useAuthStore.getState().completeOAuthLogin({
      accessToken: 'at',
      refreshToken: 'rt',
      user: mapped,
    });

    expect(authApi.getProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(mapped);
  });

  it('flags onboarding when Google account has no organization', async () => {
    (authApi.getProfile as jest.Mock).mockResolvedValue({
      ...GOOGLE_PROFILE,
      organization: undefined,
      organizations: [],
    });

    await useAuthStore.getState().completeOAuthLogin({ accessToken: 'at', refreshToken: 'rt' });

    expect(useAuthStore.getState().needsOnboarding).toBe(true);
  });

  it('does not strand tokens when the profile fetch fails', async () => {
    (authApi.getProfile as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(
      useAuthStore.getState().completeOAuthLogin({ accessToken: 'at', refreshToken: 'rt' })
    ).rejects.toThrow('network down');

    // Without this the next launch would silently auto-login after an error.
    expect(clearTokens).toHaveBeenCalled();
    expect(clearUser).toHaveBeenCalled();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.hasStoredSession).toBe(false);
    expect(state.isLoading).toBe(false);
  });
});
