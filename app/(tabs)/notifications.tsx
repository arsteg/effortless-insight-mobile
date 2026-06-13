/**
 * Notifications Screen
 * Displays notification list with filtering and actions
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  FileText,
  CheckSquare,
  MessageCircle,
  Settings,
  Clock,
} from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { formatDistanceToNow } from 'date-fns';
import {
  useNotificationsInfinite,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '../../src/hooks/useNotifications';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import type { NotificationDto, NotificationType } from '../../src/types/notification';

// Notification type icons
const TYPE_ICONS: Record<string, React.ComponentType<{ color: string; size: number }>> = {
  deadline_reminder: Clock,
  task_assigned: CheckSquare,
  task_completed: Check,
  task_due: AlertTriangle,
  document_requested: FileText,
  document_received: FileText,
  document_overdue: AlertTriangle,
  comment_mention: MessageCircle,
  comment_reply: MessageCircle,
  notice_status_changed: FileText,
  notice_assigned: FileText,
  sla_warning: AlertTriangle,
  sla_breach: AlertTriangle,
  ai_analysis_complete: Check,
  default: Bell,
};

// Priority colors
const PRIORITY_COLORS = {
  critical: COLORS.error,
  high: '#f97316',
  medium: COLORS.warning,
  low: COLORS.gray[400],
};

// Tab options
type TabFilter = 'all' | 'unread';

interface NotificationItemProps {
  notification: NotificationDto;
  onPress: (notification: NotificationDto) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationItem({ notification, onPress, onMarkRead, onDelete }: NotificationItemProps) {
  const IconComponent = TYPE_ICONS[notification.type] || TYPE_ICONS.default;
  const priorityColor = PRIORITY_COLORS[notification.priority] || COLORS.gray[400];

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      {!notification.isRead && (
        <TouchableOpacity
          style={[styles.swipeAction, styles.readAction]}
          onPress={() => onMarkRead(notification.id)}
        >
          <Check color={COLORS.white} size={20} />
          <Text style={styles.swipeActionText}>Read</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.swipeAction, styles.deleteAction]}
        onPress={() => onDelete(notification.id)}
      >
        <Trash2 color={COLORS.white} size={20} />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <Pressable
        style={[
          styles.notificationItem,
          !notification.isRead && styles.notificationUnread,
        ]}
        onPress={() => onPress(notification)}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${priorityColor}15` }]}>
          <IconComponent color={priorityColor} size={20} />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle} numberOfLines={1}>
              {notification.title}
            </Text>
            {!notification.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {notification.message}
          </Text>
          <Text style={styles.notificationTime}>
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function EmptyState({ filter }: { filter: TabFilter }) {
  return (
    <View style={styles.emptyState}>
      <BellOff color={COLORS.gray[300]} size={64} />
      <Text style={styles.emptyTitle}>
        {filter === 'unread' ? 'All Caught Up!' : 'No Notifications'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === 'unread'
          ? "You've read all your notifications"
          : "You don't have any notifications yet"}
      </Text>
    </View>
  );
}

function NotificationSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonItem}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonMessage} />
            <View style={styles.skeletonTime} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<TabFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useNotificationsInfinite({
    status: filter === 'unread' ? 'unread' : 'all',
    pageSize: 20,
  });

  const { data: unreadData } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = data?.notifications ?? [];
  const unreadCount = unreadData?.count ?? 0;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleNotificationPress = useCallback((notification: NotificationDto) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }

    // Navigate based on notification data
    if (notification.data?.noticeId) {
      router.push(`/notices/${notification.data.noticeId}`);
    } else if (notification.data?.taskId) {
      router.push('/tasks');
    } else if (notification.actionUrl) {
      router.push(notification.actionUrl as any);
    }
  }, [markAsRead]);

  const handleMarkAsRead = useCallback((id: string) => {
    markAsRead.mutate(id);
  }, [markAsRead]);

  const handleDelete = useCallback((id: string) => {
    deleteNotification.mutate(id);
  }, [deleteNotification]);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead.mutate();
  }, [markAllAsRead]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationDto }) => (
      <NotificationItem
        notification={item}
        onPress={handleNotificationPress}
        onMarkRead={handleMarkAsRead}
        onDelete={handleDelete}
      />
    ),
    [handleNotificationPress, handleMarkAsRead, handleDelete]
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Notifications',
            headerRight: () => (
              <TouchableOpacity onPress={() => router.push('/settings/notifications')}>
                <Settings color={COLORS.white} size={24} />
              </TouchableOpacity>
            ),
          }}
        />
        <NotificationSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/settings/notifications')}>
              <Settings color={COLORS.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, filter === 'all' && styles.tabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'unread' && styles.tabActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.tabText, filter === 'unread' && styles.tabTextActive]}>
            Unread
          </Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck
              color={markAllAsRead.isPending ? COLORS.gray[400] : COLORS.primary}
              size={20}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Notification List */}
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<EmptyState filter={filter} />}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[500],
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: SPACING.xs,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  markAllButton: {
    marginLeft: 'auto',
    padding: SPACING.sm,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  notificationUnread: {
    backgroundColor: COLORS.primaryLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  notificationMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    marginTop: SPACING.xs,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  readAction: {
    backgroundColor: COLORS.success,
  },
  deleteAction: {
    backgroundColor: COLORS.error,
  },
  swipeActionText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  skeletonContainer: {
    padding: SPACING.md,
  },
  skeletonItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[200],
    marginRight: SPACING.md,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonTitle: {
    height: 16,
    width: '60%',
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.sm,
  },
  skeletonMessage: {
    height: 14,
    width: '80%',
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  skeletonTime: {
    height: 12,
    width: '30%',
    backgroundColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  loadingFooter: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
});
