/**
 * Task list display rules (TC-MOB-043).
 *
 * The Tasks tab previously carried three problems that all trace back to
 * information living only in an icon or a colour:
 *
 *  1. Priority was an 8px dot with no legend. Orange (high) and yellow
 *     (medium) are not distinguishable at that size, and colour was the only
 *     carrier — so the field failed for anyone who could not resolve it.
 *  2. Status was an icon with three cases, but the API defines seven. A
 *     `blocked` task fell through to the default branch and rendered the empty
 *     to-do checkbox, indistinguishable from an open task.
 *  3. The checkbox toggled `done` <-> `todo`, so tapping it on a blocked task
 *     silently discarded the blocked state.
 *
 * Labels, the full status set, and sorting live here as pure data and pure
 * functions so they can be tested without mounting the screen.
 */

import type { TaskPriority, TaskStatus } from '../types/api';
import { COLORS, PRIORITY_COLORS } from './constants';

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Every status the API can return, in workflow order.
 *
 * Mirrors `TaskStatusValues` in the API. Keep in step with it: a status
 * missing here renders without a label and cannot be filtered for.
 */
export const TASK_STATUSES: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'on_hold',
  'done',
  'cancelled',
  'archived',
] as const;

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  on_hold: 'On Hold',
  done: 'Done',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: COLORS.gray[500],
  in_progress: COLORS.warning,
  blocked: COLORS.error,
  on_hold: COLORS.warning,
  done: COLORS.success,
  cancelled: COLORS.gray[400],
  archived: COLORS.gray[400],
};

/** Human-readable status. Falls back to the raw value rather than blank. */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status as TaskStatus] ?? status.replace(/_/g, ' ');
}

export function statusColor(status: string): string {
  return TASK_STATUS_COLORS[status as TaskStatus] ?? COLORS.gray[400];
}

/**
 * Statuses a task can be moved to from the picker — every status except the
 * one it already has. The API applies no transition map to tasks (unlike
 * notices), so any move is legal.
 */
export function getStatusOptions(current: string): TaskStatus[] {
  return TASK_STATUSES.filter((s) => s !== current);
}

/** Statuses that mean "no longer being worked on". */
export function isClosedStatus(status: string): boolean {
  return status === 'done' || status === 'cancelled' || status === 'archived';
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/** Highest first — the order the server sorts by, and the order to offer. */
export const TASK_PRIORITIES: readonly TaskPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
] as const;

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority as TaskPriority] ?? priority;
}

export function priorityColor(priority: string): string {
  return (PRIORITY_COLORS as Record<string, string>)[priority] ?? COLORS.gray[400];
}

/** Rank used for sorting: critical sorts before low. */
export function priorityRank(priority: string): number {
  const index = TASK_PRIORITIES.indexOf(priority as TaskPriority);
  return index === -1 ? TASK_PRIORITIES.length : index;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type TaskSort = 'priority' | 'dueDate' | 'title';

export const SORT_OPTIONS: ReadonlyArray<{ value: TaskSort; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'title', label: 'Title' },
] as const;

/** Shape `sortTasks` needs. Deliberately narrower than `MyTaskDto`. */
export interface SortableTask {
  title: string;
  priority: string;
  dueDate?: string;
}

/** Milliseconds, or Infinity when there is no usable date. */
function dueMillis(dueDate?: string): number {
  if (!dueDate) return Infinity;
  const value = new Date(dueDate).getTime();
  return Number.isNaN(value) ? Infinity : value;
}

/**
 * Sort a page of tasks.
 *
 * Note this orders only the tasks already loaded — the API has no `sortBy`
 * parameter, so with more than one page loaded the result is a sort of the
 * fetched subset, not of everything assigned. The screen says so next to the
 * control rather than implying a global sort.
 *
 * Never mutates the input. Ties fall through to a stable secondary key so the
 * order does not shuffle between renders.
 */
