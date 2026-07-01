/**
 * GSTN Portal Integration Types
 */

// Connection status constants
export const GstnConnectionStatus = {
  Disconnected: 'disconnected',
  PendingOtp: 'pending_otp',
  Connected: 'connected',
  TokenExpired: 'token_expired',
  Suspended: 'suspended',
  Revoked: 'revoked',
} as const;

export type GstnConnectionStatusType = typeof GstnConnectionStatus[keyof typeof GstnConnectionStatus];

// Connection DTO
export interface GstnConnection {
  id: string;
  organizationGstinId: string;
  gstin: string;
  tradeName?: string;
  status: GstnConnectionStatusType;
  isConnected: boolean;
  gspProvider: string;
  connectedAt?: string;
  lastSyncAt?: string;
  nextScheduledSyncAt?: string;
  autoSyncEnabled: boolean;
  syncIntervalHours: number;
  consecutiveFailures: number;
  lastSyncError?: string;
  connectedByName?: string;
}

// Connection list response
export interface GstnConnectionListResponse {
  connections: GstnConnection[];
  total: number;
}

// Connection status response
export interface GstnConnectionStatusResponse {
  organizationGstinId: string;
  gstin: string;
  status: GstnConnectionStatusType;
  isConnected: boolean;
  connectedAt?: string;
  lastSyncAt?: string;
  nextScheduledSyncAt?: string;
  autoSyncEnabled: boolean;
  syncIntervalHours: number;
  consecutiveFailures: number;
  lastSyncError?: string;
  connectedByName?: string;
}

// OTP initiation response
export interface GstnConnectInitiateResponse {
  success: boolean;
  otpDestination?: string;
  otpDestinationType?: string;
  expiresAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

// OTP verification response
export interface GstnVerifyOtpResponse {
  success: boolean;
  connection?: GstnConnectionStatusResponse;
  errorCode?: string;
  errorMessage?: string;
  remainingAttempts?: number;
}

// Sync trigger response
export interface GstnSyncTriggerResponse {
  success: boolean;
  syncLogId?: string;
  noticesFound: number;
  noticesImported: number;
  noticesSkipped: number;
  noticesFailed: number;
  errorCode?: string;
  errorMessage?: string;
}

// Sync log entry
export interface GstnSyncLogEntry {
  id: string;
  syncType: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  noticesFound: number;
  noticesImported: number;
  noticesSkipped: number;
  noticesFailed: number;
  errorMessage?: string;
  triggeredByName?: string;
}

// Sync history response
export interface GstnSyncHistoryResponse {
  logs: GstnSyncLogEntry[];
  total: number;
}

// Settings update request
export interface GstnUpdateSettingsRequest {
  autoSyncEnabled?: boolean;
  syncIntervalHours?: number;
}

// Settings response
export interface GstnSettingsResponse {
  autoSyncEnabled: boolean;
  syncIntervalHours: number;
  nextScheduledSyncAt?: string;
}

// Helper functions
export function getStatusLabel(status: GstnConnectionStatusType): string {
  switch (status) {
    case GstnConnectionStatus.Connected:
      return 'Connected';
    case GstnConnectionStatus.Disconnected:
      return 'Not Connected';
    case GstnConnectionStatus.PendingOtp:
      return 'Awaiting OTP';
    case GstnConnectionStatus.TokenExpired:
      return 'Session Expired';
    case GstnConnectionStatus.Suspended:
      return 'Suspended';
    case GstnConnectionStatus.Revoked:
      return 'Access Revoked';
    default:
      return status;
  }
}

export function canConnect(status: GstnConnectionStatusType): boolean {
  const connectableStatuses: GstnConnectionStatusType[] = [
    GstnConnectionStatus.Disconnected,
    GstnConnectionStatus.TokenExpired,
    GstnConnectionStatus.Revoked,
  ];
  return connectableStatuses.includes(status);
}

export function canSync(status: GstnConnectionStatusType): boolean {
  return status === GstnConnectionStatus.Connected;
}
