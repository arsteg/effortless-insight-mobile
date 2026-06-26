/**
 * Task Hooks
 * React Query hooks for task and collaboration data
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { tasksApi } from '../services/api';
import { cacheTasks, getCachedTasks } from '../services/storage/cache';
import { useOfflineStore } from '../stores';
import { useUIStore } from '../stores';
import {
  TaskQueryParams,
  CreateTaskDto,
  UpdateTaskDto,
  CreateCommentDto,
  UpdateCommentDto,
  CreateDocumentRequestDto,
  UpdateDocumentRequestDto,
} from '../types';
import { PAGINATION } from '../utils/constants';

// Query keys
export const taskKeys = {
  all: ['tasks'] as const,
  myTasks: () => [...taskKeys.all, 'my'] as const,
  myTasksList: (params: Record<string, unknown>) => [...taskKeys.myTasks(), params] as const,
  noticeTasks: (noticeId: string) => [...taskKeys.all, 'notice', noticeId] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  comments: (noticeId: string) => ['comments', noticeId] as const,
  documentRequests: (noticeId: string) => ['documentRequests', noticeId] as const,
  activity: (noticeId: string) => ['activity', noticeId] as const,
};

// ============================================
// Task Hooks
// ============================================

/**
 * Get my tasks with infinite scroll
 */
export function useMyTasksInfinite(
  params: { status?: string; priority?: string; dueWithin?: string } = {}
) {
  return useInfiniteQuery({
    queryKey: taskKeys.myTasksList(params),
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const response = await tasksApi.getMyTasks({
          ...params,
          page: pageParam,
          pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
        });

        // Cache first page
        if (pageParam === 1) {
          await cacheTasks(response.tasks);
        }

        return response;
      } catch (error) {
        // Fallback to cached data when offline or on network error (first page only)
        if (pageParam === 1) {
          const cachedTasks = await getCachedTasks();
          if (cachedTasks && cachedTasks.length > 0) {
            return {
              tasks: cachedTasks,
              pagination: {
                page: 1,
                pageSize: cachedTasks.length,
                totalCount: cachedTasks.length,
                totalPages: 1,
              },
            };
          }
        }
        throw error;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      if (pagination.page < pagination.totalPages) {
        return pagination.page + 1;
      }
      return undefined;
    },
  });
}

/**
 * Get my tasks (single page)
 */
export function useMyTasks(params: { status?: string; priority?: string; dueWithin?: string } = {}) {
  return useQuery({
    queryKey: taskKeys.myTasksList(params),
    queryFn: async () => {
      try {
        return await tasksApi.getMyTasks(params);
      } catch (error) {
        // Fallback to cached data when offline or on network error
        const cachedTasks = await getCachedTasks();
        if (cachedTasks && cachedTasks.length > 0) {
          return {
            tasks: cachedTasks,
            pagination: {
              page: 1,
              pageSize: cachedTasks.length,
              totalCount: cachedTasks.length,
              totalPages: 1,
            },
          };
        }
        throw error;
      }
    },
  });
}

/**
 * Get tasks for a notice
 */
export function useNoticeTasks(noticeId: string, params: TaskQueryParams = {}) {
  return useQuery({
    queryKey: taskKeys.noticeTasks(noticeId),
    queryFn: () => tasksApi.getTasksForNotice(noticeId, params),
    enabled: !!noticeId,
  });
}

/**
 * Get task detail
 */
export function useTask(taskId: string, enabled = true) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => tasksApi.getTask(taskId),
    enabled: enabled && !!taskId,
  });
}

/**
 * Create task mutation
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { isOnline } = useUIStore();
  const { queueAction } = useOfflineStore();

  return useMutation({
    mutationFn: async ({ noticeId, data }: { noticeId: string; data: CreateTaskDto }) => {
      if (!isOnline) {
        await queueAction('create_task', { noticeId, data });
        throw new Error('Offline: Task will be created when online');
      }
      return tasksApi.createTask(noticeId, data);
    },
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.noticeTasks(noticeId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.myTasks() });
    },
  });
}

/**
 * Update task mutation
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { isOnline } = useUIStore();
  const { queueAction } = useOfflineStore();

  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: UpdateTaskDto }) => {
      if (!isOnline) {
        await queueAction('update_task', { taskId, data });
        throw new Error('Offline: Task will be updated when online');
      }
      return tasksApi.updateTask(taskId, data);
    },
    onSuccess: (result, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.noticeTasks(result.noticeId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.myTasks() });
    },
  });
}

/**
 * Delete task mutation
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// ============================================
// Comment Hooks
// ============================================

/**
 * Get comments for a notice
 */
