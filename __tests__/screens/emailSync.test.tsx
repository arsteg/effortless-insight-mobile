import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import EmailSyncScreen from '../../app/settings/email-sync';

const mockInitiate = jest.fn();
const mockRefetch = jest.fn();
const mockSetParams = jest.fn();
const mockPush = jest.fn();
let mockResult: string | undefined;
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, setParams: mockSetParams }),
  useLocalSearchParams: () => ({ email_sync: mockResult }),
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('../../src/hooks', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../src/hooks/useEmailSync', () => ({
  useEmailAccounts: () => ({ data: { accounts: [] }, refetch: mockRefetch, isLoading: false }),
  useInitiateEmailConnection: () => ({ mutateAsync: mockInitiate, isPending: false }),
  useTriggerEmailSync: () => ({ mutate: jest.fn() }), useDisconnectEmail: () => ({ mutate: jest.fn() }),
}));
jest.mock('../../src/theme/useTheme', () => {
  const palette = require('../../src/theme/palettes').LIGHT_PALETTE;
  return { useColors: () => palette, useThemedStyles: (factory: Function) => factory(palette) };
});

jest.setTimeout(30000);

beforeEach(() => { jest.clearAllMocks(); mockResult = undefined; jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });

test('opens the backend authorization URL and handles a safe app return', async () => {
  mockInitiate.mockResolvedValue({ success: true, authorizationUrl: 'https://accounts.example.test/authorize' });
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'success', url: 'effortlessinsight://settings/email-sync?email_sync=connected' });
  await render(<EmailSyncScreen />);
  await fireEvent.press(screen.getByText('Gmail'));
  await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('https://accounts.example.test/authorize', 'effortlessinsight://settings/email-sync'));
  expect(mockInitiate).toHaveBeenCalledWith({ provider: 'gmail', redirectUri: 'effortlessinsight://settings/email-sync' });
  expect(mockRefetch).toHaveBeenCalled();
});

test('cold-start denial shows guidance and clears the callback result', async () => {
  mockResult = 'access_denied';
  await render(<EmailSyncScreen />);
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Connection not completed', expect.any(String)));
  expect(mockSetParams).toHaveBeenCalledWith({ email_sync: undefined });
  expect(mockInitiate).not.toHaveBeenCalled();
});

test('invalid client secret explains how to fix Microsoft credentials', async () => {
  mockResult = 'client_secret_invalid';
  await render(<EmailSyncScreen />);
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Connection not completed',
    expect.stringContaining('secret Value, not the Secret ID')));
});
