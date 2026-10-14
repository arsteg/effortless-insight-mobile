/**
 * Email Sync Integration API Service
 */
import { apiClient } from './client';
import type {
  EmailAccountListResponse,
  EmailAccount,
  EmailConnectInitiateResponse,
  EmailConnectCallbackRequest,
  EmailConnectCallbackResponse,
  EmailSyncTriggerResponse,
  EmailSyncHistoryResponse,
  EmailAccountSettingsRequest,
  EmailAccountSettingsResponse,
} from '../../types/emailSync';

const BASE_URL = '/email-sync';

// Timeout configurations (in milliseconds)
const TIMEOUTS = {
  DEFAULT: 30000,      // 30 seconds for most operations
  SYNC: 180000,        // 3 minutes for sync operations
  OAUTH: 60000,        // 1 minute for OAuth operations
};

/**
 * Validate API response has expected structure
 */
function validateResponse<T>(response: any, requiredFields: string[]): T {
  if (!response?.data?.data) {
    throw new Error('Invalid API response structure');
  }
  const data = response.data.data;
  for (const field of requiredFields) {
    if (!(field in data)) {
      console.warn(`Missing expected field in response: ${field}`);
    }
  }
  return data as T;
}

/**
 * Get all connected email accounts for the organization
 */
export async function getAccounts(): Promise<EmailAccountListResponse> {
  const response = await apiClient.get<{ data: EmailAccountListResponse }>(
    `${BASE_URL}/accounts`,
    { timeout: TIMEOUTS.DEFAULT }
  );
  return validateResponse<EmailAccountListResponse>(response, ['accounts', 'total']);
}

/**
 * Get a specific email account
 */
export async function getAccount(accountId: string): Promise<EmailAccount> {
  if (!accountId) {
    throw new Error('Account ID is required');
  }
  const response = await apiClient.get<{ data: EmailAccount }>(
    `${BASE_URL}/accounts/${accountId}`,
    { timeout: TIMEOUTS.DEFAULT }
  );
  return validateResponse<EmailAccount>(response, ['id', 'provider', 'email', 'status']);
}

/**
 * Initiate OAuth connection for an email provider
 */
export async function initiateConnection(
  provider: string,
  redirectUri?: string
): Promise<EmailConnectInitiateResponse> {
  if (!provider) {
    throw new Error('Provider is required');
  }
  const params = redirectUri ? { redirectUri } : {};
  const response = await apiClient.post<{ data: EmailConnectInitiateResponse }>(
    `${BASE_URL}/connect/${provider}`,
    {},
    { params, timeout: TIMEOUTS.OAUTH }
  );
  return validateResponse<EmailConnectInitiateResponse>(response, ['success']);
}

/**
 * Complete OAuth connection
 */
export async function completeConnection(
  provider: string,
  request: EmailConnectCallbackRequest,
  redirectUri?: string
): Promise<EmailConnectCallbackResponse> {
  if (!provider) {
    throw new Error('Provider is required');
  }
  if (!request.code || !request.state) {
    throw new Error('Code and state are required');
  }
  const params = redirectUri ? { redirectUri } : {};
  const response = await apiClient.post<{ data: EmailConnectCallbackResponse }>(
    `${BASE_URL}/callback/${provider}`,
    request,
    { params, timeout: TIMEOUTS.OAUTH }
  );
  return validateResponse<EmailConnectCallbackResponse>(response, ['success']);
}

/**
 * Disconnect an email account
 */
export async function disconnectAccount(accountId: string): Promise<void> {
  if (!accountId) {
    throw new Error('Account ID is required');
  }
  await apiClient.delete(
    `${BASE_URL}/accounts/${accountId}`,
    { timeout: TIMEOUTS.DEFAULT }
  );
}

/**
 * Trigger manual sync for an email account
 */
export async function triggerSync(accountId: string): Promise<EmailSyncTriggerResponse> {
  if (!accountId) {
    throw new Error('Account ID is required');
  }
  const response = await apiClient.post<{ data: EmailSyncTriggerResponse }>(
    `${BASE_URL}/accounts/${accountId}/sync`,
    {},
    { timeout: TIMEOUTS.SYNC }
  );
  return validateResponse<EmailSyncTriggerResponse>(response, ['success', 'emailsScanned', 'noticesImported']);
}

/**
 * Get sync history for an email account
 */
export async function getSyncHistory(
  accountId: string,
  limit: number = 20
): Promise<EmailSyncHistoryResponse> {
  if (!accountId) {
    throw new Error('Account ID is required');
  }
  const response = await apiClient.get<{ data: EmailSyncHistoryResponse }>(
    `${BASE_URL}/accounts/${accountId}/history`,
    { params: { limit }, timeout: TIMEOUTS.DEFAULT }
  );
  return validateResponse<EmailSyncHistoryResponse>(response, ['logs', 'total']);
}

/**
 * Update account settings
 */
export async function updateSettings(
  accountId: string,
  settings: EmailAccountSettingsRequest
): Promise<EmailAccountSettingsResponse> {
  if (!accountId) {
    throw new Error('Account ID is required');
  }
  const response = await apiClient.patch<{ data: EmailAccountSettingsResponse }>(
    `${BASE_URL}/accounts/${accountId}/settings`,
    settings,
    { timeout: TIMEOUTS.DEFAULT }
  );
  return validateResponse<EmailAccountSettingsResponse>(response, ['autoSyncEnabled']);
}
