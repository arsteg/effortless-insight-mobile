import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Import after mocks
import { useAuthStore } from '@/stores/auth-store';

describe('AuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  describe('setUser', () => {
    it('should set user and mark as authenticated', () => {
      const { result } = renderHook(() => useAuthStore());
      const testUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
      };

      act(() => {
        result.current.setUser(testUser);
      });

      expect(result.current.user).toEqual(testUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('should clear user and mark as not authenticated', async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial user
      act(() => {
        result.current.setUser({
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
        });
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('isLoading', () => {
    it('should track loading state', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
