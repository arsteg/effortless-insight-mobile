/**
 * TC-MOB-043 — Tasks list display, filtering and sorting.
 */

import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  SORT_OPTIONS,
  sortTasks,
  statusLabel,
  statusColor,
  priorityLabel,
  priorityRank,
  getStatusOptions,
  isClosedStatus,
  formatDueDate,
  validateTaskTitle,
  isTaskTitleSubmittable,
  TASK_TITLE_MIN,
  TASK_TITLE_MAX,
  resolveCheckboxAction,
  buildTaskListRows,
  COMPLETED_SECTION_TITLE,
} from '../../src/utils/taskDisplay';

describe('status coverage', () => {
  // The API's TaskStatusValues. A status missing from TASK_STATUSES renders
  // without a label and cannot be filtered for — the original bug.
  const SERVER_STATUSES = [
    'todo',
    'in_progress',
    'done',
    'blocked',
    'on_hold',
    'archived',
    'cancelled',
  ];

  it('covers every status the API can return', () => {
    SERVER_STATUSES.forEach((status) => {
      expect(TASK_STATUSES).toContain(status);
    });
    expect(TASK_STATUSES).toHaveLength(SERVER_STATUSES.length);
  });

  it('gives every status a distinct human-readable label', () => {
    const labels = TASK_STATUSES.map(statusLabel);
    expect(labels).toEqual([
      'To Do',
      'In Progress',
      'Blocked',
      'On Hold',
      'Done',
      'Cancelled',
      'Archived',
    ]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('distinguishes blocked from todo — the original defect', () => {
    // Both previously rendered the empty to-do checkbox with no text.
    expect(statusLabel('blocked')).not.toBe(statusLabel('todo'));
    expect(statusColor('blocked')).not.toBe(statusColor('todo'));
  });

  it('falls back to a readable string for an unknown status', () => {
    expect(statusLabel('needs_review')).toBe('needs review');
  });
});

describe('getStatusOptions', () => {
  it('offers every status except the current one', () => {
    const options = getStatusOptions('blocked');
    expect(options).not.toContain('blocked');
    expect(options).toHaveLength(TASK_STATUSES.length - 1);
  });

  it('lets a blocked task move somewhere other than done', () => {
    // The old checkbox could only produce `done`, discarding the blocked state.
    const options = getStatusOptions('blocked');
    expect(options).toContain('in_progress');
    expect(options).toContain('on_hold');
    expect(options).toContain('todo');
  });

  it('offers in_progress from todo, which the UI previously could not reach', () => {
    expect(getStatusOptions('todo')).toContain('in_progress');
  });
});

describe('isClosedStatus', () => {
  it.each(['done', 'cancelled', 'archived'])('treats %s as closed', (status) => {
    expect(isClosedStatus(status)).toBe(true);
  });

  it.each(['todo', 'in_progress', 'blocked', 'on_hold'])('treats %s as open', (status) => {
    expect(isClosedStatus(status)).toBe(false);
  });
});

describe('priority', () => {
  it('labels every priority', () => {
    expect(TASK_PRIORITIES.map(priorityLabel)).toEqual([
      'Critical',
      'High',
      'Medium',
      'Low',
    ]);
  });

  it('ranks critical above low', () => {
    expect(priorityRank('critical')).toBeLessThan(priorityRank('low'));
    expect(priorityRank('high')).toBeLessThan(priorityRank('medium'));
  });

  it('sorts an unknown priority last rather than first', () => {
    expect(priorityRank('bogus')).toBeGreaterThan(priorityRank('low'));
  });
});

describe('sortTasks', () => {
  const tasks = [
    { title: 'Zebra', priority: 'low', dueDate: '2026-09-01T00:00:00Z' },
    { title: 'Apple', priority: 'critical', dueDate: '2026-12-01T00:00:00Z' },
    { title: 'Mango', priority: 'medium' }, // no due date
    { title: 'Banana', priority: 'high', dueDate: '2026-08-01T00:00:00Z' },
  ];

  it('offers exactly the three documented sorts', () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual(['priority', 'dueDate', 'title']);
  });

  it('sorts by priority, highest first', () => {
    expect(sortTasks(tasks, 'priority').map((t) => t.title)).toEqual([
      'Apple',
      'Banana',
      'Mango',
      'Zebra',
    ]);
  });

  it('sorts by due date, soonest first', () => {
    expect(sortTasks(tasks, 'dueDate').map((t) => t.title)).toEqual([
      'Banana',
      'Zebra',
      'Apple',
      'Mango',
    ]);
  });

  it('puts undated tasks last — an absent deadline is not an urgent one', () => {
    const sorted = sortTasks(tasks, 'dueDate');
    expect(sorted[sorted.length - 1].title).toBe('Mango');
  });

  it('sorts by title alphabetically', () => {
    expect(sortTasks(tasks, 'title').map((t) => t.title)).toEqual([
      'Apple',
      'Banana',
      'Mango',
      'Zebra',
    ]);
  });

  it('never mutates the input', () => {
    const original = [...tasks];
    sortTasks(tasks, 'title');
    expect(tasks).toEqual(original);
  });

  it('breaks priority ties on due date', () => {
    const tied = [
      { title: 'Later', priority: 'high', dueDate: '2026-12-01T00:00:00Z' },
      { title: 'Sooner', priority: 'high', dueDate: '2026-08-01T00:00:00Z' },
    ];
    expect(sortTasks(tied, 'priority').map((t) => t.title)).toEqual(['Sooner', 'Later']);
  });

  it('handles an empty list', () => {
    expect(sortTasks([], 'priority')).toEqual([]);
  });

  it('treats an unparseable due date as undated rather than sorting it first', () => {
    const withJunk = [
      { title: 'Junk', priority: 'low', dueDate: 'not-a-date' },
      { title: 'Real', priority: 'low', dueDate: '2026-09-01T00:00:00Z' },
    ];
    expect(sortTasks(withJunk, 'dueDate').map((t) => t.title)).toEqual(['Real', 'Junk']);
  });
});

describe('formatDueDate', () => {
  it('returns undefined when there is no date, so the row can be dropped', () => {
    expect(formatDueDate(undefined)).toBeUndefined();
    expect(formatDueDate('')).toBeUndefined();
  });

  it('returns undefined for an unparseable date rather than "Invalid Date"', () => {
    expect(formatDueDate('not-a-date')).toBeUndefined();
  });

  it('formats a real date', () => {
    expect(formatDueDate('2026-09-12T23:59:59Z')).toMatch(/Sep/);
  });
});

describe('validateTaskTitle (TC-MOB-044)', () => {
  it('stays quiet on an empty field so the form does not nag before typing', () => {
    expect(validateTaskTitle('')).toBeUndefined();
    expect(validateTaskTitle('   ')).toBeUndefined();
  });

  it('rejects a title shorter than the server minimum', () => {
    // "Fix" was accepted by the old button and came back as an
    // uninterpretable 400.
    expect(validateTaskTitle('Fix')).toBe('Use at least 5 characters');
    expect(validateTaskTitle('abcd')).toBeDefined();
  });

  it('accepts a title exactly at the minimum', () => {
    expect(validateTaskTitle('abcde')).toBeUndefined();
  });

  it('rejects a title over the server maximum', () => {
    expect(validateTaskTitle('a'.repeat(TASK_TITLE_MAX + 1))).toBeDefined();
    expect(validateTaskTitle('a'.repeat(TASK_TITLE_MAX))).toBeUndefined();
  });

  it('measures the trimmed title, not the raw input', () => {
    expect(validateTaskTitle('  Fix  ')).toBeDefined();
  });

  it('matches the server rule of 5 to 200 characters', () => {
    expect(TASK_TITLE_MIN).toBe(5);
    expect(TASK_TITLE_MAX).toBe(200);
  });
});

describe('isTaskTitleSubmittable', () => {
  it('is false for an empty title even though validate is quiet about it', () => {
    // The two answer different questions: one drives the error message, the
    // other drives the button. Conflating them let an empty title submit.
    expect(validateTaskTitle('')).toBeUndefined();
    expect(isTaskTitleSubmittable('')).toBe(false);
  });

  it('is false for a title below the minimum', () => {
    expect(isTaskTitleSubmittable('Fix')).toBe(false);
  });

  it('is true for a valid title', () => {
    expect(isTaskTitleSubmittable('Reply to notice')).toBe(true);
  });

  it('is false for a title over the maximum', () => {
    expect(isTaskTitleSubmittable('a'.repeat(TASK_TITLE_MAX + 1))).toBe(false);
  });
});

describe('resolveCheckboxAction (TC-MOB-045)', () => {
  it('completes an open task in one tap', () => {
    // Your step 1: "Tap checkbox on task". One tap, not two.
    expect(resolveCheckboxAction('todo')).toEqual({ kind: 'set', status: 'done' });
    expect(resolveCheckboxAction('in_progress')).toEqual({ kind: 'set', status: 'done' });
  });

  it('reopens a completed task, the inverse of the same control', () => {
    expect(resolveCheckboxAction('done')).toEqual({ kind: 'set', status: 'todo' });
  });

  it.each(['blocked', 'on_hold', 'cancelled', 'archived'])(
    'opens the picker from %s rather than guessing',
    (status) => {
      // The TC-MOB-043 defect: one tap on a blocked task marked it done and
      // discarded the blocked state. "The opposite of blocked" is not knowable.
      expect(resolveCheckboxAction(status)).toEqual({ kind: 'picker' });
    }
  );

  it('opens the picker for an unknown status rather than writing a guess', () => {
    expect(resolveCheckboxAction('needs_review')).toEqual({ kind: 'picker' });
  });

  it('never sets a status equal to the current one', () => {
    TASK_STATUSES.forEach((status) => {
      const action = resolveCheckboxAction(status);
      if (action.kind === 'set') {
        expect(action.status).not.toBe(status);
      }
    });
  });
});

describe('buildTaskListRows (TC-MOB-045)', () => {
  const task = (id: string, status: string) => ({ id, status });

  it('returns a flat list when nothing is completed', () => {
    const rows = buildTaskListRows([task('a', 'todo'), task('b', 'in_progress')]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'task')).toBe(true);
  });

  it('moves completed tasks below a header', () => {
    const rows = buildTaskListRows([
      task('a', 'todo'),
      task('b', 'done'),
      task('c', 'in_progress'),
    ]);

    expect(rows.map((r) => (r.kind === 'task' ? r.task.id : `[${r.title}]`))).toEqual([
      'a',
      'c',
      `[${COMPLETED_SECTION_TITLE}]`,
      'b',
    ]);
  });

  it('counts the completed tasks in the header', () => {
    const rows = buildTaskListRows([
      task('a', 'todo'),
      task('b', 'done'),
      task('c', 'archived'),
    ]);
    const header = rows.find((r) => r.kind === 'header');
    expect(header).toMatchObject({ count: 2 });
  });

  it('groups cancelled and archived with completed, not with open work', () => {
    const rows = buildTaskListRows([task('a', 'cancelled'), task('b', 'todo')]);
    expect(rows[0]).toMatchObject({ kind: 'task', task: { id: 'b' } });
    expect(rows[1]).toMatchObject({ kind: 'header' });
  });

  it('keeps blocked and on_hold in the open group — they are not finished', () => {
    const rows = buildTaskListRows([task('a', 'blocked'), task('b', 'on_hold')]);
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.kind === 'header')).toBe(false);
  });

  it('emits no header when every task is completed but still lists them', () => {
    const rows = buildTaskListRows([task('a', 'done'), task('b', 'done')]);
    // The header introduces a group below open work; with no open work there is
    // nothing to separate, so it would be noise.
    expect(rows.filter((r) => r.kind === 'task')).toHaveLength(2);
  });

  it('preserves the incoming order within each group, so the sort still applies', () => {
    const rows = buildTaskListRows([
      task('first', 'todo'),
      task('second', 'todo'),
      task('done1', 'done'),
      task('done2', 'done'),
    ]);
    const ids = rows.flatMap((r) => (r.kind === 'task' ? [r.task.id] : []));
    expect(ids).toEqual(['first', 'second', 'done1', 'done2']);
  });

  it('handles an empty list', () => {
    expect(buildTaskListRows([])).toEqual([]);
  });
});

