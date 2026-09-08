/**
 * Deadline Calendar (TC-MOB-047)
 *
 * Mobile port of the web app's /calendar page. Same idea — one month grid
 * carrying both notice deadlines and task due dates, tap a day to see what
 * falls on it — adapted to a phone: the web's right-hand sidebar becomes a
 * panel below the grid, and its month/week switch is dropped, since a week view
 * on a narrow screen is just a list with extra steps.
 *
 * The data source differs deliberately. The web reads the dashboard's
 * `next7Days`, which the API caps at 7 days and 20 rows, so paging to another
 * month there shows nothing. This fetches the visible month's notices and tasks
 * directly.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckSquare,
  CalendarDays,
  AlertCircle,
  Plus,
} from 'lucide-react-native';
import { useNotices } from '../src/hooks/useNotices';
import { useMyTasksInfinite } from '../src/hooks/useTasks';
import { LoadingSpinner } from '../src/components/common';
import { AddTaskSheet } from '../src/components/tasks/AddTaskSheet';
import {
  WEEKDAY_LABELS,
  MONTH_LABELS,
  buildMonthGrid,
  shiftMonth,
  isSameDay,
} from '../src/utils/calendar';
import {
  CalendarItem,
  TypeFilters,
  ALL_TYPES,
  dayKey,
  groupItemsByDay,
  filterByType,
  dayPriority,
  countByType,
  monthRange,
  noticesToCalendarItems,
  tasksToCalendarItems,
} from '../src/utils/deadlineCalendar';
import { priorityColor, priorityLabel, formatDueDate } from '../src/utils/taskDisplay';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../src/utils/constants';
import { useColors, useThemedStyles } from '../src/theme/useTheme';
import type { Palette } from '../src/theme/palettes';
import { useTranslation } from '../src/hooks';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [selectedKey, setSelectedKey] = useState<string | null>(() => dayKey(today));
  const [filters, setFilters] = useState<TypeFilters>(ALL_TYPES);
  const [addingTask, setAddingTask] = useState(false);

  const range = useMemo(() => monthRange(cursor.year, cursor.month), [cursor]);

  // Notices are filtered server-side to the visible month.
  const {
    data: noticesData,
    isLoading: noticesLoading,
    refetch: refetchNotices,
  } = useNotices({
    dueAfter: range.from,
    dueBefore: range.to,
    pageSize: 100,
    sortBy: 'responseDeadline',
    sortOrder: 'asc',
  });

  // `/tasks/my` has no date-range filter (only today/week/month), so a page is
  // fetched and bucketed client-side. 100 covers a normal month comfortably.
  const {
    data: tasksData,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useMyTasksInfinite({});

  const items = useMemo(() => {
    const notices = noticesToCalendarItems(noticesData?.notices ?? [], today);
    const tasks = tasksToCalendarItems(
      tasksData?.pages.flatMap((page) => page.tasks) ?? [],
      today
    );
    return [...notices, ...tasks];
  }, [noticesData, tasksData, today]);

  const visibleItems = useMemo(() => filterByType(items, filters), [items, filters]);
  const byDay = useMemo(() => groupItemsByDay(visibleItems), [visibleItems]);
  const counts = useMemo(() => countByType(items), [items]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const selectedItems = selectedKey ? byDay[selectedKey] ?? [] : [];

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchNotices(), refetchTasks()]);
    setRefreshing(false);
  }, [refetchNotices, refetchTasks]);

  const goToToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedKey(dayKey(today));
  };

  const isLoading = noticesLoading || tasksLoading;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Deadline Calendar' }} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={COLORS.gray[700]} />
          </TouchableOpacity>

          <TouchableOpacity onPress={goToToday} accessibilityRole="button">
            <Text style={styles.monthLabel}>
              {MONTH_LABELS[cursor.month]} {cursor.year}
            </Text>
            <Text style={styles.todayHint}>{t('calendar.tapForToday')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronRight size={24} color={COLORS.gray[700]} />
          </TouchableOpacity>
        </View>

        {/* Type filters */}
        <View style={styles.filterRow}>
          <FilterChip
            active={filters.notices}
            label={t('calendar.notices')}
            count={counts.notices}
            icon={<FileText size={14} color={filters.notices ? COLORS.white : COLORS.gray[600]} />}
            onPress={() => setFilters((f) => ({ ...f, notices: !f.notices }))}
          />
          <FilterChip
            active={filters.tasks}
            label={t('calendar.tasks')}
            count={counts.tasks}
            icon={<CheckSquare size={14} color={filters.tasks ? COLORS.white : COLORS.gray[600]} />}
            onPress={() => setFilters((f) => ({ ...f, tasks: !f.tasks }))}
          />
        </View>

        {/* Weekday headings */}
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, index) => (
            <Text key={index} style={styles.weekdayLabel}>
              {label}
            </Text>
          ))}
        </View>

        {/* Month grid */}
        <View style={styles.grid}>
          {cells.map((day, index) => {
            if (day === null) {
              return <View key={`blank-${index}`} style={styles.cell} />;
            }

            const date = new Date(cursor.year, cursor.month, day);
            const key = dayKey(date);
            const dayItems = byDay[key];
            const marker = dayPriority(dayItems);
            const isSelected = selectedKey === key;
            const isToday = isSameDay(date, today);

            return (
              <TouchableOpacity
                key={day}
                style={styles.cell}
                onPress={() => setSelectedKey(key)}
                accessibilityRole="button"
                accessibilityLabel={
                  `${day} ${MONTH_LABELS[cursor.month]}` +
                  (dayItems?.length ? `, ${dayItems.length} item${dayItems.length > 1 ? 's' : ''}` : '')
                }
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isToday && styles.dayCircleToday,
                    isSelected && styles.dayCircleSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isToday && styles.dayTextToday,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </View>

                {/*
                  One dot coloured by the day's most urgent item, plus a count
                  when there is more than one. A phone cell cannot fit the web's
                  three preview rows.
                */}
                <View style={styles.markerRow}>
                  {marker ? (
                    <>
                      <View style={[styles.marker, { backgroundColor: priorityColor(marker) }]} />
                      {dayItems && dayItems.length > 1 && (
                        <Text style={styles.markerCount}>{dayItems.length}</Text>
                      )}
                    </>
                  ) : (
                    <View style={styles.markerSpacer} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading && (
          <View style={styles.loading}>
            <LoadingSpinner size="small" />
          </View>
        )}

        {/* Selected day detail */}
        <View style={styles.detail}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>
              {selectedKey ? formatSelectedDate(selectedKey) : 'Select a date'}
            </Text>

            {/*
              Only offered for today and later. The API rejects a due date in
              the past ("Due date must be in the future"), so an Add button on a
              past day could only ever produce an error (TC-MOB-048).
            */}
            {selectedKey && !isPastKey(selectedKey, today) && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setAddingTask(true)}
                accessibilityRole="button"
                accessibilityLabel="Add a task on this date"
              >
                <Plus size={16} color={COLORS.primary} />
                <Text style={styles.addButtonText}>{t('calendar.addTask')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {selectedItems.length === 0 ? (
            <View style={styles.emptyDetail}>
              <CalendarDays size={28} color={COLORS.gray[300]} />
              <Text style={styles.emptyDetailText}>{t('calendar.nothingDueOnThisDate')}</Text>
            </View>
          ) : (
            selectedItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onPress={() => router.push(`/notices/${item.noticeId}`)}
              />
            ))
          )}
        </View>

        {/* Priority legend — the dots mean nothing without it. */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>{t('calendar.priority')}</Text>
          <View style={styles.legendRow}>
            {['critical', 'high', 'medium', 'low'].map((priority) => (
              <View key={priority} style={styles.legendItem}>
                <View style={[styles.marker, { backgroundColor: priorityColor(priority) }]} />
                <Text style={styles.legendLabel}>{priorityLabel(priority)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <AddTaskSheet
        visible={addingTask}
        dueDate={selectedKey ? endOfDayIso(selectedKey) : undefined}
        onClose={() => setAddingTask(false)}
        onCreated={() => {
          void refetchTasks();
        }}
      />
    </View>
  );
}

/** Whether a day key is before today, in local time. */
function isPastKey(key: string, today: Date): boolean {
  const [year, month, day] = key.split('-').map(Number);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return new Date(year, month - 1, day).getTime() < start.getTime();
}

/**
 * A day key as the ISO instant to send as a due date — 23:59:59 local, so a
 * task due "on the 15th" is not overdue at 00:01 that morning.
 */
function endOfDayIso(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function formatSelectedDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function FilterChip({
  active,
  label,
  count,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${count} items, ${active ? 'shown' : 'hidden'}`}
    >
      {icon}
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label} {count}
      </Text>
    </TouchableOpacity>
  );
}

function ItemRow({ item, onPress }: { item: CalendarItem; onPress: () => void }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const Icon = item.type === 'notice' ? FileText : CheckSquare;

  return (
    <TouchableOpacity
      style={[styles.itemRow, { borderLeftColor: priorityColor(item.priority) }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Icon size={16} color={COLORS.gray[500]} />

      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemType}>
            {item.type === 'notice' ? 'Notice' : 'Task'}
          </Text>
          <Text style={styles.itemDot}>·</Text>
          <Text style={[styles.itemPriority, { color: priorityColor(item.priority) }]}>
            {priorityLabel(item.priority)}
          </Text>
          {item.isOverdue && (
            <>
              <Text style={styles.itemDot}>·</Text>
              <View style={styles.overdue}>
                <AlertCircle size={11} color={COLORS.error} />
                <Text style={styles.overdueText}>{t('calendar.overdue')}</Text>
              </View>
            </>
          )}
        </View>
        {item.noticeNumber && item.type === 'task' && (
          <Text style={styles.itemNotice}>{item.noticeNumber}</Text>
        )}
      </View>

      <Text style={styles.itemDue}>{formatDueDate(item.dueDate)}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  scroll: {
    paddingBottom: SPACING.xxl,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  monthLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
    textAlign: 'center',
  },
  todayHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  weekdayRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingTop: SPACING.sm,
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gray[400],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.white,
    paddingBottom: SPACING.md,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.95,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  dayCircleSelected: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  dayTextToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: COLORS.white,
    fontWeight: '700',
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
    height: 12,
  },
  marker: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  markerSpacer: {
    width: 6,
    height: 6,
  },
  markerCount: {
    fontSize: 9,
    color: COLORS.gray[500],
    fontWeight: '600',
  },
  loading: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  detail: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.sm,
    padding: SPACING.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailTitle: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyDetail: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyDetailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[400],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderLeftWidth: 3,
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemType: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
  itemDot: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[300],
  },
  itemPriority: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  overdue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  overdueText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    fontWeight: '600',
  },
  itemNotice: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    marginTop: 2,
  },
  itemDue: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
  },
  legend: {
    padding: SPACING.md,
  },
  legendTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
});
