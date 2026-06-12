/**
 * Notice Hooks
 * React Query hooks for notice data
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { noticesApi } from '../services/api';
import { cacheNotices } from '../services/storage/cache';
import {
  NoticeQueryParams,
  NoticeDetailDto,
  NoticeDto,
  NoticeStatisticsDto,
  NoticeUploadResponse,
  WorkflowProgressDto,
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
};

/**
 * Get paginated notices with infinite scroll support
 */
export function useNoticesInfinite(params: Omit<NoticeQueryParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: noticeKeys.list(params),
    queryFn: async ({ pageParam = 1 }) => {
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
      const response = await noticesApi.getNotices(params);
      return response;
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
