/**
 * GSTN Portal Integration Hooks
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores/uiStore';
import * as gstnApi from '../services/api/gstn';
import type { GstnUpdateSettingsRequest } from '../types';

// Query key factory
export const gstnKeys = {
  all: ['gstn'] as const,
  connections: () => [...gstnKeys.all, 'connections'] as const,
  connection: (gstinId: string) => [...gstnKeys.all, 'connection', gstinId] as const,
  syncHistory: (gstinId: string) => [...gstnKeys.all, 'sync-history', gstinId] as const,
};

/**
 * Extract error message from various error types
 */
function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    const apiError = error as any;
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
 * Only retry on network errors or 5xx, not on 4xx client errors
 */
function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  const apiError = error as any;
  const status = apiError?.response?.status;

  // Don't retry client errors (4xx)
  if (status && status >= 400 && status < 500) return false;

  return true;
}

/**
 * Hook to fetch all GSTN connections
 */
export function useGstnConnections() {
  return useQuery({
    queryKey: gstnKeys.connections(),
    queryFn: gstnApi.getConnections,
    staleTime: 30000,
    retry: 2,
  });
}

/**
 * Hook to fetch connection status for a specific GSTIN
 */
export function useGstnConnectionStatus(gstinId: string) {
  return useQuery({
    queryKey: gstnKeys.connection(gstinId),
    queryFn: () => gstnApi.getConnectionStatus(gstinId),
    enabled: !!gstinId,
    staleTime: 30000,
    retry: 2,
  });
}

/**
 * Hook to fetch sync history for a connection
 */
export function useGstnSyncHistory(gstinId: string, limit: number = 20) {
  return useQuery({
    queryKey: gstnKeys.syncHistory(gstinId),
    queryFn: () => gstnApi.getSyncHistory(gstinId, limit),
    enabled: !!gstinId,
    staleTime: 60000,
    retry: 2,
  });
}

/**
 * Hook to initiate GSTN connection (triggers OTP)
 */
export function useInitiateConnection() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (gstinId: string) => gstnApi.initiateConnection(gstinId),
    retry: shouldRetryMutation,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: (data, gstinId) => {
      queryClient.invalidateQueries({ queryKey: gstnKeys.connection(gstinId) });
      if (data.success && data.otpDestination) {
        showToast('success', `OTP sent to ${data.otpDestination}`);
      } else if (!data.success) {
        showToast('error', data.errorMessage || 'Failed to initiate connection');
      }
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to initiate connection'));
    },
  });
}

/**
 * Hook to verify OTP
 */
export function useVerifyOtp() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: ({ gstinId, otp }: { gstinId: string; otp: string }) =>
      gstnApi.verifyOtp(gstinId, otp),
    retry: false, // Don't retry OTP verification
    onSuccess: (data, { gstinId }) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: gstnKeys.connections() });
      queryClient.invalidateQueries({ queryKey: gstnKeys.connection(gstinId) });
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: ['gstins'] });

      if (data.success) {
        showToast('success', 'GSTIN connected to GST Portal');
      }
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Invalid OTP. Please try again.'));
    },
  });
}

/**
 * Hook to resend OTP
 */
export function useResendOtp() {
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (gstinId: string) => gstnApi.resendOtp(gstinId),
    retry: shouldRetryMutation,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: (data) => {
      if (data.success && data.otpDestination) {
        showToast('success', `New OTP sent to ${data.otpDestination}`);
      }
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Please wait before requesting another OTP'));
    },
  });
}

/**
 * Hook to disconnect from GSTN portal
 */
export function useDisconnect() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: ({ gstinId, reason }: { gstinId: string; reason?: string }) =>
      gstnApi.disconnect(gstinId, reason),
    retry: false,
    onSuccess: (_, { gstinId }) => {
      queryClient.invalidateQueries({ queryKey: gstnKeys.connections() });
      queryClient.invalidateQueries({ queryKey: gstnKeys.connection(gstinId) });
      queryClient.invalidateQueries({ queryKey: ['gstins'] });
      showToast('success', 'GSTIN disconnected from GST Portal');
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to disconnect'));
    },
  });
}

/**
 * Hook to trigger manual sync
 */
export function useTriggerSync() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (gstinId: string) => gstnApi.triggerSync(gstinId),
    retry: shouldRetryMutation,
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000),
    onSuccess: (data, gstinId) => {
      queryClient.invalidateQueries({ queryKey: gstnKeys.connection(gstinId) });
      queryClient.invalidateQueries({ queryKey: gstnKeys.syncHistory(gstinId) });
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (data.success) {
        const imported = data.noticesImported || 0;
        const found = data.noticesFound || 0;
        if (imported > 0) {
          showToast('success', `Sync complete: ${imported} new notices imported`);
        } else if (found > 0) {
          showToast('success', `Sync complete: ${found} notices found (all imported)`);
        } else {
          showToast('success', 'Sync complete: No new notices');
        }
      }
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to sync notices'));
    },
  });
}

/**
 * Hook to update connection settings
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: ({
      gstinId,
      settings,
    }: {
      gstinId: string;
      settings: GstnUpdateSettingsRequest;
    }) => gstnApi.updateSettings(gstinId, settings),
    retry: shouldRetryMutation,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: (_, { gstinId }) => {
      queryClient.invalidateQueries({ queryKey: gstnKeys.connection(gstinId) });
      queryClient.invalidateQueries({ queryKey: gstnKeys.connections() });
      showToast('success', 'Sync settings updated');
    },
    onError: (error: unknown) => {
      showToast('error', getErrorMessage(error, 'Failed to update settings'));
    },
  });
}
