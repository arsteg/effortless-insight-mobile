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

    const response = await apiClient.get('/notifications', { params });
    return response.data;
  },

  /**
   * Get notification by ID
   */
  getNotification: async (notificationId: string): Promise<NotificationDto> => {
    const response = await apiClient.get(`/notifications/${notificationId}`);
    return response.data;
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data;
  },

  /**
   * Mark notification(s) as read
   */
  markAsRead: async (request: MarkNotificationsReadRequest): Promise<NotificationActionResult> => {
    const response = await apiClient.post('/notifications/mark-read', request);
    return response.data;
  },

  /**
   * Mark a single notification as read
   */
  markOneAsRead: async (notificationId: string): Promise<NotificationActionResult> => {
    const response = await apiClient.post(`/notifications/${notificationId}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<NotificationActionResult> => {
    const response = await apiClient.post('/notifications/mark-read', { all: true });
    return response.data;
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
    const response = await apiClient.get('/notifications/preferences');
    return response.data;
  },

  /**
   * Update notification preferences
   */
  updatePreferences: async (request: UpdateNotificationPreferencesRequest): Promise<NotificationPreferencesDto> => {
    const response = await apiClient.patch('/notifications/preferences', request);
    return response.data;
  },

  /**
   * Register push notification token
   */
  registerPushToken: async (request: RegisterPushTokenRequest): Promise<NotificationActionResult> => {
    const response = await apiClient.post('/notifications/push-token', request);
    return response.data;
  },

  /**
   * Unregister push notification token
   */
  unregisterPushToken: async (token: string): Promise<void> => {
    await apiClient.delete(`/notifications/push-token/${encodeURIComponent(token)}`);
  },

  /**
   * Test push notification (for debugging)
   */
  testPushNotification: async (): Promise<NotificationActionResult> => {
    const response = await apiClient.post('/notifications/test-push');
    return response.data;
  },
};
