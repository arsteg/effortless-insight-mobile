/**
 * Notification Hooks
 * React Query hooks for notification data
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { notificationsApi } from '../services/api/notifications';
import {
  NotificationFilters,
  NotificationDto,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesRequest,
  GroupedNotifications,
} from '../types/notification';
import { PAGINATION } from '../utils/constants';
import { isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';

// Query keys
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: NotificationFilters) => [...notificationKeys.lists(), filters] as const,
  detail: (id: string) => [...notificationKeys.all, 'detail', id] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

/**
 * Group notifications by date
 */
function groupNotificationsByDate(notifications: NotificationDto[]): GroupedNotifications {
  const groups: GroupedNotifications = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  for (const notification of notifications) {
    const date = parseISO(notification.createdAt);

    if (isToday(date)) {
      groups.today.push(notification);
    } else if (isYesterday(date)) {
      groups.yesterday.push(notification);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(notification);
    } else {
      groups.older.push(notification);
    }
  }

  return groups;
}

/**
 * Get paginated notifications with infinite scroll support
 */
export function useNotificationsInfinite(filters: Omit<NotificationFilters, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await notificationsApi.getNotifications({
        ...filters,
        page: pageParam,
        pageSize: filters.pageSize || PAGINATION.DEFAULT_PAGE_SIZE,
      });

      return response;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    select: (data) => {
      // Flatten all notifications from all pages
      const allNotifications = data.pages.flatMap((page) => page.notifications);
      return {
        notifications: allNotifications,
        grouped: groupNotificationsByDate(allNotifications),
        unreadCount: data.pages[0]?.unreadCount ?? 0,
        hasMore: data.pages[data.pages.length - 1]?.pagination.page <
          data.pages[data.pages.length - 1]?.pagination.totalPages,
      };
    },
  });
}

/**
 * Get notifications list (single page)
 */
export function useNotifications(filters: NotificationFilters = {}) {
  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => notificationsApi.getNotifications(filters),
    select: (data) => ({
      ...data,
      grouped: groupNotificationsByDate(data.notifications),
    }),
  });
}

/**
 * Get notification by ID
 */
export function useNotification(notificationId: string, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.detail(notificationId),
    queryFn: () => notificationsApi.getNotification(notificationId),
    enabled: enabled && !!notificationId,
  });
}

/**
 * Get unread notification count
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });
}

/**
 * Mark notification as read mutation
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markOneAsRead(notificationId),
    onMutate: async (notificationId) => {
      // Optimistically update the notification as read
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });

      // Snapshot previous values
      const previousLists = queryClient.getQueriesData({ queryKey: notificationKeys.lists() });
      const previousCount = queryClient.getQueryData(notificationKeys.unreadCount());

      // Optimistically update lists
      queryClient.setQueriesData(
        { queryKey: notificationKeys.lists() },
        (old: any) => {
          if (!old?.notifications) return old;
          return {
            ...old,
            notifications: old.notifications.map((n: NotificationDto) =>
              n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
            ),
            unreadCount: Math.max(0, (old.unreadCount || 0) - 1),
          };
        }
      );

      // Optimistically update count
      queryClient.setQueryData(notificationKeys.unreadCount(), (old: any) => {
        if (!old) return old;
        return { ...old, unreadCount: Math.max(0, old.unreadCount - 1) };
      });

      return { previousLists, previousCount };
    },
    onError: (_err, _notificationId, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousCount) {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Mark all notifications as read mutation
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });

      const previousLists = queryClient.getQueriesData({ queryKey: notificationKeys.lists() });
      const previousCount = queryClient.getQueryData(notificationKeys.unreadCount());

      // Optimistically mark all as read
      queryClient.setQueriesData(
        { queryKey: notificationKeys.lists() },
        (old: any) => {
          if (!old?.notifications) return old;
          return {
            ...old,
            notifications: old.notifications.map((n: NotificationDto) => ({
              ...n,
              isRead: true,
              readAt: n.readAt || new Date().toISOString(),
            })),
            unreadCount: 0,
          };
        }
      );

      queryClient.setQueryData(notificationKeys.unreadCount(), (old: any) => {
        if (!old) return old;
        return { ...old, unreadCount: 0 };
      });

      return { previousLists, previousCount };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousCount) {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Delete notification mutation
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * Get notification preferences
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: notificationsApi.getPreferences,
  });
}

/**
 * Update notification preferences mutation
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateNotificationPreferencesRequest) =>
      notificationsApi.updatePreferences(request),
    onSuccess: (data) => {
      queryClient.setQueryData(notificationKeys.preferences(), data);
    },
  });
}

/**
 * Register push token mutation
 */
export function useRegisterPushToken() {
  return useMutation({
    mutationFn: notificationsApi.registerPushToken,
  });
}

/**
 * Unregister push token mutation
 */
export function useUnregisterPushToken() {
  return useMutation({
    mutationFn: notificationsApi.unregisterPushToken,
  });
}
