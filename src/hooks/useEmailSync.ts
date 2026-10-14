import { useAuthStore } from '../stores/authStore';
/**
 * Email Sync Integration Hooks
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores/uiStore';
import * as emailSyncApi from '../services/api/emailSync';
import type { EmailAccountSettingsRequest, EmailConnectCallbackRequest } from '../types/emailSync';

// Query key factory
export const emailSyncKeys = {
  all: ['email-sync'] as const,
  accounts: () => [...emailSyncKeys.all, 'accounts'] as const,
  account: (accountId: string) => [...emailSyncKeys.all, 'account', accountId] as const,
  syncHistory: (accountId: string) => [...emailSyncKeys.all, 'sync-history', accountId] as const,
};

/**
 * Extract error message from various error types
 */
function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    const apiError = error as any;
    if (apiError.response?.data?.data?.errorMessage) return apiError.response.data.data.errorMessage;
    if (apiError.response?.data?.errorMessage) {
      return apiError.response.data.errorMessage;
    }
    if (apiError.response?.data?.message) {
      return apiError.response.data.message;
    }
    return error.message || defaultMessage;
  }
  return defaultMessage;
}

/**
 * Retry configuration for mutations
 */
function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  const apiError = error as any;
  const status = apiError?.response?.status;

  if (status && status >= 400 && status < 500) return false;

  return true;
}

/**
 * Hook to fetch all connected email accounts
 */
export function useEmailAccounts() {
  const organizationId = useAuthStore(s => s.user?.organization?.id);
  return useQuery({
    queryKey: [...emailSyncKeys.accounts(), organizationId],
    enabled: !!organizationId,
    queryFn: emailSyncApi.getAccounts,
    staleTime: 30000,
    retry: 2,
  });
}

/**
 * Hook to fetch a specific email account
 */
export function useEmailAccount(accountId: string) {
  const organizationId = useAuthStore(s => s.user?.organization?.id);
  return useQuery({
    queryKey: [...emailSyncKeys.account(accountId), organizationId],
    queryFn: () => emailSyncApi.getAccount(accountId),
    enabled: !!accountId && !!organizationId,
    staleTime: 30000,
    retry: 2,
  });
}

/**
 * Hook to fetch sync history for an account
 */
export function useEmailSyncHistory(accountId: string, limit: number = 20) {
  const organizationId = useAuthStore(s => s.user?.organization?.id);
  return useQuery({
    queryKey: [...emailSyncKeys.syncHistory(accountId), organizationId, limit],
    queryFn: () => emailSyncApi.getSyncHistory(accountId, limit),
    enabled: !!accountId && !!organizationId,
    staleTime: 60000,
    retry: 2,
  });
}

/**
 * Hook to initiate OAuth connection
 */
export function useInitiateEmailConnection() {
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: ({ provider, redirectUri }: { provider: string; redirectUri?: string }) =>
      emailSyncApi.initiateConnection(provider, redirectUri),
    retry: false,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: (data) => {
      if (!data.success) {
        showToast('error', data.errorMessage || 'Failed to start connection');
      }
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to start connection'));
    },
  });
}

/**
 * Hook to complete OAuth connection
 */
export function useCompleteEmailConnection() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: ({
      provider,
      code,
      state,
      redirectUri,
    }: {
      provider: string;
      code: string;
      state: string;
      redirectUri?: string;
    }) => emailSyncApi.completeConnection(provider, { code, state }, redirectUri),
    retry: false,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: emailSyncKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: ['notices'] });

      if (data.success) {
        showToast('success', `${data.account?.email} connected successfully`);
      } else {
        showToast('error', data.errorMessage || 'Failed to complete connection');
      }
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to complete connection'));
    },
  });
}

/**
 * Hook to disconnect an email account
 */
export function useDisconnectEmail() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (accountId: string) => emailSyncApi.disconnectAccount(accountId),
    retry: false,
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({ queryKey: emailSyncKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: emailSyncKeys.account(accountId) });
      showToast('success', 'Email account disconnected');
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to disconnect account'));
    },
  });
}

/**
 * Hook to trigger manual sync
 */
export function useTriggerEmailSync() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (accountId: string) => emailSyncApi.triggerSync(accountId),
    retry: false,
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000),
    onSuccess: (data, accountId) => {
      queryClient.invalidateQueries({ queryKey: emailSyncKeys.account(accountId) });
      queryClient.invalidateQueries({ queryKey: emailSyncKeys.syncHistory(accountId) });
      queryClient.invalidateQueries({ queryKey: emailSyncKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (!data.success || data.errorMessage) {
        showToast('error', data.errorMessage || 'Please retry syncing this account.');
        return;
      }
      if (data.success) {
        const imported = data.noticesImported || 0;
        const scanned = data.emailsScanned || 0;
        if (imported > 0) {
          showToast('success', `Sync complete: ${imported} notices imported from ${scanned} emails`);
        } else if (scanned > 0) {
          showToast('success', `Sync complete: Scanned ${scanned} emails, no new notices`);
        } else {
          showToast('success', 'Sync complete: No new emails to scan');
        }
      }
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to sync emails'));
    },
  });
}

/**
 * Hook to update account settings
 */
export function useUpdateEmailSettings() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: ({
      accountId,
      settings,
    }: {
      accountId: string;
      settings: EmailAccountSettingsRequest;
    }) => emailSyncApi.updateSettings(accountId, settings),
    retry: false,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: emailSyncKeys.account(accountId) });
      queryClient.invalidateQueries({ queryKey: emailSyncKeys.accounts() });
      showToast('success', 'Email sync settings updated');
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to update settings'));
    },
  });
}
