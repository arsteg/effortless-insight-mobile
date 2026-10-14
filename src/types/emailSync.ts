/**
 * Email Sync Integration Types
 */

// Account status constants
export const EmailAccountStatus = {
  Connected: 'connected',
  ReauthenticationRequired: 'reauthentication_required',
  SyncFailed: 'sync_failed',
  Suspended: 'suspended',
  Disconnected: 'disconnected',
} as const;

export type EmailAccountStatusType = typeof EmailAccountStatus[keyof typeof EmailAccountStatus];

// Provider constants
export const EmailProvider = {
  Gmail: 'gmail',
  Outlook: 'outlook',
} as const;

export type EmailProviderType = typeof EmailProvider[keyof typeof EmailProvider];

// Sync result
export interface EmailSyncResult {
  status?: string;
  errorCode?: string;
  emailsScanned: number;
  noticesImported: number;
  attachmentsSkipped: number;
  duplicatesSkipped: number;
  failedToProcess: number;
}

// Email account DTO
export interface EmailAccount {
  id: string;
  provider: EmailProviderType;
  email: string;
  displayName?: string;
  status: EmailAccountStatusType;
  isConnected: boolean;
  autoSyncEnabled: boolean;
  lastSyncAt?: string;
  lastSyncError?: string;
  lastSyncResult?: EmailSyncResult;
  connectedAt: string;
}

// Account list response
export interface EmailAccountListResponse {
  accounts: EmailAccount[];
  total: number;
}

// OAuth initiate response
export interface EmailConnectInitiateResponse {
  success: boolean;
  authorizationUrl?: string;
  state?: string;
  errorCode?: string;
  errorMessage?: string;
}

// OAuth callback request
export interface EmailConnectCallbackRequest {
  code: string;
  state: string;
}

// OAuth callback response
export interface EmailConnectCallbackResponse {
  success: boolean;
  account?: EmailAccount;
  errorCode?: string;
  errorMessage?: string;
}

// Sync trigger response
export interface EmailSyncTriggerResponse {
  success: boolean;
  syncLogId?: string;
  emailsScanned: number;
  noticesImported: number;
  attachmentsSkipped: number;
  duplicatesSkipped: number;
  noticesFailed: number;
  errorCode?: string;
  errorMessage?: string;
}

// Sync log entry
export interface EmailSyncLogEntry {
  importedNoticeIds?: string[];
  id: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  emailsScanned: number;
  noticesImported: number;
  attachmentsSkipped: number;
  duplicatesSkipped: number;
  noticesFailed: number;
  aiDetectionUsed: number;
  errorMessage?: string;
  triggeredByName?: string;
}

// Sync history response
export interface EmailSyncHistoryResponse {
  logs: EmailSyncLogEntry[];
  total: number;
}

// Settings request
export interface EmailAccountSettingsRequest {
  autoSyncEnabled?: boolean;
}

// Settings response
export interface EmailAccountSettingsResponse {
  autoSyncEnabled: boolean;
}

// Helper functions
export function getStatusLabel(status: EmailAccountStatusType): string {
  switch (status) {
    case EmailAccountStatus.Connected:
      return 'Connected';
    case EmailAccountStatus.ReauthenticationRequired:
      return 'Reconnect Needed';
    case EmailAccountStatus.SyncFailed:
      return 'Sync Failed';
    case EmailAccountStatus.Suspended:
      return 'Paused';
    case EmailAccountStatus.Disconnected:
      return 'Disconnected';
    default:
      return status;
  }
}

export function getProviderLabel(provider: EmailProviderType): string {
  switch (provider) {
    case EmailProvider.Gmail:
      return 'Gmail';
    case EmailProvider.Outlook:
      return 'Microsoft Outlook';
    default:
      return provider;
  }
}

export function canSync(status: EmailAccountStatusType): boolean {
  return status === EmailAccountStatus.Connected || status === EmailAccountStatus.SyncFailed;
}

export function needsReconnect(status: EmailAccountStatusType): boolean {
  return status === EmailAccountStatus.ReauthenticationRequired;
}

export function getStatusColor(status: EmailAccountStatusType): { bg: string; text: string } {
  switch (status) {
    case EmailAccountStatus.Connected:
      return { bg: '#dcfce7', text: '#16a34a' }; // green
    case EmailAccountStatus.ReauthenticationRequired:
      return { bg: '#fef3c7', text: '#d97706' }; // yellow
    case EmailAccountStatus.SyncFailed:
      return { bg: '#fee2e2', text: '#dc2626' }; // red
    case EmailAccountStatus.Suspended:
    case EmailAccountStatus.Disconnected:
      return { bg: '#f3f4f6', text: '#6b7280' }; // gray
    default:
      return { bg: '#f3f4f6', text: '#6b7280' };
  }
}

/** Mailbox connectivity and the latest import outcome are separate states. */
export function getSyncStatusLabel(account: EmailAccount): string {
  if (account.status === EmailAccountStatus.ReauthenticationRequired) return 'Reconnect required';
  if (account.status === EmailAccountStatus.Disconnected || account.status === EmailAccountStatus.Suspended)
    return getStatusLabel(account.status);
  const result = account.lastSyncResult;
  if (result?.errorCode === 'monthly_limit_reached' || result?.errorCode === 'NOTICE_LIMIT_EXCEEDED')
    return 'Notice limit reached';
  if (result?.errorCode === 'subscription_required') return 'Subscription required';
  if (result?.status === 'failed') return 'Sync failed';
  if (result?.status === 'completed_with_warnings') return 'Synced with warnings';
  if (result?.status === 'completed') return 'Synced';
  // Compatibility with results saved before structured outcome fields existed.
  if (account.lastSyncError && (result?.noticesImported ?? 0) > 0) return 'Synced with warnings';
  if (account.status === EmailAccountStatus.SyncFailed) return 'Sync failed';
  if (account.lastSyncError) return 'Synced with warnings';
  return account.lastSyncAt ? 'Synced' : 'Connected';
}

export function getSyncStatusColor(account: EmailAccount) {
  const label = getSyncStatusLabel(account);
  if (['Synced with warnings', 'Notice limit reached', 'Subscription required'].includes(label))
    return getStatusColor(EmailAccountStatus.ReauthenticationRequired);
  if (label === 'Synced') return getStatusColor(EmailAccountStatus.Connected);
  return getStatusColor(account.status);
}