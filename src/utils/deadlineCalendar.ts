/**
 * Deadline calendar data model (TC-MOB-047).
 *
 * Ports the web app's `/calendar` page to mobile. The web version reads
 * `dashboard.deadlines.next7Days`, which the API caps at seven days and twenty
 * rows — fine for a "what's coming up" panel, wrong for a month grid, where
 * paging to the next month would always show an empty calendar.
 *
 * So mobile assembles its own month window from the notices and tasks lists,
 * which do accept a date range, and buckets them here. Bucketing is pure so the
 * awkward parts — local-vs-UTC day boundaries, priority precedence, overdue
 * detection — are testable without rendering a grid.
 */

import type { NoticePriority, TaskPriority } from '../types/api';
import { priorityRank } from './taskDisplay';

export type CalendarItemType = 'notice' | 'task';

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  /** ISO instant of the deadline. */
  dueDate: string;
  priority: string;
  /** Where tapping the item should go. Tasks carry their parent notice. */
  noticeId: string;
  noticeNumber?: string;
  status?: string;
  isOverdue: boolean;
}

/** Which item types the calendar is showing. Mirrors the web's toggles. */
export interface TypeFilters {
  notices: boolean;
  tasks: boolean;
}

export const ALL_TYPES: TypeFilters = { notices: true, tasks: true };

/**
 * A day's key, `YYYY-MM-DD`, in LOCAL time.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that converts to UTC first, so
 * for anyone east of Greenwich a deadline late in the evening lands on the
 * following day in the grid — the notice due the 15th shows under the 16th.
 */
export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Day key for an ISO string, or undefined when it cannot be parsed. */
export function dayKeyFromIso(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return dayKey(date);
}

/** Items grouped by local day. */
export type ItemsByDay = Record<string, CalendarItem[]>;

/**
 * Group items into day buckets.
 *
 * Within a day, the highest priority sorts first so the dot colour and the
 * first row of the detail list both lead with the most urgent thing.
 */
export function groupItemsByDay(items: CalendarItem[]): ItemsByDay {
  const buckets: ItemsByDay = {};

  items.forEach((item) => {
    const key = dayKeyFromIso(item.dueDate);
    if (!key) return; // An unparseable date belongs on no day.
    (buckets[key] ??= []).push(item);
  });

  Object.values(buckets).forEach((dayItems) => {
    dayItems.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  });

  return buckets;
}

/** Apply the notices/tasks toggles. */
export function filterByType(items: CalendarItem[], filters: TypeFilters): CalendarItem[] {
  return items.filter((item) =>
    item.type === 'notice' ? filters.notices : filters.tasks
  );
}

/**
 * The priority that should colour a day's marker: the most urgent item on it.
 * Undefined for an empty day, so the caller can skip the dot entirely.
 */
export function dayPriority(items: CalendarItem[] | undefined): string | undefined {
  if (!items || items.length === 0) return undefined;
  return items.reduce((highest, item) =>
    priorityRank(item.priority) < priorityRank(highest.priority) ? item : highest
  ).priority;
}

/** How many of each type are present — drives the filter row's counts. */
export function countByType(items: CalendarItem[]): { notices: number; tasks: number } {
  return {
    notices: items.filter((i) => i.type === 'notice').length,
    tasks: items.filter((i) => i.type === 'task').length,
  };
}

/**
 * First and last instant of a month, as ISO strings for the API's date filter.
 * `month` is 0-based, matching `Date`.
 */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/** Shape taken from a notice list row. */
export interface NoticeLike {
  id: string;
  noticeNumber?: string;
  noticeType?: string;
  responseDeadline?: string;
  priority?: NoticePriority | string;
  status?: string;
}

/** Shape taken from a `/tasks/my` row. */
export interface TaskLike {
  id: string;
  title: string;
  dueDate?: string;
  priority: TaskPriority | string;
  status: string;
  isOverdue?: boolean;
  notice: { id: string; noticeNumber?: string };
}

/** Statuses that take a notice off the calendar — it needs no more action. */
const INACTIVE_NOTICE_STATUSES = new Set(['closed', 'archived']);

/** Statuses that take a task off the calendar. */
const INACTIVE_TASK_STATUSES = new Set(['done', 'cancelled', 'archived']);

function isPast(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}

/**
 * Notices with a response deadline, as calendar items.
 *
 * Notices already closed or archived are dropped: their deadline is history,
 * and leaving them on the grid buries the ones that still need work.
 */
export function noticesToCalendarItems(
  notices: NoticeLike[],
  now: Date = new Date()
): CalendarItem[] {
  return notices
    .filter((n) => !!n.responseDeadline)
    .filter((n) => !INACTIVE_NOTICE_STATUSES.has((n.status ?? '').toLowerCase()))
    .map((n) => ({
      id: `notice-${n.id}`,
      type: 'notice' as const,
      title: n.noticeNumber || n.noticeType || 'Notice',
      dueDate: n.responseDeadline!,
      priority: (n.priority as string) || 'medium',
      noticeId: n.id,
      noticeNumber: n.noticeNumber,
      status: n.status,
      isOverdue: isPast(n.responseDeadline!, now),
    }));
}

/** Tasks with a due date, as calendar items. */
export function tasksToCalendarItems(
  tasks: TaskLike[],
  now: Date = new Date()
): CalendarItem[] {
  return tasks
    .filter((t) => !!t.dueDate)
    .filter((t) => !INACTIVE_TASK_STATUSES.has((t.status ?? '').toLowerCase()))
    .map((t) => ({
      id: `task-${t.id}`,
      type: 'task' as const,
      title: t.title,
      dueDate: t.dueDate!,
      priority: t.priority,
      noticeId: t.notice.id,
      noticeNumber: t.notice.noticeNumber,
      status: t.status,
      // Trust the server's flag when it sent one; it owns the definition.
      isOverdue: t.isOverdue ?? isPast(t.dueDate!, now),
    }));
}
