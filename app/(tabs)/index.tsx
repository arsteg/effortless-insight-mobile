/**
 * Dashboard/Home Screen
 * Shows overview, statistics, and recent activity
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, Clock, FileText, ChevronRight, TrendingUp, CheckSquare } from 'lucide-react-native';
import { useNoticeStatistics, useNoticesInfinite } from '../../src/hooks/useNotices';
import { useMyTasks } from '../../src/hooks/useTasks';
import { useAuthStore } from '../../src/stores';
import { LoadingSpinner, EmptyState } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RISK_COLORS } from '../../src/utils/constants';
import { format, differenceInDays } from 'date-fns';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Fetch dashboard data
  const {
    data: statistics,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useNoticeStatistics();

  const {
    data: noticesData,
    isLoading: noticesLoading,
    refetch: refetchNotices,
  } = useNoticesInfinite({
    sortBy: 'responseDeadline',
    sortOrder: 'asc',
  });

  const {
    data: tasksData,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useMyTasks({ dueWithin: 'week' });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchNotices(), refetchTasks()]);
    setRefreshing(false);
  };

  // Get urgent notices (due within 7 days)
  const urgentNotices = noticesData?.pages[0]?.notices
    .filter((n) => n.daysRemaining !== undefined && n.daysRemaining <= 7)
    .slice(0, 3) || [];

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const isLoading = statsLoading && noticesLoading && tasksLoading;

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading dashboard..." />;
  }

  const stats = statistics || {
    byStatus: {} as Record<string, number>,
    overdueCount: 0,
    dueThisWeek: 0,
    totalCount: 0,
  };

  const byStatus = stats.byStatus as Record<string, number>;
  const activeCount =
    (byStatus['uploaded'] || 0) +
    (byStatus['processing'] || 0) +
    (byStatus['analyzed'] || 0) +
    (byStatus['in_progress'] || 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}!
        </Text>
        <Text style={styles.greetingSubtext}>Here's your compliance overview</Text>
      </View>

      {/* Critical Alert Banner */}
      {stats.overdueCount > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => router.push('/notices?filter=overdue')}
        >
          <AlertCircle color="#dc2626" size={20} />
          <Text style={styles.alertText}>
            {stats.overdueCount} notice{stats.overdueCount > 1 ? 's' : ''} overdue - requires
            immediate attention
          </Text>
          <ChevronRight color="#dc2626" size={20} />
        </TouchableOpacity>
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Active"
          value={activeCount}
          icon={<FileText size={20} color={COLORS.primary} />}
          color={COLORS.primary}
          onPress={() => router.push('/notices')}
        />
        <StatCard
          label="Due Soon"
          value={stats.dueThisWeek}
          icon={<Clock size={20} color={COLORS.warning} />}
          color={COLORS.warning}
          onPress={() => router.push('/notices?filter=due-soon')}
        />
        <StatCard
          label="Overdue"
          value={stats.overdueCount}
          icon={<AlertCircle size={20} color={COLORS.error} />}
          color={COLORS.error}
          onPress={() => router.push('/notices?filter=overdue')}
        />
      </View>

      {/* Upcoming Deadlines */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Deadlines</Text>
          <TouchableOpacity onPress={() => router.push('/notices')}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {urgentNotices.length > 0 ? (
          urgentNotices.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} onPress={() => router.push(`/notices/${notice.id}`)} />
          ))
        ) : (
          <View style={styles.emptySection}>
            <CheckSquare size={32} color={COLORS.success} />
            <Text style={styles.emptySectionText}>No urgent deadlines</Text>
          </View>
        )}
      </View>

      {/* My Tasks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Tasks This Week</Text>
          <TouchableOpacity onPress={() => router.push('/tasks')}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {tasksData?.tasks && tasksData.tasks.length > 0 ? (
          tasksData.tasks.slice(0, 3).map((task) => (
            <TaskCard key={task.id} task={task} onPress={() => router.push(`/notices/${task.notice.id}`)} />
          ))
        ) : (
          <View style={styles.emptySection}>
            <CheckSquare size={32} color={COLORS.success} />
            <Text style={styles.emptySectionText}>All tasks completed!</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickActionButton
            label="Upload Notice"
            icon={<FileText size={24} color={COLORS.primary} />}
            onPress={() => router.push('/upload')}
          />
          <QuickActionButton
            label="View Tasks"
            icon={<CheckSquare size={24} color={COLORS.primary} />}
            onPress={() => router.push('/tasks')}
          />
          <QuickActionButton
            label="Analytics"
            icon={<TrendingUp size={24} color={COLORS.primary} />}
            onPress={() => {}}
          />
        </View>
      </View>

      {/* Bottom padding */}
      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  color,
  onPress,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// Notice Card Component
function NoticeCard({
  notice,
  onPress,
}: {
  notice: { id: string; noticeType?: string; daysRemaining?: number; taxAmount?: number; riskLevel?: string };
  onPress: () => void;
}) {
  const getRiskColor = (risk?: string) => {
    if (!risk) return COLORS.gray[400];
    return RISK_COLORS[risk as keyof typeof RISK_COLORS] || COLORS.gray[400];
  };

  return (
    <TouchableOpacity style={styles.noticeCard} onPress={onPress}>
      <View style={styles.noticeIcon}>
        <FileText color={COLORS.gray[500]} size={24} />
      </View>
      <View style={styles.noticeInfo}>
        <Text style={styles.noticeType}>{notice.noticeType || 'Notice'}</Text>
        <Text style={styles.noticeAmount}>
          {notice.taxAmount ? `₹${(notice.taxAmount / 100000).toFixed(1)}L` : '-'}
        </Text>
      </View>
      <View style={styles.noticeDeadline}>
        <View style={[styles.riskBadge, { backgroundColor: getRiskColor(notice.riskLevel) }]}>
          <Clock color={COLORS.white} size={12} />
          <Text style={styles.riskBadgeText}>
            {notice.daysRemaining !== undefined ? `${notice.daysRemaining} days` : '-'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Task Card Component
function TaskCard({
  task,
  onPress,
}: {
  task: { id: string; title: string; notice: { noticeType?: string }; priority: string; isOverdue: boolean };
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.taskCard} onPress={onPress}>
      <View style={[styles.taskPriority, { backgroundColor: RISK_COLORS[task.priority as keyof typeof RISK_COLORS] || COLORS.gray[400] }]} />
      <View style={styles.taskInfo}>
        <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
        <Text style={styles.taskNotice}>{task.notice.noticeType || 'Notice'}</Text>
      </View>
      {task.isOverdue && (
        <View style={styles.overdueTag}>
          <Text style={styles.overdueText}>Overdue</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Quick Action Button Component
function QuickActionButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      {icon}
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  greeting: {
    padding: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  greetingText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  greetingSubtext: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primaryLight,
    marginTop: 4,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  alertText: {
    flex: 1,
    marginLeft: SPACING.sm,
    color: '#dc2626',
    fontWeight: '500',
    fontSize: FONT_SIZES.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statIcon: {
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  section: {
    padding: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  sectionLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  emptySection: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptySectionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  noticeIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  noticeType: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  noticeAmount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  noticeDeadline: {
    alignItems: 'flex-end',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  riskBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: COLORS.white,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  taskPriority: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: SPACING.md,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  taskNotice: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  overdueTag: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  overdueText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    gap: SPACING.sm,
  },
  quickActionLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[700],
    fontWeight: '500',
  },
});
