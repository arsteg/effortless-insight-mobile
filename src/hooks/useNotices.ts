/**
 * Notice Hooks
 * React Query hooks for notice data
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { noticesApi } from '../services/api';
import { cacheNotices, getCachedNotices } from '../services/storage/cache';
import { useUIStore } from '../stores';
import {
  NoticeQueryParams,
  NoticeDetailDto,
  NoticeDto,
  NoticeStatisticsDto,
  NoticeUploadResponse,
  WorkflowProgressDto,
  ResponseDto,
  SaveDraftRequest,
  SubmitForReviewRequest,
  ApproveResponseRequest,
  RejectResponseRequest,
  MarkSubmittedRequest,
} from '../types';
import { PAGINATION } from '../utils/constants';

// Query keys
export const noticeKeys = {
  all: ['notices'] as const,
  lists: () => [...noticeKeys.all, 'list'] as const,
  list: (params: NoticeQueryParams) => [...noticeKeys.lists(), params] as const,
  details: () => [...noticeKeys.all, 'detail'] as const,
  detail: (id: string) => [...noticeKeys.details(), id] as const,
  statistics: () => [...noticeKeys.all, 'statistics'] as const,
  workflow: (id: string) => [...noticeKeys.all, 'workflow', id] as const,
  attachments: (id: string) => [...noticeKeys.all, 'attachments', id] as const,
  responses: (id: string) => [...noticeKeys.all, 'responses', id] as const,
  latestResponse: (id: string) => [...noticeKeys.all, 'latestResponse', id] as const,
};

/**
 * Get paginated notices with infinite scroll support
 */
export function useNoticesInfinite(params: Omit<NoticeQueryParams, 'page'> = {}) {
  const { isOnline } = useUIStore();

  return useInfiniteQuery({
    queryKey: noticeKeys.list(params),
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const response = await noticesApi.getNotices({
          ...params,
          page: pageParam,
          pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
        });

        // Cache first page
        if (pageParam === 1) {
          await cacheNotices(response.notices);
        }

        return response;
      } catch (error) {
        // Fallback to cached data when offline or on network error (first page only)
        if (pageParam === 1) {
          const cachedNotices = await getCachedNotices();
          if (cachedNotices && cachedNotices.length > 0) {
            return {
              notices: cachedNotices,
              page: 1,
              pageSize: cachedNotices.length,
              totalCount: cachedNotices.length,
              totalPages: 1,
            };
          }
        }
        throw error;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}

/**
 * Get notices list (single page)
 */
export function useNotices(params: NoticeQueryParams = {}) {
  return useQuery({
    queryKey: noticeKeys.list(params),
    queryFn: async () => {
      try {
        const response = await noticesApi.getNotices(params);
        return response;
      } catch (error) {
        // Fallback to cached data when offline or on network error
        const cachedNotices = await getCachedNotices();
        if (cachedNotices && cachedNotices.length > 0) {
          return {
            notices: cachedNotices,
            page: 1,
            pageSize: cachedNotices.length,
            totalCount: cachedNotices.length,
            totalPages: 1,
          };
        }
        throw error;
      }
    },
  });
}

/**
 * Get notice by ID
 */
export function useNotice(noticeId: string, enabled = true) {
  return useQuery({
    queryKey: noticeKeys.detail(noticeId),
    queryFn: () => noticesApi.getNotice(noticeId),
    enabled: enabled && !!noticeId,
  });
}

/**
 * Get notice statistics for dashboard
 */
export function useNoticeStatistics() {
  return useQuery({
    queryKey: noticeKeys.statistics(),
    queryFn: noticesApi.getStatistics,
  });
}

/**
 * Get workflow progress
 */
export function useWorkflowProgress(noticeId: string, enabled = true) {
  return useQuery({
    queryKey: noticeKeys.workflow(noticeId),
    queryFn: () => noticesApi.getWorkflowProgress(noticeId),
    enabled: enabled && !!noticeId,
  });
}

/**
 * Get attachments
 */
export function useAttachments(noticeId: string, enabled = true) {
  return useQuery({
    queryKey: noticeKeys.attachments(noticeId),
    queryFn: () => noticesApi.getAttachments(noticeId),
    enabled: enabled && !!noticeId,
  });
}

/**
 * Upload notice mutation
 */
export function useUploadNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      onProgress,
    }: {
      file: { uri: string; type: string; name: string };
      onProgress?: (progress: number) => void;
    }) => noticesApi.uploadNotice(file, onProgress),
    onSuccess: () => {
      // Invalidate notices list
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noticeKeys.statistics() });
    },
  });
}

/**
 * Update notice mutation
 */
export function useUpdateNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noticeId, data }: { noticeId: string; data: Partial<NoticeDto> }) =>
      noticesApi.updateNotice(noticeId, data),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
    },
  });
}

