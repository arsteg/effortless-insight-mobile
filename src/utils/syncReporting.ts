/**
 * What to tell the user after a sync (TC-MOB-059).
 *
 * Reconnecting used to drain the queues in complete silence. Successes were
 * invisible, and — worse — a failed sync looked identical: the banner simply
 * kept showing a count with no explanation, so the user had no way to tell
 * "still working" from "stuck".
 */

export interface SyncOutcome {
  /** Queued actions applied: comments, task edits, status changes. */
  actionsProcessed: number;
  actionsFailed: number;
  /** Scans uploaded. */
  uploadsProcessed: number;
  uploadsFailed: number;
  /** Rejected because the server's copy had changed underneath. */
  conflicts: number;
}

export interface SyncMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * The message for a completed sync, or undefined when nothing happened.
 *
 * Silence is correct only when there was nothing to do — a sync that moved
 * something must say so, and one that failed must say that too.
 */
export function summariseSync(outcome: SyncOutcome): SyncMessage | undefined {
  const succeeded = outcome.actionsProcessed + outcome.uploadsProcessed;
  const failed = outcome.actionsFailed + outcome.uploadsFailed;

  if (succeeded === 0 && failed === 0 && outcome.conflicts === 0) {
    return undefined;
  }

  // Conflicts lead: they are the only outcome where the user's change did not
  // apply AND retrying will not help.
  if (outcome.conflicts > 0) {
    return {
      type: 'warning',
      text: `${plural(outcome.conflicts, 'change was', 'changes were')} not applied — someone else edited the same item.`,
    };
  }

  if (failed > 0 && succeeded > 0) {
    return {
      type: 'warning',
      text: `${plural(succeeded, 'item', 'items')} synced, ${failed} failed.`,
    };
  }

  if (failed > 0) {
    return {
      type: 'error',
      text: `${plural(failed, 'item', 'items')} failed to sync. They will be retried.`,
    };
  }

  const parts: string[] = [];
  if (outcome.uploadsProcessed > 0) {
    parts.push(plural(outcome.uploadsProcessed, 'scan uploaded', 'scans uploaded'));
  }
  if (outcome.actionsProcessed > 0) {
    parts.push(plural(outcome.actionsProcessed, 'change synced', 'changes synced'));
  }

  return { type: 'success', text: `${parts.join(' · ')}.` };
}

/** Whether anything is still outstanding after a sync pass. */
export function hasOutstanding(outcome: SyncOutcome): boolean {
  return outcome.actionsFailed + outcome.uploadsFailed + outcome.conflicts > 0;
}
