/**
 * Scheduling and cancelling task deadline reminders (TC-MOB-048).
 *
 * The notification identifiers are kept in AsyncStorage keyed by task id. That
 * bookkeeping is the whole point: without it, a reminder for a task you
 * finished last week still fires, which is exactly the defect the server's
 * overdue job has — it re-emails every morning with no record of having
 * already told you.
 *
 * Every function here degrades to a no-op rather than throwing. A reminder is
 * a convenience; failing to set one must never fail the task creation that
 * triggered it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleNotificationAt, cancelNotification } from './pushNotifications';
import { planReminders } from '../utils/taskReminders';

const STORAGE_KEY = '@task_reminders';

/** taskId -> the notification identifiers scheduled for it. */
type ReminderMap = Record<string, string[]>;

async function readMap(): Promise<ReminderMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReminderMap) : {};
  } catch {
    // Corrupt or unreadable storage: start over rather than break the caller.
    return {};
  }
}

async function writeMap(map: ReminderMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Losing the record means a stale reminder may fire later. Acceptable;
    // failing the task operation is not.
  }
}

/**
 * Schedule the reminders for a task, replacing any it already had.
 *
 * Returns how many were actually scheduled — 0 in Expo Go, when permission is
 * refused, or when every fire time is already past.
 */
export async function scheduleTaskReminders(
  taskId: string,
  title: string,
  dueDate: string | undefined,
  priority: string
): Promise<number> {
  // Replace, never accumulate: rescheduling a task must not leave the old
  // reminders in place alongside the new ones.
  await cancelTaskReminders(taskId);

  const plans = planReminders(title, dueDate, priority);
  if (plans.length === 0) return 0;

  const identifiers: string[] = [];

  for (const plan of plans) {
    try {
      const id = await scheduleNotificationAt(plan.fireAt, plan.title, plan.body, {
        type: 'task_due_soon',
        taskId,
        priority,
      } as never);
      if (id) identifiers.push(id);
    } catch {
      // One failed reminder should not prevent the others.
    }
  }

  if (identifiers.length > 0) {
    const map = await readMap();
    map[taskId] = identifiers;
    await writeMap(map);
  }

  return identifiers.length;
}

/** Cancel every reminder held for a task. Safe to call when there are none. */
export async function cancelTaskReminders(taskId: string): Promise<void> {
  const map = await readMap();
  const identifiers = map[taskId];
  if (!identifiers || identifiers.length === 0) return;

  await Promise.all(
    identifiers.map(async (id) => {
      try {
        await cancelNotification(id);
      } catch {
        // Already fired or already cancelled — nothing to do.
      }
    })
  );

  delete map[taskId];
  await writeMap(map);
}

/** Whether a task currently has reminders scheduled. Used by tests and debug. */
export async function hasTaskReminders(taskId: string): Promise<boolean> {
  const map = await readMap();
  return (map[taskId]?.length ?? 0) > 0;
}
