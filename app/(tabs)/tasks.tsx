/**
 * Tasks Screen
 * Shows user's assigned tasks across all notices
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  ChevronRight,
  ArrowUpDown,
  Ban,
  PauseCircle,
  Archive,
  XCircle,
  Check,
  X,
  Plus,
} from 'lucide-react-native';
import { useMyTasksInfinite, useUpdateTask } from '../../src/hooks/useTasks';
import { LoadingSpinner, EmptyState } from '../../src/components/common';
import { useUIStore } from '../../src/stores';
import { cancelTaskReminders, scheduleTaskReminders } from '../../src/services/taskReminders';
import { AddTaskSheet } from '../../src/components/tasks/AddTaskSheet';
import { MyTaskDto, TaskStatus, TaskPriority } from '../../src/types';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  SORT_OPTIONS,
  TaskSort,
  sortTasks,
  statusLabel,
  statusColor,
  priorityLabel,
  priorityColor,
  getStatusOptions,
  isClosedStatus,
  formatDueDate,
  resolveCheckboxAction,
  buildTaskListRows,
  TaskListRow,
} from '../../src/utils/taskDisplay';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';

/**
 * Status filters. Every status the API can return is offered — previously only
 * three were, so a `blocked` or `on_hold` task could not be filtered for and
 * appeared under "All" with no way to isolate it (TC-MOB-043).
 */
const STATUS_FILTERS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'All', value: 'all' },
  ...TASK_STATUSES.map((status) => ({ label: statusLabel(status), value: status })),
];

const PRIORITY_FILTERS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Any priority', value: 'all' },
  ...TASK_PRIORITIES.map((priority) => ({ label: priorityLabel(priority), value: priority })),
];