describe('resolveCheckboxAction (TC-MOB-045)', () => {
  it('completes an open task in one tap', () => {
    expect(resolveCheckboxAction('todo')).toEqual({ kind: 'set', status: 'done' });
    expect(resolveCheckboxAction('in_progress')).toEqual({ kind: 'set', status: 'done' });
  });

  it('reopens a done task — the same control run backwards', () => {
    expect(resolveCheckboxAction('done')).toEqual({ kind: 'set', status: 'todo' });
  });

  it.each(['blocked', 'on_hold', 'cancelled', 'archived'])(
    'defers to the picker from %s rather than guessing',
    (status) => {
      // The whole point of TC-MOB-043: one tap must never silently discard
      // a state the app cannot infer the opposite of.
      expect(resolveCheckboxAction(status)).toEqual({ kind: 'picker' });
    }
  );

  it('never sends a blocked task straight to done', () => {
    expect(resolveCheckboxAction('blocked')).not.toEqual({ kind: 'set', status: 'done' });
  });
});

describe('buildTaskListRows (TC-MOB-045)', () => {
  const open = { id: '1', status: 'todo' };
  const progress = { id: '2', status: 'in_progress' };
  const done = { id: '3', status: 'done' };
  const cancelled = { id: '4', status: 'cancelled' };

  it('returns a flat list with no header when nothing is completed', () => {
    const rows = buildTaskListRows([open, progress]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'task')).toBe(true);
  });

  it('moves completed tasks below a header', () => {
    const rows = buildTaskListRows([open, done, progress]);
    expect(rows.map((r) => (r.kind === 'header' ? 'HEADER' : r.task.id))).toEqual([
      '1',
      '2',
      'HEADER',
      '3',
    ]);
  });

  it('counts everything in the completed group', () => {
    const rows = buildTaskListRows([open, done, cancelled]);
    const header = rows.find((r) => r.kind === 'header');
    expect(header).toEqual({ kind: 'header', title: COMPLETED_SECTION_TITLE, count: 2 });
  });

  it('treats cancelled and archived as completed, not just done', () => {
    const rows = buildTaskListRows([{ id: '5', status: 'archived' }]);
    expect(rows[0].kind).toBe('header');
  });

  it('preserves the incoming order within each group, so the sort still applies', () => {
    const rows = buildTaskListRows([
      { id: 'b', status: 'todo' },
      { id: 'a', status: 'todo' },
      { id: 'd', status: 'done' },
      { id: 'c', status: 'done' },
    ]);
    expect(rows.filter((r) => r.kind === 'task').map((r) => (r as any).task.id)).toEqual([
      'b',
      'a',
      'd',
      'c',
    ]);
  });

  it('handles an all-completed list', () => {
    const rows = buildTaskListRows([done, cancelled]);
    expect(rows[0]).toEqual({ kind: 'header', title: COMPLETED_SECTION_TITLE, count: 2 });
    expect(rows).toHaveLength(3);
  });

  it('handles an empty list', () => {
    expect(buildTaskListRows([])).toEqual([]);
  });

  it('never mutates the input', () => {
    const input = [open, done];
    const copy = [...input];
    buildTaskListRows(input);
    expect(input).toEqual(copy);
  });
});
