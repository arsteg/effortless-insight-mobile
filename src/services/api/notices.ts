/**
 * Notices API Service
 */

import { apiClient } from './client';
import {
  NoticeDto,
  NoticeDetailDto,
  NoticeListResponse,
  NoticeStatisticsDto,
  NoticeUploadResponse,
  NoticeQueryParams,
  AttachmentDto,
  DownloadUrlResponse,
  WorkflowProgressDto,
  ResponseDto,
  ResponseListResponse,
  SaveDraftRequest,
  SubmitForReviewRequest,
  ApproveResponseRequest,
  RejectResponseRequest,
  MarkSubmittedRequest,
  ApiResponse,
} from '../../types';
import { PAGINATION } from '../../utils/constants';

export const noticesApi = {
  /**
   * Get paginated list of notices
   */
  getNotices: async (params: NoticeQueryParams = {}): Promise<NoticeListResponse> => {
    const queryParams = new URLSearchParams();

    queryParams.append('page', String(params.page || 1));
    queryParams.append('pageSize', String(params.pageSize || PAGINATION.DEFAULT_PAGE_SIZE));

    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      statuses.forEach(s => queryParams.append('status', s));
    }
    if (params.priority) {
      const priorities = Array.isArray(params.priority) ? params.priority : [params.priority];
      priorities.forEach(p => queryParams.append('priority', p));
    }
    if (params.search) queryParams.append('search', params.search);
    if (params.gstin) queryParams.append('gstin', params.gstin);
    if (params.dueBefore) queryParams.append('dueBefore', params.dueBefore);
    if (params.dueAfter) queryParams.append('dueAfter', params.dueAfter);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const response = await apiClient.get<ApiResponse<NoticeListResponse>>(`/notices?${queryParams.toString()}`);
    return response.data.data;
  },

  /**
   * Get notice by ID
   */
  getNotice: async (noticeId: string): Promise<NoticeDetailDto> => {
    const response = await apiClient.get<ApiResponse<NoticeDetailDto>>(`/notices/${noticeId}`);
    return response.data.data;
  },

  /**
   * Get notice statistics for dashboard
   */
  getStatistics: async (): Promise<NoticeStatisticsDto> => {
    const response = await apiClient.get<ApiResponse<NoticeStatisticsDto>>('/notices/statistics');
    return response.data.data;
  },

  /**
   * Upload a notice document
   */
  uploadNotice: async (
    file: { uri: string; type: string; name: string },
    onProgress?: (progress: number) => void
  ): Promise<NoticeUploadResponse> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as unknown as Blob);

    const response = await apiClient.post<ApiResponse<NoticeUploadResponse>>('/notices/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data.data;
  },

  /**
   * Update notice
   */
  updateNotice: async (noticeId: string, data: Partial<NoticeDto>): Promise<NoticeDetailDto> => {
    const response = await apiClient.put<ApiResponse<NoticeDetailDto>>(`/notices/${noticeId}`, data);
    return response.data.data;
  },

  /**
   * Update notice status
   */
  updateStatus: async (noticeId: string, status: string): Promise<NoticeDetailDto> => {
    const response = await apiClient.put<ApiResponse<NoticeDetailDto>>(`/notices/${noticeId}/status`, { status });
    return response.data.data;
  },

  /**
   * Assign notice to user
   */
  assignNotice: async (noticeId: string, userId: string): Promise<NoticeDetailDto> => {
    const response = await apiClient.put<ApiResponse<NoticeDetailDto>>(`/notices/${noticeId}/assign`, { userId });
    return response.data.data;
  },

  /**
   * Delete notice
   */
  deleteNotice: async (noticeId: string): Promise<void> => {
    await apiClient.delete(`/notices/${noticeId}`);
  },

  /**
   * Get notice download URL
   */
  getDownloadUrl: async (noticeId: string): Promise<DownloadUrlResponse> => {
    const response = await apiClient.get<ApiResponse<DownloadUrlResponse>>(`/notices/${noticeId}/download`);
    return response.data.data;
  },

  /**
   * Retry AI analysis
   */
  retryAnalysis: async (noticeId: string): Promise<{ jobId: string }> => {
    const response = await apiClient.post<ApiResponse<{ jobId: string }>>(`/notices/${noticeId}/report/retry`);
    return response.data.data;
  },

  /**
   * Get notice attachments
   */
  getAttachments: async (noticeId: string): Promise<AttachmentDto[]> => {
    const response = await apiClient.get<ApiResponse<AttachmentDto[]>>(`/notices/${noticeId}/attachments`);
    return response.data.data;
  },

  /**
   * Upload attachment
   */
  uploadAttachment: async (
    noticeId: string,
    file: { uri: string; type: string; name: string },
    documentType?: string,
    description?: string
  ): Promise<AttachmentDto> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as unknown as Blob);
    if (documentType) formData.append('documentType', documentType);
    if (description) formData.append('description', description);

    const response = await apiClient.post<ApiResponse<AttachmentDto>>(
      `/notices/${noticeId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  },

  /**
   * Delete attachment
   */
  deleteAttachment: async (noticeId: string, attachmentId: string): Promise<void> => {
    await apiClient.delete(`/notices/${noticeId}/attachments/${attachmentId}`);
  },

  /**
   * Get attachment download URL
   */
  getAttachmentDownloadUrl: async (
    noticeId: string,
    attachmentId: string
  ): Promise<DownloadUrlResponse> => {
    const response = await apiClient.get<ApiResponse<DownloadUrlResponse>>(
      `/notices/${noticeId}/attachments/${attachmentId}/download`
    );
    return response.data.data;
  },

  /**
   * Get workflow progress
   */
  getWorkflowProgress: async (noticeId: string): Promise<WorkflowProgressDto> => {
    const response = await apiClient.get<ApiResponse<WorkflowProgressDto>>(`/notices/${noticeId}/workflow/progress`);
    return response.data.data;
  },

  /**
   * Advance workflow to next stage
   */
  advanceWorkflow: async (noticeId: string, transitionKey: string): Promise<WorkflowProgressDto> => {
    const response = await apiClient.post<ApiResponse<WorkflowProgressDto>>(
      `/notices/${noticeId}/workflow/transition`,
      { transitionKey }
    );
    return response.data.data;
  },

  // ========== Response Methods ==========

  /**
   * Get all responses for a notice
   */
  getResponses: async (noticeId: string): Promise<ResponseListResponse> => {
    const response = await apiClient.get<ApiResponse<ResponseListResponse>>(`/notices/${noticeId}/responses`);
    return response.data.data;
  },

  /**
   * Get latest response for a notice
   */
  getLatestResponse: async (noticeId: string): Promise<ResponseDto | null> => {
    try {
      const response = await apiClient.get<ApiResponse<ResponseDto>>(`/notices/${noticeId}/responses/latest`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Save response draft
   */
  saveDraft: async (noticeId: string, data: SaveDraftRequest): Promise<ResponseDto> => {
    const response = await apiClient.post<ApiResponse<ResponseDto>>(`/notices/${noticeId}/responses/draft`, data);
    return response.data.data;
  },

  /**
   * Submit response for review
   */
  submitForReview: async (
    noticeId: string,
    responseId: string,
    data?: SubmitForReviewRequest
  ): Promise<ResponseDto> => {
    const response = await apiClient.post<ApiResponse<ResponseDto>>(
      `/notices/${noticeId}/responses/${responseId}/submit-for-review`,
      data || {}
    );
    return response.data.data;
  },

  /**
   * Approve response
   */
  approveResponse: async (
    noticeId: string,
    responseId: string,
    data?: ApproveResponseRequest
  ): Promise<ResponseDto> => {
    const response = await apiClient.post<ApiResponse<ResponseDto>>(
      `/notices/${noticeId}/responses/${responseId}/approve`,
      data || {}
    );
    return response.data.data;
  },

  /**
   * Reject response
   */
  rejectResponse: async (
    noticeId: string,
    responseId: string,
    data: RejectResponseRequest
  ): Promise<ResponseDto> => {
    const response = await apiClient.post<ApiResponse<ResponseDto>>(
      `/notices/${noticeId}/responses/${responseId}/reject`,
      data
    );
    return response.data.data;
  },

  /**
   * Mark response as submitted to authority
   */
  markSubmitted: async (
    noticeId: string,
    responseId: string,
    data?: MarkSubmittedRequest
  ): Promise<ResponseDto> => {
    const response = await apiClient.post<ApiResponse<ResponseDto>>(
      `/notices/${noticeId}/responses/${responseId}/mark-submitted`,
      data || {}
    );
    return response.data.data;
  },
};
