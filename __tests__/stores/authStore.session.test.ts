/**
 * Session expiry handling — TC-MOB-009.
 */
import { useAuthStore } from '../../src/stores/authStore';
import { useUIStore } from '../../src/stores/uiStore';
import { authApi } from '../../src/services/api';
import { setOnAuthFailure } from '../../src/services/api/client';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  cancelAuthenticate: jest.fn(),
}));
jest.mock('../../src/services/storage/secure', () => ({
  setTokens: jest.fn(), clearTokens: jest.fn(), setUser: jest.fn(), getUser: jest.fn(),
  clearUser: jest.fn(), hasValidTokens: jest.fn(), getBiometricEnabled: jest.fn(),
  setBiometricEnabled: jest.fn(), getAccessToken: jest.fn(), getRefreshToken: jest.fn(),
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

/**
 * The store registers this with the API client at import time. Capture it in
 * beforeAll — the beforeEach `clearAllMocks` erases the recorded call.
 */
let onAuthFailure: () => void;
beforeAll(() => {
  onAuthFailure = (setOnAuthFailure as jest.Mock).mock.calls[0][0] as () => void;
});
const authFailureHandler = () => onAuthFailure;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    isAuthenticated: true, user: { id: 'u1' } as any, hasStoredSession: true,
    sessionNotice: null, requires2fa: false, partialToken: null, needsOnboarding: false,
  });
  useUIStore.setState({ isOnline: true });
});

describe('when the refresh token is rejected', () => {
  it('signs the user out and explains why', () => {
    authFailureHandler()();

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
    expect(s.sessionNotice).toBe('Session expired. Please sign in again.');
  });

  it('stops offering a biometric unlock that cannot succeed', () => {
    authFailureHandler()();
    // The interceptor already cleared the tokens — prompting for a scan here
    // would succeed and then strand the user.
    expect(useAuthStore.getState().hasStoredSession).toBe(false);
  });

  it('clears the notice once shown, so it cannot reappear', () => {
    authFailureHandler()();
    useAuthStore.getState().clearSessionNotice();
    expect(useAuthStore.getState().sessionNotice).toBeNull();
  });
});

describe('checkSession on returning to the foreground', () => {
  it('revalidates against the server when signed in and online', async () => {
    (authApi.getProfile as jest.Mock).mockResolvedValue({
      id: 'u1', email: 'a@b.c', name: 'A', role: 'owner',
      organization: { id: 'o1', name: 'Org' }, organizations: [],
    });

    await useAuthStore.getState().checkSession();

    expect(authApi.getProfile).toHaveBeenCalled();
  });

  it('does nothing while offline — offline is not expiry', async () => {
    useUIStore.setState({ isOnline: false });

    await useAuthStore.getState().checkSession();

    expect(authApi.getProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('does nothing when already signed out', async () => {
    useAuthStore.setState({ isAuthenticated: false });

    await useAuthStore.getState().checkSession();

    expect(authApi.getProfile).not.toHaveBeenCalled();
  });

  it('keeps the session on a network failure', async () => {
    (authApi.getProfile as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(useAuthStore.getState().checkSession()).resolves.toBeUndefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