export default function TasksScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<TaskSort>('priority');
  const [showAddTask, setShowAddTask] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [statusPickerFor, setStatusPickerFor] = useState<MyTaskDto | null>(null);

  const queryParams = useMemo(() => {
    const p: { status?: string; priority?: string; dueWithin?: string } = {};
    if (selectedFilter !== 'all') {
      p.status = selectedFilter;
    }
    if (selectedPriority !== 'all') {
      p.priority = selectedPriority;
    }
    return p;
  }, [selectedFilter, selectedPriority]);

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

  /**
   * Apply a status change.
   *
   * `previousStatus` drives the Undo on the toast: a one-tap complete needs a
   * one-tap reversal, and after a mis-tap the user may not remember what the
   * status was (TC-MOB-045). Undo is itself a status change, so it is applied
   * without offering a further undo.
   */
  const handleStatusChange = useCallback(
    async (taskId: string, newStatus: TaskStatus, previousStatus?: TaskStatus, task?: MyTaskDto) => {
      try {
        await updateTask.mutateAsync({
          taskId,
          data: { status: newStatus },
        });

        // Reminders follow the task's state: a finished task must stop firing
        // them, and reopening one puts them back (TC-MOB-048).
        if (isClosedStatus(newStatus)) {
          void cancelTaskReminders(taskId);
        } else if (task?.dueDate) {
          void scheduleTaskReminders(taskId, task.title, task.dueDate, task.priority);
        }

        const undo =
          previousStatus && previousStatus !== newStatus
            ? {
                label: 'Undo',
                onPress: () => {
                  void handleStatusChangeRef.current?.(taskId, previousStatus, undefined, task);
                },
              }
            : undefined;

        // Long enough to notice and reach for, short enough not to linger.
        showToast('success', `Moved to ${statusLabel(newStatus)}`, 6000, undo);
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
    },
    [updateTask, showToast]
  );

  // Lets the Undo handler call back into the current version of the callback
  // without making the callback depend on itself.
  const handleStatusChangeRef = useRef(handleStatusChange);
  useEffect(() => {
    handleStatusChangeRef.current = handleStatusChange;
  }, [handleStatusChange]);

  /** Checkbox tap: complete or reopen when unambiguous, else open the picker. */
  const handleCheckboxPress = useCallback(
    (task: MyTaskDto) => {
      const action = resolveCheckboxAction(task.status);
      if (action.kind === 'picker') {
        setStatusPickerFor(task);
        return;
      }
      void handleStatusChange(task.id, action.status, task.status, task);
    },
    [handleStatusChange]
  );

  /**
   * Sorting runs over the pages already fetched: the API has no `sortBy`
   * parameter, so this reorders what is loaded rather than re-querying.
   */
  const tasks = useMemo(() => {
    const loaded = data?.pages.flatMap((page) => page.tasks) || [];
    return sortTasks(loaded, sortBy);
  }, [data, sortBy]);

  /** Open tasks, then a "Completed" header, then the finished ones. */
  const rows = useMemo(() => buildTaskListRows(tasks), [tasks]);

  const renderRow = useCallback(
    ({ item }: { item: TaskListRow<MyTaskDto> }) => {
      if (item.kind === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{item.title}</Text>
            <Text style={styles.sectionHeaderCount}>{item.count}</Text>
          </View>
        );
      }

      return (
        <TaskCard
          task={item.task}
          onPress={() => router.push(`/notices/${item.task.notice.id}`)}
          onToggleComplete={() => handleCheckboxPress(item.task)}
          onOpenStatusPicker={() => setStatusPickerFor(item.task)}
          isUpdating={updateTask.isPending}
        />
      );
    },
    [router, updateTask.isPending, handleCheckboxPress]
  );

  const keyExtractor = useCallback(
    (item: TaskListRow<MyTaskDto>) =>
      item.kind === 'header' ? `header-${item.title}` : item.task.id,
    []
  );

  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'Priority';

  const activePriorityLabel =
    PRIORITY_FILTERS.find((option) => option.value === selectedPriority)?.label ??
    'Any priority';

  const renderHeader = () => (
    <View style={styles.header}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_FILTERS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.filterChip,
              selectedFilter === option.value && styles.filterChipActive,
            ]}
            onPress={() => setSelectedFilter(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedFilter === option.value }}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedFilter === option.value && styles.filterChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data?.pages[0]?.pagination.totalItems || 0}</Text>
          <Text style={styles.statLabel}>{t('tasks.total')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.error }]}>
            {tasks.filter((t) => t.isOverdue).length}
          </Text>
          {/* "shown" because this counts the loaded pages, not the whole set. */}
          <Text style={styles.statLabel}>{t('tasks.overdueShown')}</Text>
        </View>

        {/* Priority lived in its own chip row, which added a third row to the
            header and made it noticeably taller. It is a menu now, so the
            header keeps the two rows it always had. */}
        <TouchableOpacity
          style={[styles.sortButton, selectedPriority !== 'all' && styles.sortButtonActive]}
          onPress={() => setPriorityMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Priority filter: ${activePriorityLabel}. Change`}
        >
          {selectedPriority !== 'all' && (
            <View
              style={[styles.priorityDot, { backgroundColor: priorityColor(selectedPriority) }]}
            />
          )}
          <Text style={styles.sortButtonText}>{activePriorityLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${activeSortLabel}. Change sort order`}
        >
          <ArrowUpDown size={14} color={COLORS.gray[600]} />
          <Text style={styles.sortButtonText}>{activeSortLabel}</Text>
        </TouchableOpacity>
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
    return <LoadingSpinner fullScreen message={t('tasks.loadingTasks')} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        renderItem={renderRow}
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

      {/* The task list had no way to add a task at all: creation only existed
          on the notice screen and the calendar, so "Tap Create Task" from the
          task list had nowhere to happen (TC-MOB-044). */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddTask(true)}
        accessibilityRole="button"
        accessibilityLabel="Create task"
      >
        <Plus size={26} color={COLORS.white} />
      </TouchableOpacity>

      <AddTaskSheet
        visible={showAddTask}
        onClose={() => setShowAddTask(false)}
        onCreated={() => {
          setShowAddTask(false);
          void refetch();
        }}
      />

      <SortMenu
        visible={sortMenuOpen}
        current={sortBy}
        onSelect={(value) => {
          setSortBy(value);
          setSortMenuOpen(false);
        }}
        onClose={() => setSortMenuOpen(false)}
      />

      <PriorityMenu
        visible={priorityMenuOpen}
        current={selectedPriority}
        onSelect={(value) => {
          setSelectedPriority(value);
          setPriorityMenuOpen(false);
        }}
        onClose={() => setPriorityMenuOpen(false)}
      />

      <StatusPicker
        task={statusPickerFor}
        onSelect={(status) => {
          const task = statusPickerFor;
          setStatusPickerFor(null);
          if (task) void handleStatusChange(task.id, status, task.status, task);
        }}
        onClose={() => setStatusPickerFor(null)}
      />
    </View>
  );
}

/** Icon for a status. Every status has one — no silent default branch. */
function StatusIcon({ status, size = 20 }: { status: TaskStatus; size?: number }) {
  const styles = useThemedStyles(createStyles);
  const color = statusColor(status);

  switch (status) {
    case 'done':
      return <CheckSquare size={size} color={color} />;
    case 'in_progress':
      return <Clock size={size} color={color} />;
    case 'blocked':
      return <Ban size={size} color={color} />;
    case 'on_hold':
      return <PauseCircle size={size} color={color} />;
    case 'archived':
      return <Archive size={size} color={color} />;
    case 'cancelled':
      return <XCircle size={size} color={color} />;
    case 'todo':
    default:
      return <View style={styles.todoIcon} />;
  }
}

