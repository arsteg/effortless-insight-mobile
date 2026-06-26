/**
 * Organization Hooks
 * React Query hooks for organization data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '../services/api';
import { useUIStore } from '../stores';
import {
  CreateOrganizationRequest,
  OrganizationListResponse,
  OrganizationDetailResponse,
  ValidateGstinResponse,
} from '../types';
import { getApiErrorMessage } from '../services/api/client';

// Query keys
export const organizationKeys = {
  all: ['organizations'] as const,
  list: () => [...organizationKeys.all, 'list'] as const,
  detail: (id: string) => [...organizationKeys.all, 'detail', id] as const,
  gstinValidation: (gstin: string) => [...organizationKeys.all, 'gstin', gstin] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all organizations for the current user
 */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: organizationsApi.getOrganizations,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch organization details by ID
 */
export function useOrganizationDetail(orgId: string, enabled = true) {
  return useQuery({
    queryKey: organizationKeys.detail(orgId),
    queryFn: () => organizationsApi.getOrganization(orgId),
    enabled: enabled && !!orgId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Validate GSTIN
 */
export function useValidateGstin(gstin: string, enabled = true) {
  return useQuery({
    queryKey: organizationKeys.gstinValidation(gstin),
    queryFn: () => organizationsApi.validateGstin(gstin),
    enabled: enabled && gstin.length === 15,
    staleTime: 1000 * 60 * 60, // 1 hour - GSTIN validation doesn't change
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new organization
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (data: CreateOrganizationRequest) =>
      organizationsApi.createOrganization(data),
    onSuccess: () => {
      // Invalidate organizations list
      queryClient.invalidateQueries({ queryKey: organizationKeys.list() });
      showToast('success', 'Organization created successfully!');
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}

/**
 * Switch to a different organization
 */
export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  const { showToast } = useUIStore();

  return useMutation({
    mutationFn: (orgId: string) => organizationsApi.switchOrganization(orgId),
    onSuccess: () => {
      // Invalidate all queries since context has changed
      queryClient.invalidateQueries();
      showToast('success', 'Organization switched successfully');
    },
    onError: (error) => {
      showToast('error', getApiErrorMessage(error));
    },
  });
}