export function useComments(noticeId: string, enabled = true) {
  return useQuery({
    queryKey: taskKeys.comments(noticeId),
    queryFn: () => tasksApi.getComments(noticeId),
    enabled: enabled && !!noticeId,
  });
}

/**
 * Create comment mutation
 */
export function useCreateComment() {
  const queryClient = useQueryClient();
  const { isOnline } = useUIStore();
  const { queueAction } = useOfflineStore();

  return useMutation({
    mutationFn: async ({ noticeId, data }: { noticeId: string; data: CreateCommentDto }) => {
      if (!isOnline) {
        await queueAction('create_comment', {
          noticeId,
          content: data.content,
          visibility: data.visibility,
          parentCommentId: data.parentCommentId,
        });
        throw new Error('Offline: Comment will be posted when online');
      }
      return tasksApi.createComment(noticeId, data);
    },
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(noticeId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(noticeId) });
    },
  });
}

/**
 * Reply to comment mutation
 */
export function useReplyToComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: string; data: CreateCommentDto }) =>
      tasksApi.replyToComment(commentId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(result.noticeId) });
    },
  });
}

/**
 * Update comment mutation
 */
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: string; data: UpdateCommentDto }) =>
      tasksApi.updateComment(commentId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(result.noticeId) });
    },
  });
}

/**
 * Delete comment mutation
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(commentId),
    onSuccess: () => {
      // Invalidate all comments since we don't have noticeId
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

/**
 * Add reaction mutation
 */
export function useAddReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: string }) =>
      tasksApi.addReaction(commentId, emoji),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(result.noticeId) });
    },
  });
}

/**
 * Remove reaction mutation
 */
export function useRemoveReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: string }) =>
      tasksApi.removeReaction(commentId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// ============================================
// Document Request Hooks
// ============================================

/**
 * Get document requests for a notice
 */
export function useDocumentRequests(noticeId: string, enabled = true) {
  return useQuery({
    queryKey: taskKeys.documentRequests(noticeId),
    queryFn: () => tasksApi.getDocumentRequests(noticeId),
    enabled: enabled && !!noticeId,
  });
}

/**
 * Create document request mutation
 */
export function useCreateDocumentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noticeId, data }: { noticeId: string; data: CreateDocumentRequestDto }) =>
      tasksApi.createDocumentRequest(noticeId, data),
    onSuccess: (_, { noticeId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.documentRequests(noticeId) });
    },
  });
}

/**
 * Update document request mutation
 */
export function useUpdateDocumentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      data,
    }: {
      requestId: string;
      data: UpdateDocumentRequestDto;
    }) => tasksApi.updateDocumentRequest(requestId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.documentRequests(result.noticeId) });
    },
  });
}

/**
 * Submit document mutation
 */
export function useSubmitDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      file,
      note,
    }: {
      requestId: string;
      file: { uri: string; type: string; name: string };
      note?: string;
    }) => tasksApi.submitDocument(requestId, file, note),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.documentRequests(result.noticeId) });
    },
  });
}

/**
 * Fulfill document request mutation
 */
export function useFulfillDocumentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, note }: { requestId: string; note?: string }) =>
      tasksApi.fulfillDocumentRequest(requestId, note),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.documentRequests(result.noticeId) });
    },
  });
}

// ============================================
// Activity Hooks
// ============================================

/**
 * Get activity feed for a notice
 */
export function useNoticeActivity(noticeId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: taskKeys.activity(noticeId),
    queryFn: async ({ pageParam }) => {
      return tasksApi.getNoticeActivity(noticeId, {
        cursor: pageParam,
        limit: 20,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore && lastPage.nextCursor) {
        return lastPage.nextCursor;
      }
      return undefined;
    },
    enabled: enabled && !!noticeId,
  });
}

/**
 * Get global activity feed
 */
export function useGlobalActivity() {
  return useInfiniteQuery({
    queryKey: ['globalActivity'],
    queryFn: async ({ pageParam }) => {
      return tasksApi.getActivity({
        cursor: pageParam,
        limit: 20,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore && lastPage.nextCursor) {
        return lastPage.nextCursor;
      }
      return undefined;
    },
  });
}
