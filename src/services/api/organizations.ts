/**
 * Organizations API Service
 */

import { apiClient, isApiError } from './client';
import {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  OrganizationListResponse,
  OrganizationDetailResponse,
  ValidateGstinResponse,
} from '../../types';

// API Response wrapper type (backend wraps all responses)
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const organizationsApi = {
  // ============================================================================
  // GSTIN Validation (Public endpoint - no auth required)
  // ============================================================================

  /**
   * Validate a GSTIN format and check if it's already registered
   */
  validateGstin: async (gstin: string): Promise<ValidateGstinResponse> => {
    try {
      const response = await apiClient.get<ApiResponse<ValidateGstinResponse>>(
        `/organizations/validate-gstin/${encodeURIComponent(gstin)}`
      );
      return response.data.data;
    } catch (error) {
      if (isApiError(error)) {
        // Return invalid response with error message
        return {
          isValid: false,
          gstin: null,
          stateCode: null,
          stateName: null,
          entityType: null,
          errorMessage: error.response?.data?.message || 'Invalid GSTIN',
        };
      }
      throw error;
    }
  },

  // ============================================================================
  // Organization CRUD
  // ============================================================================

  /**
   * Create a new organization
   * This is typically called during onboarding
   */
  createOrganization: async (
    data: CreateOrganizationRequest
  ): Promise<CreateOrganizationResponse> => {
    const response = await apiClient.post<ApiResponse<CreateOrganizationResponse>>(
      '/organizations',
      data
    );
    return response.data.data;
  },

  /**
   * Get all organizations the current user belongs to
   */
  getOrganizations: async (): Promise<OrganizationListResponse> => {
    const response = await apiClient.get<ApiResponse<OrganizationListResponse>>(
      '/organizations'
    );
    return response.data.data;
  },

  /**
   * Get organization details by ID
   */
  getOrganization: async (orgId: string): Promise<OrganizationDetailResponse> => {
    const response = await apiClient.get<ApiResponse<OrganizationDetailResponse>>(
      `/organizations/${orgId}`
    );
    return response.data.data;
  },

  /**
   * Switch to a different organization
   * Returns new tokens with the selected organization context
   */
  switchOrganization: async (
    orgId: string
  ): Promise<{ accessToken: string; refreshToken: string }> => {
    const response = await apiClient.post<
      ApiResponse<{ accessToken: string; refreshToken: string }>
    >('/auth/switch-organization', { organizationId: orgId });
    return response.data.data;
  },
};
