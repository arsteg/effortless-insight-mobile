/**
 * Tasks Screen
 * Shows user's assigned tasks across all notices
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CheckSquare, Clock, AlertCircle, ChevronRight } from 'lucide-react-native';
import { useMyTasksInfinite, useUpdateTask } from '../../src/hooks/useTasks';
import { LoadingSpinner, EmptyState } from '../../src/components/common';
import { useUIStore } from '../../src/stores';
import { MyTaskDto, TaskStatus, TaskPriority } from '../../src/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, PRIORITY_COLORS } from '../../src/utils/constants';

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'To Do', value: 'todo' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
];

export default function TasksScreen() {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const queryParams = useMemo(() => {
    const p: { status?: string; priority?: string; dueWithin?: string } = {};
    if (selectedFilter !== 'all') {
      p.status = selectedFilter;
    }
    return p;
  }, [selectedFilter]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useMyTasksInfinite(queryParams);

  const updateTask = useUpdateTask();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({
        taskId,
        data: { status: newStatus },
      });
    } catch (error) {
      // Distinguish an offline-queued update from a real failure and tell the
      // user, instead of silently swallowing it (audit B3).
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('offline')) {
        showToast('info', 'Saved offline — this task will update when you reconnect.');
      } else {
        showToast('error', 'Failed to update task. Please try again.');
      }
    }
  };

  const tasks = useMemo(() => {
    return data?.pages.flatMap((page) => page.tasks) || [];
  }, [data]);

  const renderTask = useCallback(
    ({ item }: { item: MyTaskDto }) => (
      <TaskCard
        task={item}
        onPress={() => router.push(`/notices/${item.notice.id}`)}
        onStatusChange={(status) => handleStatusChange(item.id, status)}
        isUpdating={updateTask.isPending}
      />
    ),
    [router, updateTask.isPending]
  );

  const keyExtractor = useCallback((item: MyTaskDto) => item.id, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.filterTab,
              selectedFilter === option.value && styles.filterTabActive,
            ]}
            onPress={() => setSelectedFilter(option.value)}
          >
            <Text
              style={[
                styles.filterTabText,
                selectedFilter === option.value && styles.filterTabTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data?.pages[0]?.pagination.totalItems || 0}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.error }]}>
            {tasks.filter((t) => t.isOverdue).length}
          </Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <LoadingSpinner size="small" />
      </View>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading tasks..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={<EmptyState type="tasks" />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function TaskCard({
  task,
  onPress,
  onStatusChange,
  isUpdating,
}: {
  task: MyTaskDto;
  onPress: () => void;
  onStatusChange: (status: TaskStatus) => void;
  isUpdating: boolean;
}) {
  const getPriorityColor = (priority: TaskPriority) => {
    return PRIORITY_COLORS[priority] || COLORS.gray[400];
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'done':
        return <CheckSquare size={20} color={COLORS.success} />;
      case 'in_progress':
        return <Clock size={20} color={COLORS.warning} />;
      default:
        return <View style={styles.todoIcon} />;
    }
  };

  const handleToggleComplete = () => {
    if (isUpdating) return;
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    onStatusChange(newStatus);
  };

  return (
    <TouchableOpacity style={styles.taskCard} onPress={onPress}>
      <TouchableOpacity
        style={styles.taskCheckbox}
        onPress={handleToggleComplete}
        disabled={isUpdating}
      >
        {getStatusIcon(task.status)}
      </TouchableOpacity>

      <View style={styles.taskContent}>
        <View style={styles.taskHeader}>
          <Text
            style={[
              styles.taskTitle,
              task.status === 'done' && styles.taskTitleDone,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          <View
            style={[
              styles.priorityDot,
              { backgroundColor: getPriorityColor(task.priority) },
            ]}
          />
        </View>

        <View style={styles.taskMeta}>
          <Text style={styles.noticeRef}>
            {task.notice.noticeType || 'Notice'} #{task.notice.noticeNumber?.slice(0, 8) || '...'}
          </Text>
          {task.dueDate && (
            <View style={styles.dueDateContainer}>
              <Clock size={12} color={task.isOverdue ? COLORS.error : COLORS.gray[400]} />
              <Text
                style={[
                  styles.dueDate,
                  task.isOverdue && styles.dueDateOverdue,
                ]}
              >
                {new Date(task.dueDate).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {task.isOverdue && (
          <View style={styles.overdueTag}>
            <AlertCircle size={12} color={COLORS.error} />
            <Text style={styles.overdueText}>Overdue</Text>
          </View>
        )}
      </View>

      <ChevronRight size={20} color={COLORS.gray[300]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    backgroundColor: COLORS.white,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[100],
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  filterTabTextActive: {
    color: COLORS.white,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  list: {
    paddingBottom: SPACING.xxl,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  taskCheckbox: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  todoIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
  },
  taskContent: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  taskTitle: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
    lineHeight: 20,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: COLORS.gray[400],
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  noticeRef: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  dueDateOverdue: {
    color: COLORS.error,
    fontWeight: '500',
  },
  overdueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  overdueText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    fontWeight: '500',
  },
  footer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
});
