/**
 * Tasks API Service
 */

import { apiClient } from './client';
import {
  TaskDto,
  TaskDetailDto,
  TaskListResponseDto,
  MyTasksResponseDto,
  CreateTaskDto,
  UpdateTaskDto,
  TaskQueryParams,
  CommentResponseDto,
  CommentListResponseDto,
  CreateCommentDto,
  UpdateCommentDto,
  ActivityFeedResponseDto,
  DocumentRequestDto,
  DocumentRequestListResponseDto,
  CreateDocumentRequestDto,
  UpdateDocumentRequestDto,
} from '../../types';
import { PAGINATION } from '../../utils/constants';

export const tasksApi = {
  // ============================================
  // Tasks
  // ============================================

  /**
   * Get tasks for a notice
   */
  getTasksForNotice: async (
    noticeId: string,
    params: TaskQueryParams = {}
  ): Promise<TaskListResponseDto> => {
    const queryParams = new URLSearchParams();

    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      statuses.forEach(s => queryParams.append('status', s));
    }
    if (params.priority) {
      const priorities = Array.isArray(params.priority) ? params.priority : [params.priority];
      priorities.forEach(p => queryParams.append('priority', p));
    }
    if (params.assignee) queryParams.append('assignee', params.assignee);
    if (params.includeSubtasks !== undefined) {
      queryParams.append('includeSubtasks', String(params.includeSubtasks));
    }

    const response = await apiClient.get<TaskListResponseDto>(
      `/notices/${noticeId}/tasks?${queryParams.toString()}`
    );
    return response.data;
  },

  /**
   * Get my tasks across all notices
   */
  getMyTasks: async (
    params: {
      status?: string;
      priority?: string;
      dueWithin?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<MyTasksResponseDto> => {
    const queryParams = new URLSearchParams();

    if (params.status) queryParams.append('status', params.status);
    if (params.priority) queryParams.append('priority', params.priority);
    if (params.dueWithin) queryParams.append('dueWithin', params.dueWithin);
    queryParams.append('page', String(params.page || 1));
    queryParams.append('pageSize', String(params.pageSize || PAGINATION.DEFAULT_PAGE_SIZE));

    const response = await apiClient.get<MyTasksResponseDto>(`/tasks/my?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get task by ID
   */
  getTask: async (taskId: string): Promise<TaskDetailDto> => {
    const response = await apiClient.get<TaskDetailDto>(`/tasks/${taskId}`);
    return response.data;
  },

  /**
   * Create task for a notice
   */
  createTask: async (noticeId: string, data: CreateTaskDto): Promise<TaskDetailDto> => {
    const response = await apiClient.post<TaskDetailDto>(`/notices/${noticeId}/tasks`, data);
    return response.data;
  },

  /**
   * Update task
   */
  updateTask: async (taskId: string, data: UpdateTaskDto): Promise<TaskDetailDto> => {
    const response = await apiClient.patch<TaskDetailDto>(`/tasks/${taskId}`, data);
    return response.data;
  },

  /**
   * Delete task
   */
  deleteTask: async (taskId: string): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}`);
  },

  // ============================================
  // Comments
  // ============================================

  /**
   * Get comments for a notice
   */
  getComments: async (
    noticeId: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<CommentListResponseDto> => {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(params.page || 1));
    queryParams.append('pageSize', String(params.pageSize || PAGINATION.DEFAULT_PAGE_SIZE));

    const response = await apiClient.get<CommentListResponseDto>(
      `/notices/${noticeId}/comments?${queryParams.toString()}`
    );
    return response.data;
  },

  /**
   * Get comment by ID
   */
  getComment: async (commentId: string): Promise<CommentResponseDto> => {
    const response = await apiClient.get<CommentResponseDto>(`/comments/${commentId}`);
    return response.data;
  },

  /**
   * Create comment
   */
  createComment: async (noticeId: string, data: CreateCommentDto): Promise<CommentResponseDto> => {
    const response = await apiClient.post<CommentResponseDto>(
      `/notices/${noticeId}/comments`,
      data
    );
    return response.data;
  },

  /**
   * Reply to comment
   */
  replyToComment: async (commentId: string, data: CreateCommentDto): Promise<CommentResponseDto> => {
    const response = await apiClient.post<CommentResponseDto>(
      `/comments/${commentId}/replies`,
      data
    );
    return response.data;
  },

  /**
   * Update comment
   */
  updateComment: async (commentId: string, data: UpdateCommentDto): Promise<CommentResponseDto> => {
    const response = await apiClient.patch<CommentResponseDto>(`/comments/${commentId}`, data);
    return response.data;
  },

  /**
   * Delete comment
   */
  deleteComment: async (commentId: string): Promise<void> => {
    await apiClient.delete(`/comments/${commentId}`);
  },

  /**
   * Add reaction to comment
   */
  addReaction: async (commentId: string, emoji: string): Promise<CommentResponseDto> => {
    const response = await apiClient.post<CommentResponseDto>(
      `/comments/${commentId}/reactions`,
      { emoji }
    );
    return response.data;
  },

  /**
   * Remove reaction from comment
   */
  removeReaction: async (commentId: string, emoji: string): Promise<void> => {
    await apiClient.delete(`/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`);
  },

  // ============================================
  // Document Requests
  // ============================================

  /**
   * Get document requests for a notice
   */
  getDocumentRequests: async (noticeId: string): Promise<DocumentRequestListResponseDto> => {
    const response = await apiClient.get<DocumentRequestListResponseDto>(
      `/notices/${noticeId}/document-requests`
    );
    return response.data;
  },

  /**
   * Get document request by ID
   */
  getDocumentRequest: async (requestId: string): Promise<DocumentRequestDto> => {
    const response = await apiClient.get<DocumentRequestDto>(`/document-requests/${requestId}`);
    return response.data;
  },

  /**
   * Create document request
   */
  createDocumentRequest: async (
    noticeId: string,
    data: CreateDocumentRequestDto
  ): Promise<DocumentRequestDto> => {
    const response = await apiClient.post<DocumentRequestDto>(
      `/notices/${noticeId}/document-requests`,
      data
    );
    return response.data;
  },

  /**
   * Update document request
   */
  updateDocumentRequest: async (
    requestId: string,
    data: UpdateDocumentRequestDto
  ): Promise<DocumentRequestDto> => {
    const response = await apiClient.patch<DocumentRequestDto>(
      `/document-requests/${requestId}`,
      data
    );
    return response.data;
  },

  /**
   * Delete document request
   */
  deleteDocumentRequest: async (requestId: string): Promise<void> => {
    await apiClient.delete(`/document-requests/${requestId}`);
  },

  /**
   * Submit document for request
   */
  submitDocument: async (
    requestId: string,
    file: { uri: string; type: string; name: string },
    note?: string
  ): Promise<DocumentRequestDto> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as unknown as Blob);
    if (note) formData.append('note', note);

    const response = await apiClient.post<DocumentRequestDto>(
      `/document-requests/${requestId}/submissions`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  /**
   * Fulfill document request
   */
  fulfillDocumentRequest: async (requestId: string, note?: string): Promise<DocumentRequestDto> => {
    const response = await apiClient.post<DocumentRequestDto>(
      `/document-requests/${requestId}/fulfill`,
      { note }
    );
    return response.data;
  },

  // ============================================
  // Activity Feed
  // ============================================

  /**
   * Get activity feed for a notice
   */
  getNoticeActivity: async (
    noticeId: string,
    params: { cursor?: string; limit?: number } = {}
  ): Promise<ActivityFeedResponseDto> => {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append('cursor', params.cursor);
    if (params.limit) queryParams.append('limit', String(params.limit));

    const response = await apiClient.get<ActivityFeedResponseDto>(
      `/notices/${noticeId}/activity?${queryParams.toString()}`
    );
    return response.data;
  },

  /**
   * Get global activity feed
   */
  getActivity: async (
    params: { cursor?: string; limit?: number } = {}
  ): Promise<ActivityFeedResponseDto> => {
    const queryParams = new URLSearchParams();
    if (params.cursor) queryParams.append('cursor', params.cursor);
    if (params.limit) queryParams.append('limit', String(params.limit));

    const response = await apiClient.get<ActivityFeedResponseDto>(
      `/activity?${queryParams.toString()}`
    );
    return response.data;
  },
};
