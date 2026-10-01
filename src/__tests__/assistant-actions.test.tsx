/**
 * Component tests for the assistant's action UI: navigate buttons and
 * confirmation cards (which must never execute without an explicit tap).
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('../services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  getApiErrorMessage: jest.fn(() => 'This feature is not available on your plan'),
}));

jest.mock('expo-audio', () => ({
  AudioModule: { requestRecordingPermissionsAsync: jest.fn() },
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: jest.fn(),
  useAudioRecorder: () => ({ prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn(), uri: null }),
}));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

import { router } from 'expo-router';
import { apiClient } from '../services/api/client';
import { ConfirmCard, NavigateButton, createStyles } from '../../app/assistant';
import type { AssistantConfirmAction, AssistantNavigateAction } from '../types/assistant';

const COLORS = {
  primary: '#0ea5e9',
  white: '#ffffff',
  lavender: '#8b5cf6',
  lavenderLight: '#ede9fe',
  coral: '#ef4444',
  coralLight: '#fee2e2',
  mint: '#10b981',
  mintLight: '#d1fae5',
  gray: {
    50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
    500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b',
  },
};
const styles = createStyles(COLORS);

const postMock = apiClient.post as jest.Mock;

const confirmAction: AssistantConfirmAction = {
  type: 'confirm_action',
  kind: 'create_task',
  summary: "Create task 'Reply to DRC-01'",
  method: 'POST',
  path: '/api/v1/tasks',
  body: { title: 'Reply to DRC-01' },
};

describe('NavigateButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pushes the mobile route on tap', async () => {
    const action: AssistantNavigateAction = {
      type: 'navigate',
      intent: 'notices_list',
      label: 'Notices',
      mobileRoute: '/(tabs)/notices',
    };
    const { getByText } = await render(
      <NavigateButton action={action} styles={styles} COLORS={COLORS} />
    );
    fireEvent.press(getByText('Notices'));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/notices');
  });

  it('shows the web-only note when there is no mobile route', async () => {
    const action: AssistantNavigateAction = {
      type: 'navigate',
      intent: 'gst_sync',
      label: 'GST portal sync',
      mobileRoute: null,
      webOnlyNote: 'GST portal sync is set up on the web app.',
    };
    const { getByText } = await render(
      <NavigateButton action={action} styles={styles} COLORS={COLORS} />
    );
    expect(getByText(/set up on the web app/i)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('ConfirmCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('never executes without an explicit Confirm tap', async () => {
    const { getByText } = await render(
      <ConfirmCard action={confirmAction} styles={styles} COLORS={COLORS} />
    );
    expect(getByText(/needs your confirmation/i)).toBeTruthy();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('executes the whitelisted call with /api/v1 stripped on Confirm', async () => {
    postMock.mockResolvedValueOnce({ data: {} });
    const { getByTestId, findByText } = await render(
      <ConfirmCard action={confirmAction} styles={styles} COLORS={COLORS} />
    );

    fireEvent.press(getByTestId('assistant-confirm'));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/tasks', { title: 'Reply to DRC-01' })
    );
    expect(await findByText('Done')).toBeTruthy();
  });

  it('Not now dismisses without executing', async () => {
    const { getByText, queryByText } = await render(
      <ConfirmCard action={confirmAction} styles={styles} COLORS={COLORS} />
    );
    fireEvent.press(getByText('Not now'));
    await waitFor(() => expect(queryByText(/needs your confirmation/i)).toBeNull());
    expect(postMock).not.toHaveBeenCalled();
  });

  it('shows the API error message on failure', async () => {
    postMock.mockRejectedValueOnce(new Error('402'));
    const { getByTestId, findByText } = await render(
      <ConfirmCard action={confirmAction} styles={styles} COLORS={COLORS} />
    );

    fireEvent.press(getByTestId('assistant-confirm'));

    expect(await findByText(/not available on your plan/i)).toBeTruthy();
  });
});
