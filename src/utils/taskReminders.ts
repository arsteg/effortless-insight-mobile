/**
 * When to remind someone about a task deadline (TC-MOB-048).
 *
 * Firing at the deadline itself is useless — by then there is nothing left to
 * do about it. These rules decide the fire times; scheduling and cancellation
 * live in `services/taskReminders.ts`, so the arithmetic here stays testable
 * without touching expo-notifications.
 */

import { priorityLabel } from './taskDisplay';

/** Hour of the local morning that "the day of" reminders fire. */
export const REMINDER_HOUR = 9;

export interface ReminderPlan {
  /** When the notification should fire. */
  fireAt: Date;
  /** Distinguishes the day-before nudge from the day-of one. */
  kind: 'day-before' | 'day-of';
  title: string;
  body: string;
}

/** 09:00 local on the same calendar day as `date`. */
function morningOf(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    REMINDER_HOUR,
    0,
    0,
    0
  );
}

/**
 * The reminders to schedule for a task.
 *
 * - Everything gets a **day-of** reminder at 09:00 local.
 * - `critical` and `high` also get a **day-before** one, because a day's notice
 *   is the difference between responding and missing a statutory deadline.
 *
 * Times already in the past are dropped: `scheduleNotificationAsync` fires a
 * past DATE trigger immediately, which would mean creating a task due today at
 * 4pm pops a "due today" alert the instant you save it.
 *
 * Returns an empty array when there is no usable due date, so callers can
 * schedule unconditionally.
 */
export function planReminders(
  title: string,
  dueDate: string | undefined,
  priority: string,
  now: Date = new Date()
): ReminderPlan[] {
  if (!dueDate) return [];

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return [];

  const plans: ReminderPlan[] = [];

  if (priority === 'critical' || priority === 'high') {
    const dayBefore = morningOf(new Date(due.getTime() - 24 * 60 * 60 * 1000));
    plans.push({
      fireAt: dayBefore,
      kind: 'day-before',
      title: `Due tomorrow: ${title}`,
      body: `${priorityLabel(priority)} priority. Due ${formatDay(due)}.`,
    });
  }

  plans.push({
    fireAt: morningOf(due),
    kind: 'day-of',
    title: `Due today: ${title}`,
    body: `${priorityLabel(priority)} priority task is due today.`,
  });

  return plans.filter((plan) => plan.fireAt.getTime() > now.getTime());
}

function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}