function TaskCard({
  task,
  onPress,
  onToggleComplete,
  onOpenStatusPicker,
  isUpdating,
}: {
  task: MyTaskDto;
  onPress: () => void;
  onToggleComplete: () => void;
  onOpenStatusPicker: () => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const dueDate = formatDueDate(task.dueDate);
  const checkboxAction = resolveCheckboxAction(task.status);

  const checkboxLabel =
    checkboxAction.kind === 'picker'
      ? `Status: ${statusLabel(task.status)}. Change status`
      : `Mark ${statusLabel(checkboxAction.status)}`;

  return (
    <TouchableOpacity style={styles.taskCard} onPress={onPress}>
      {/*
        One tap completes or reopens where that is unambiguous; from `blocked`
        or `on_hold` it opens the picker instead, because the app cannot guess
        what the opposite of blocked is (TC-MOB-043 / TC-MOB-045).
      */}
      <TouchableOpacity
        style={styles.taskCheckbox}
        onPress={onToggleComplete}
        disabled={isUpdating}
        accessibilityRole="button"
        accessibilityLabel={checkboxLabel}
      >
        <StatusIcon status={task.status} />
      </TouchableOpacity>

      <View style={styles.taskContent}>
        <Text
          style={[
            styles.taskTitle,
            task.status === 'done' && styles.taskTitleDone,
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        {/* Priority and status as text, not colour alone. */}
        <View style={styles.badgeRow}>
          <View style={styles.priorityBadge}>
            <View
              style={[styles.priorityDot, { backgroundColor: priorityColor(task.priority) }]}
            />
            <Text style={[styles.priorityBadgeText, { color: priorityColor(task.priority) }]}>
              {priorityLabel(task.priority)}
            </Text>
          </View>

          {/* The pill is the way to any status the checkbox does not offer. */}
          <TouchableOpacity
            style={[styles.statusBadge, { borderColor: statusColor(task.status) }]}
            onPress={onOpenStatusPicker}
            disabled={isUpdating}
            accessibilityRole="button"
            accessibilityLabel={`Status: ${statusLabel(task.status)}. Change status`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.statusBadgeText, { color: statusColor(task.status) }]}>
              {statusLabel(task.status)}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.taskMeta}>
          <Text style={styles.noticeRef} numberOfLines={1}>
            {task.notice.noticeType || 'Notice'} #{task.notice.noticeNumber?.slice(0, 8) || '...'}
          </Text>
          {dueDate ? (
            <View style={styles.dueDateContainer}>
              <Clock size={12} color={task.isOverdue ? COLORS.error : COLORS.gray[400]} />
              <Text
                style={[
                  styles.dueDate,
                  task.isOverdue && styles.dueDateOverdue,
                ]}
              >
                {dueDate}
              </Text>
            </View>
          ) : (
            <Text style={styles.noDueDate}>{t('tasks.noDueDate')}</Text>
          )}
        </View>

        {task.isOverdue && (
          <View style={styles.overdueTag}>
            <AlertCircle size={12} color={COLORS.error} />
            <Text style={styles.overdueText}>{t('tasks.overdue')}</Text>
          </View>
        )}
      </View>

      <ChevronRight size={20} color={COLORS.gray[300]} />
    </TouchableOpacity>
  );
}

/** Same shape as SortMenu — a filter that costs no header height. */
function PriorityMenu({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuCard}>
          <Text style={styles.menuTitle}>{t('tasks.priority')}</Text>

          {PRIORITY_FILTERS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.menuRow}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: current === option.value }}
            >
              <View style={styles.menuRowLabel}>
                {option.value !== 'all' && (
                  <View
                    style={[styles.priorityDot, { backgroundColor: priorityColor(option.value) }]}
                  />
                )}
                <Text
                  style={[
                    styles.menuRowText,
                    current === option.value && styles.menuRowTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </View>
              {current === option.value && <Check size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function SortMenu({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: TaskSort;
  onSelect: (value: TaskSort) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuCard}>
          <Text style={styles.menuTitle}>{t('tasks.sortBy')}</Text>

          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.menuRow}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: current === option.value }}
            >
              <Text
                style={[
                  styles.menuRowText,
                  current === option.value && styles.menuRowTextActive,
                ]}
              >
                {option.label}
              </Text>
              {current === option.value && <Check size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          ))}

          <Text style={styles.menuNote}>{t('tasks.sortsTheTasksLoadedSoFar')}</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function StatusPicker({
  task,
  onSelect,
  onClose,
}: {
  task: MyTaskDto | null;
  onSelect: (status: TaskStatus) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  return (
    <Modal
      visible={task !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>{t('tasks.changeStatus')}</Text>
              {task && (
                <Text style={styles.sheetSubtitle} numberOfLines={1}>
                  {task.title}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={22} color={COLORS.gray[500]} />
            </TouchableOpacity>
          </View>

          {task &&
            getStatusOptions(task.status).map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.sheetRow}
                onPress={() => onSelect(status)}
                accessibilityRole="button"
              >
                <StatusIcon status={status} size={18} />
                <Text style={styles.sheetRowText}>{statusLabel(status)}</Text>
              </TouchableOpacity>
            ))}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  // Bottom-right, clear of the tab bar, so it never sits over the last row.
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    backgroundColor: COLORS.white,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  sortButtonActive: {
    borderColor: COLORS.primary,
  },
  menuRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sortButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
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
  taskTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
    lineHeight: 20,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: COLORS.gray[400],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 6,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  noticeRef: {
    flex: 1,
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
  noDueDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[400],
    fontStyle: 'italic',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionHeaderText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[400],
  },
  footer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  menuTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  menuRowText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.gray[800],
  },
  menuRowTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  menuNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    marginTop: SPACING.sm,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sheetHeaderText: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  sheetSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  sheetRowText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.gray[800],
  },
});