/**
 * Update notice status mutation
 */
export function useUpdateNoticeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noticeId, status }: { noticeId: string; status: string }) =>
      noticesApi.updateStatus(noticeId, status),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noticeKeys.statistics() });
    },
  });
}

/**
 * Assign notice mutation
 */
export function useAssignNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noticeId, userId }: { noticeId: string; userId: string }) =>
      noticesApi.assignNotice(noticeId, userId),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
    },
  });
}

/**
 * Delete notice mutation
 */
export function useDeleteNotice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noticeId: string) => noticesApi.deleteNotice(noticeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noticeKeys.statistics() });
    },
  });
}

/**
 * Retry AI analysis mutation
 */
export function useRetryAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noticeId: string) => noticesApi.retryAnalysis(noticeId),
    onSuccess: (_, noticeId) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(noticeId) });
    },
  });
}

/**
 * Advance workflow mutation
 */
export function useAdvanceWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noticeId, transitionKey }: { noticeId: string; transitionKey: string }) =>
      noticesApi.advanceWorkflow(noticeId, transitionKey),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.workflow(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
    },
  });
}

/**
 * Upload attachment mutation
 */
export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noticeId,
      file,
      documentType,
      description,
    }: {
      noticeId: string;
      file: { uri: string; type: string; name: string };
      documentType?: string;
      description?: string;
    }) => noticesApi.uploadAttachment(noticeId, file, documentType, description),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.attachments(noticeId) });
    },
  });
}

/**
 * Delete attachment mutation
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noticeId, attachmentId }: { noticeId: string; attachmentId: string }) =>
      noticesApi.deleteAttachment(noticeId, attachmentId),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.attachments(noticeId) });
    },
  });
}

// ========== Response Hooks ==========

/**
 * Get all responses for a notice
 */
export function useResponses(noticeId: string, enabled = true) {
  return useQuery({
    queryKey: noticeKeys.responses(noticeId),
    queryFn: () => noticesApi.getResponses(noticeId),
    enabled: enabled && !!noticeId,
  });
}

/**
 * Get latest response for a notice
 */
export function useLatestResponse(noticeId: string, enabled = true) {
  return useQuery({
    queryKey: noticeKeys.latestResponse(noticeId),
    queryFn: () => noticesApi.getLatestResponse(noticeId),
    enabled: enabled && !!noticeId,
  });
}

/**
 * Save draft response mutation
 */
export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noticeId, data }: { noticeId: string; data: SaveDraftRequest }) =>
      noticesApi.saveDraft(noticeId, data),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.responses(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.latestResponse(noticeId) });
    },
  });
}

/**
 * Submit response for review mutation
 */
export function useSubmitForReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noticeId,
      responseId,
      data,
    }: {
      noticeId: string;
      responseId: string;
      data?: SubmitForReviewRequest;
    }) => noticesApi.submitForReview(noticeId, responseId, data),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.responses(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.latestResponse(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(noticeId) });
    },
  });
}

/**
 * Approve response mutation
 */
export function useApproveResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noticeId,
      responseId,
      data,
    }: {
      noticeId: string;
      responseId: string;
      data?: ApproveResponseRequest;
    }) => noticesApi.approveResponse(noticeId, responseId, data),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.responses(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.latestResponse(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(noticeId) });
    },
  });
}

/**
 * Reject response mutation
 */
export function useRejectResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noticeId,
      responseId,
      data,
    }: {
      noticeId: string;
      responseId: string;
      data: RejectResponseRequest;
    }) => noticesApi.rejectResponse(noticeId, responseId, data),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.responses(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.latestResponse(noticeId) });
    },
  });
}

/**
 * Mark response as submitted to authority
 */
export function useMarkSubmitted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noticeId,
      responseId,
      data,
    }: {
      noticeId: string;
      responseId: string;
      data?: MarkSubmittedRequest;
    }) => noticesApi.markSubmitted(noticeId, responseId, data),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: noticeKeys.responses(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.latestResponse(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.detail(noticeId) });
      queryClient.invalidateQueries({ queryKey: noticeKeys.lists() });
    },
  });
}

// ========== Download Hooks ==========

/**
 * Get notice download URL (original PDF)
 */
export function useNoticeDownloadUrl(noticeId: string) {
  return useMutation({
    mutationFn: () => noticesApi.getDownloadUrl(noticeId),
  });
}

/**
 * Get attachment download URL
 */
export function useAttachmentDownloadUrl() {
  return useMutation({
    mutationFn: ({ noticeId, attachmentId }: { noticeId: string; attachmentId: string }) =>
      noticesApi.getAttachmentDownloadUrl(noticeId, attachmentId),
  });
}
