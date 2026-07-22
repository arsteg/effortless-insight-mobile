/**
 * Jest setup — mocks for native/Expo modules that don't run under jsdom.
 */

// AsyncStorage: use the official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
}));

// expo-constants — provide a stable extra.apiUrl for tests.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://api.test.local' } } },
}));
