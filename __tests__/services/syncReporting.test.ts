/**
 * TC-MOB-059 — what the user is told after a reconnect sync.
 */

import { summariseSync, hasOutstanding, SyncOutcome } from '../../src/utils/syncReporting';

const outcome = (over: Partial<SyncOutcome> = {}): SyncOutcome => ({
  actionsProcessed: 0,
  actionsFailed: 0,
  uploadsProcessed: 0,
  uploadsFailed: 0,
  conflicts: 0,
  ...over,
});

describe('summariseSync', () => {
  it('says nothing when there was nothing to sync', () => {
    // Silence is correct only here — a sync that moved something must say so.
    expect(summariseSync(outcome())).toBeUndefined();
  });

  it('reports uploaded scans', () => {
    const message = summariseSync(outcome({ uploadsProcessed: 2 }));
    expect(message).toEqual({ type: 'success', text: '2 scans uploaded.' });
  });

  it('uses the singular for one item', () => {
    expect(summariseSync(outcome({ uploadsProcessed: 1 }))?.text).toBe('1 scan uploaded.');
  });

  it('reports queued changes', () => {
    expect(summariseSync(outcome({ actionsProcessed: 3 }))).toEqual({
      type: 'success',
      text: '3 changes synced.',
    });
  });

  it('combines scans and changes in one message', () => {
    const message = summariseSync(outcome({ uploadsProcessed: 1, actionsProcessed: 2 }));
    expect(message?.text).toBe('1 scan uploaded · 2 changes synced.');
  });

  it('reports a total failure as an error, not silence', () => {
    // The old behaviour: the banner kept a count and said nothing, so a stuck
    // sync looked the same as one still working.
    const message = summariseSync(outcome({ actionsFailed: 2 }));
    expect(message?.type).toBe('error');
    expect(message?.text).toMatch(/failed to sync/i);
  });

  it('promises a retry for ordinary failures', () => {
    expect(summariseSync(outcome({ uploadsFailed: 1 }))?.text).toMatch(/retried/i);
  });

  it('warns on a partial sync rather than claiming success', () => {
    const message = summariseSync(outcome({ actionsProcessed: 2, actionsFailed: 1 }));
    expect(message?.type).toBe('warning');
    expect(message?.text).toBe('2 items synced, 1 failed.');
  });

  it('leads with conflicts, which no retry can fix', () => {
    const message = summariseSync(
      outcome({ actionsProcessed: 5, uploadsProcessed: 2, conflicts: 1 })
    );
    expect(message?.type).toBe('warning');
    expect(message?.text).toMatch(/someone else edited/i);
  });

  it('does not promise a retry for a conflict', () => {
    // Retrying replays the same stale write; the message must not suggest it.
    expect(summariseSync(outcome({ conflicts: 2 }))?.text).not.toMatch(/retried/i);
  });

  it('pluralises conflicts', () => {
    expect(summariseSync(outcome({ conflicts: 1 }))?.text).toMatch(/1 change was/);
    expect(summariseSync(outcome({ conflicts: 3 }))?.text).toMatch(/3 changes were/);
  });
});

describe('hasOutstanding', () => {
  it('is false for a clean sync', () => {
    expect(hasOutstanding(outcome({ actionsProcessed: 5 }))).toBe(false);
  });

  it('is true when anything failed or conflicted', () => {
    expect(hasOutstanding(outcome({ actionsFailed: 1 }))).toBe(true);
    expect(hasOutstanding(outcome({ uploadsFailed: 1 }))).toBe(true);
    expect(hasOutstanding(outcome({ conflicts: 1 }))).toBe(true);
  });
});
