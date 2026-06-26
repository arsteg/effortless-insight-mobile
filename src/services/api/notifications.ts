/**
 * Notifications API Service
 * Handles all notification-related API calls
 */

import { apiClient } from './client';
import {
  NotificationDto,
  NotificationListResponse,
  NotificationFilters,
  MarkNotificationsReadRequest,
  UnreadCountResponse,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesRequest,
  RegisterPushTokenRequest,
  NotificationActionResult,
} from '../../types/notification';
import { ApiResponse } from '../../types';

export const notificationsApi = {
  /**
   * Get notifications list with pagination and filters
   */
  getNotifications: async (filters: NotificationFilters = {}): Promise<NotificationListResponse> => {
    const params: Record<string, string | number | undefined> = {};

    if (filters.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters.type) {
      params.type = filters.type;
    }
    if (filters.priority) {
      params.priority = filters.priority;
    }
    if (filters.since) {
      params.since = filters.since;
    }
    if (filters.page) {
      params.page = filters.page;
    }
    if (filters.pageSize) {
      params.pageSize = filters.pageSize;
    }

    const response = await apiClient.get<ApiResponse<NotificationListResponse>>('/notifications', { params });
    return response.data.data;
  },

  /**
   * Get notification by ID
   */
  getNotification: async (notificationId: string): Promise<NotificationDto> => {
    const response = await apiClient.get<ApiResponse<NotificationDto>>(`/notifications/${notificationId}`);
    return response.data.data;
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await apiClient.get<ApiResponse<UnreadCountResponse>>('/notifications/unread-count');
    return response.data.data;
  },

  /**
   * Mark notification(s) as read
   */
  markAsRead: async (request: MarkNotificationsReadRequest): Promise<NotificationActionResult> => {
    const response = await apiClient.post<ApiResponse<NotificationActionResult>>('/notifications/read-all', request);
    return response.data.data;
  },

  /**
   * Mark a single notification as read
   */
  markOneAsRead: async (notificationId: string): Promise<NotificationActionResult> => {
    const response = await apiClient.post<ApiResponse<NotificationActionResult>>(`/notifications/${notificationId}/read`);
    return response.data.data;
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<NotificationActionResult> => {
    const response = await apiClient.post<ApiResponse<NotificationActionResult>>('/notifications/read-all', {});
    return response.data.data;
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (notificationId: string): Promise<void> => {
    await apiClient.delete(`/notifications/${notificationId}`);
  },

  /**
   * Get notification preferences
   */
  getPreferences: async (): Promise<NotificationPreferencesDto> => {
    const response = await apiClient.get<ApiResponse<NotificationPreferencesDto>>('/users/me/notification-preferences');
    return response.data.data;
  },

  /**
   * Update notification preferences
   */
  updatePreferences: async (request: UpdateNotificationPreferencesRequest): Promise<NotificationPreferencesDto> => {
    const response = await apiClient.put<ApiResponse<NotificationPreferencesDto>>('/users/me/notification-preferences', request);
    return response.data.data;
  },

  /**
   * Register push notification token
   */
  registerPushToken: async (request: RegisterPushTokenRequest): Promise<NotificationActionResult> => {
    const response = await apiClient.post<ApiResponse<NotificationActionResult>>('/push-tokens', request);
    return response.data.data;
  },

  /**
   * Unregister push notification token
   */
  unregisterPushToken: async (token: string): Promise<void> => {
    await apiClient.delete(`/push-tokens/${encodeURIComponent(token)}`);
  },

  /**
   * Test push notification (for debugging)
   */
  testPushNotification: async (): Promise<NotificationActionResult> => {
    const response = await apiClient.post<ApiResponse<NotificationActionResult>>('/notifications/test-push');
    return response.data.data;
  },
};
