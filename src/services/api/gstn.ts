/**
 * GSTN Portal Integration API Service
 */
import { apiClient } from './client';
import type {
  GstnConnectionListResponse,
  GstnConnectionStatusResponse,
  GstnConnectInitiateResponse,
  GstnVerifyOtpResponse,
  GstnSyncTriggerResponse,
  GstnSyncHistoryResponse,
  GstnUpdateSettingsRequest,
  GstnSettingsResponse,
} from '../../types';

const BASE_URL = '/api/v1/gstn';

// Timeout configurations (in milliseconds)
const TIMEOUTS = {
  DEFAULT: 30000,      // 30 seconds for most operations
  SYNC: 120000,        // 2 minutes for sync operations (can take time)
  OTP: 60000,          // 1 minute for OTP operations
};

/**
 * Validate GSTIN format (15 alphanumeric characters)
 * Format: 2 state code + 10 PAN + 1 entity + 1 Z + 1 checksum
 */
export function isValidGstinFormat(gstin: string): boolean {
  if (!gstin || typeof gstin !== 'string') return false;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
  return gstinRegex.test(gstin.toUpperCase());
}

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
 * Get all GSTN connections for the organization
 */
export async function getConnections(): Promise<GstnConnectionListResponse> {
  const response = await apiClient.get<{ data: GstnConnectionListResponse }>(
    `${BASE_URL}/connections`,
    { timeout: TIMEOUTS.DEFAULT }
  );
  return validateResponse<GstnConnectionListResponse>(response, ['connections', 'total']);
}

/**
 * Get connection status for a specific GSTIN
 */
export async function getConnectionStatus(
  gstinId: string
): Promise<GstnConnectionStatusResponse> {
  if (!gstinId) {
    throw new Error('GSTIN ID is required');
  }
  const response = await apiClient.get<{ data: GstnConnectionStatusResponse }>(
    `${BASE_URL}/connections/${gstinId}`,
    { timeout: TIMEOUTS.DEFAULT }
  );
  return validateResponse<GstnConnectionStatusResponse>(response, ['status', 'isConnected']);
}

/**
 * Initiate GSTN connection (triggers OTP)
 */
export async function initiateConnection(
  gstinId: string
): Promise<GstnConnectInitiateResponse> {
  if (!gstinId) {
    throw new Error('GSTIN ID is required');
  }
  const response = await apiClient.post<{ data: GstnConnectInitiateResponse }>(
    `${BASE_URL}/connections/${gstinId}/connect`,
    {},
    { timeout: TIMEOUTS.OTP }
  );
  return validateResponse<GstnConnectInitiateResponse>(response, ['success']);
}

/**
 * Verify OTP and complete connection
 */
export async function verifyOtp(
  gstinId: string,
  otp: string
): Promise<GstnVerifyOtpResponse> {
  if (!gstinId) {
    throw new Error('GSTIN ID is required');
  }
  if (!otp || otp.length !== 6) {
    throw new Error('Valid 6-digit OTP is required');
  }
  const response = await apiClient.post<{ data: GstnVerifyOtpResponse }>(
    `${BASE_URL}/connections/${gstinId}/verify-otp`,
    { otp },
    { timeout: TIMEOUTS.OTP }
  );
  return validateResponse<GstnVerifyOtpResponse>(response, ['success']);
}

/**
 * Resend OTP
 */
export async function resendOtp(
  gstinId: string
): Promise<GstnConnectInitiateResponse> {
  if (!gstinId) {
    throw new Error('GSTIN ID is required');
  }
  const response = await apiClient.post<{ data: GstnConnectInitiateResponse }>(
    `${BASE_URL}/connections/${gstinId}/resend-otp`,
    {},
    { timeout: TIMEOUTS.OTP }
  );
  return validateResponse<GstnConnectInitiateResponse>(response, ['success']);
}

/**
 * Disconnect from GSTN portal
 */
export async function disconnect(
  gstinId: string,
  reason?: string
): Promise<void> {
  if (!gstinId) {
    throw new Error('GSTIN ID is required');
  }
  await apiClient.post(
    `${BASE_URL}/connections/${gstinId}/disconnect`,
    { reason },
    { timeout: TIMEOUTS.DEFAULT }
  );
}

/**
 * Trigger manual sync
 */
export async function triggerSync(
  gstinId: string
): Promise<GstnSyncTriggerResponse> {
  if (!gstinId) {
    throw new Error('GSTIN ID is required');
  }
  const response = await apiClient.post<{ data: GstnSyncTriggerResponse }>(
    `${BASE_URL}/connections/${gstinId}/sync`,
    {},
    { timeout: TIMEOUTS.SYNC }
  );
  return validateResponse<GstnSyncTriggerResponse>(response, ['success', 'noticesFound', 'noticesImported']);
}

/**
 * Get sync history for a connection
 */
export async function getSyncHistory(
  gstinId: string,
  limit: number = 20
): Promise<GstnSyncHistoryResponse> {
  if (!gstinId) {
    throw new Error('GSTIN ID is required');
  }
  const response = await apiClient.get<{ data: GstnSyncHistoryResponse }>(
    `${BASE_URL}/connections/${gstinId}/sync-logs`,
    { params: { limit }, timeout: TIMEOUTS.DEFAULT }
  );
  return validateResponse<GstnSyncHistoryResponse>(response, ['logs', 'total']);
}

/**
 * Update connection settings
 */
export async function updateSettings(
  gstinId: string,
  settings: GstnUpdateSettingsRequest
): Promise<GstnSettingsResponse> {
  if (!gstinId) {
    throw new Error('GSTIN ID is required');
  }
  const response = await apiClient.patch<{ data: GstnSettingsResponse }>(
    `${BASE_URL}/connections/${gstinId}/settings`,
    settings,
    { timeout: TIMEOUTS.DEFAULT }
  );
  return validateResponse<GstnSettingsResponse>(response, ['autoSyncEnabled', 'syncIntervalHours']);
}