export function sortTasks<T extends SortableTask>(tasks: T[], sortBy: TaskSort): T[] {
  const sorted = [...tasks];

  switch (sortBy) {
    case 'priority':
      sorted.sort(
        (a, b) =>
          priorityRank(a.priority) - priorityRank(b.priority) ||
          dueMillis(a.dueDate) - dueMillis(b.dueDate)
      );
      break;

    case 'dueDate':
      // Undated tasks sort last: an absent deadline is not an urgent one.
      sorted.sort(
        (a, b) =>
          dueMillis(a.dueDate) - dueMillis(b.dueDate) ||
          priorityRank(a.priority) - priorityRank(b.priority)
      );
      break;

    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Due dates
// ---------------------------------------------------------------------------

/**
 * Short, readable due date — "12 Sep 2026". Returns undefined for a missing or
 * unparseable value so callers can drop the row entirely.
 */
export function formatDueDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/** Server rule: `Length(5, 200)` in `CreateTaskValidator`. */
export const TASK_TITLE_MIN = 5;
export const TASK_TITLE_MAX = 200;

/**
 * Why a title is not acceptable, or undefined when it is.
 *
 * Mirrors the API validator so a title the server will reject is caught in the
 * form. Previously the button only checked for a non-empty string, so a title
 * like "Fix" was submitted and came back as a 400 the user could not interpret
 * (TC-MOB-044).
 */
export function validateTaskTitle(title: string): string | undefined {
  const trimmed = title.trim();

  if (trimmed.length === 0) return undefined; // Empty is "not started", not an error.
  if (trimmed.length < TASK_TITLE_MIN) {
    return `Use at least ${TASK_TITLE_MIN} characters`;
  }
  if (trimmed.length > TASK_TITLE_MAX) {
    return `Keep it under ${TASK_TITLE_MAX} characters`;
  }
  return undefined;
}

/** Whether the title is complete enough to submit. */
export function isTaskTitleSubmittable(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length >= TASK_TITLE_MIN && trimmed.length <= TASK_TITLE_MAX;
}

// ---------------------------------------------------------------------------
// Completing a task (TC-MOB-045)
// ---------------------------------------------------------------------------

/**
 * What tapping the checkbox should do.
 *
 * TC-MOB-043 required that one tap never silently discard a `blocked` or
 * `on_hold` state; TC-MOB-045 requires that completing a task be one tap. Both
 * hold if the checkbox only acts when the outcome is unambiguous, and defers to
 * the picker when it is not:
 *
 *  - `todo` / `in_progress` -> complete. Nothing is lost; the previous status
 *    is recoverable from the undo.
 *  - `done` -> reopen, the natural inverse of the same control.
 *  - anything else -> open the picker, because "the opposite of blocked" is not
 *    a thing the app can guess.
 */
export type CheckboxAction =
  | { kind: 'set'; status: TaskStatus }
  | { kind: 'picker' };

export function resolveCheckboxAction(status: string): CheckboxAction {
  switch (status) {
    case 'todo':
    case 'in_progress':
      return { kind: 'set', status: 'done' };
    case 'done':
      return { kind: 'set', status: 'todo' };
    default:
      return { kind: 'picker' };
  }
}

// ---------------------------------------------------------------------------
// List sectioning
// ---------------------------------------------------------------------------

/**
 * A row in the task list: either a task or the header that introduces the
 * completed group. Modelled as a discriminated union so the list stays a plain
 * FlatList — a SectionList would force the header styling into a second
 * renderer for one header.
 */
export type TaskListRow<T> =
  | { kind: 'task'; task: T }
  | { kind: 'header'; title: string; count: number };

/** Header text for the completed group. */
export const COMPLETED_SECTION_TITLE = 'Completed';

/**
 * Split a sorted list into open tasks followed by a "Completed" section.
 *
 * Completed tasks previously stayed wherever they sorted, so finishing one left
 * it sitting among the open work with only a strikethrough to distinguish it.
 * Order within each group is preserved, so the active sort still applies.
 */
export function buildTaskListRows<T extends { status: string }>(
  tasks: T[]
): TaskListRow<T>[] {
  const open: TaskListRow<T>[] = [];
  const completed: T[] = [];

  tasks.forEach((task) => {
    if (isClosedStatus(task.status)) {
      completed.push(task);
    } else {
      open.push({ kind: 'task', task });
    }
  });

  if (completed.length === 0) return open;

  return [
    ...open,
    { kind: 'header', title: COMPLETED_SECTION_TITLE, count: completed.length },
    ...completed.map((task): TaskListRow<T> => ({ kind: 'task', task })),
  ];
}
