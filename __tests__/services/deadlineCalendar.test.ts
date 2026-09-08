/**
 * TC-MOB-047 — Deadline calendar data model.
 */

import {
  dayKey,
  dayKeyFromIso,
  groupItemsByDay,
  filterByType,
  dayPriority,
  countByType,
  monthRange,
  noticesToCalendarItems,
  tasksToCalendarItems,
  ALL_TYPES,
  CalendarItem,
} from '../../src/utils/deadlineCalendar';

const item = (over: Partial<CalendarItem> = {}): CalendarItem => ({
  id: 'x',
  type: 'notice',
  title: 'Item',
  dueDate: '2026-09-15T10:00:00Z',
  priority: 'medium',
  noticeId: 'n1',
  isOverdue: false,
  ...over,
});

describe('dayKey', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // The bug this guards: toISOString() converts to UTC first, so an evening
    // deadline east of Greenwich lands on the following day in the grid.
    const evening = new Date(2026, 8, 15, 23, 30);
    expect(dayKey(evening)).toBe('2026-09-15');
  });

  it('zero-pads month and day so keys sort lexically', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('returns undefined for a missing or unparseable date', () => {
    expect(dayKeyFromIso(undefined)).toBeUndefined();
    expect(dayKeyFromIso('')).toBeUndefined();
    expect(dayKeyFromIso('not-a-date')).toBeUndefined();
  });
});

describe('groupItemsByDay', () => {
  it('buckets items under their day', () => {
    const groups = groupItemsByDay([
      item({ id: 'a', dueDate: new Date(2026, 8, 15, 9).toISOString() }),
      item({ id: 'b', dueDate: new Date(2026, 8, 16, 9).toISOString() }),
    ]);
    expect(Object.keys(groups).sort()).toEqual(['2026-09-15', '2026-09-16']);
  });

  it('puts several items on one day together', () => {
    const groups = groupItemsByDay([
      item({ id: 'a', dueDate: new Date(2026, 8, 15, 9).toISOString() }),
      item({ id: 'b', dueDate: new Date(2026, 8, 15, 18).toISOString() }),
    ]);
    expect(groups['2026-09-15']).toHaveLength(2);
  });

  it('orders a day by priority, most urgent first', () => {
    const groups = groupItemsByDay([
      item({ id: 'low', priority: 'low', dueDate: new Date(2026, 8, 15).toISOString() }),
      item({ id: 'crit', priority: 'critical', dueDate: new Date(2026, 8, 15).toISOString() }),
      item({ id: 'high', priority: 'high', dueDate: new Date(2026, 8, 15).toISOString() }),
    ]);
    expect(groups['2026-09-15'].map((i) => i.id)).toEqual(['crit', 'high', 'low']);
  });

  it('drops an item with an unparseable date rather than crashing', () => {
    const groups = groupItemsByDay([item({ dueDate: 'rubbish' })]);
    expect(Object.keys(groups)).toHaveLength(0);
  });

  it('handles an empty list', () => {
    expect(groupItemsByDay([])).toEqual({});
  });
});

describe('filterByType', () => {
  const items = [item({ id: 'n', type: 'notice' }), item({ id: 't', type: 'task' })];

  it('shows both by default', () => {
    expect(filterByType(items, ALL_TYPES)).toHaveLength(2);
  });

  it('hides tasks when the toggle is off', () => {
    const result = filterByType(items, { notices: true, tasks: false });
    expect(result.map((i) => i.id)).toEqual(['n']);
  });

  it('hides notices when the toggle is off', () => {
    const result = filterByType(items, { notices: false, tasks: true });
    expect(result.map((i) => i.id)).toEqual(['t']);
  });

  it('shows nothing when both are off', () => {
    expect(filterByType(items, { notices: false, tasks: false })).toEqual([]);
  });
});

describe('dayPriority', () => {
  it('picks the most urgent priority on the day', () => {
    expect(
      dayPriority([item({ priority: 'low' }), item({ priority: 'critical' })])
    ).toBe('critical');
  });

  it('is undefined for an empty or missing day, so no dot is drawn', () => {
    expect(dayPriority([])).toBeUndefined();
    expect(dayPriority(undefined)).toBeUndefined();
  });
});

describe('countByType', () => {
  it('counts each type', () => {
    expect(
      countByType([
        item({ type: 'notice' }),
        item({ type: 'task' }),
        item({ type: 'task' }),
      ])
    ).toEqual({ notices: 1, tasks: 2 });
  });
});

describe('monthRange', () => {
  it('spans the first to the last day of the month', () => {
    const { from, to } = monthRange(2026, 8); // September
    expect(new Date(from).getDate()).toBe(1);
    expect(new Date(to).getDate()).toBe(30);
  });

  it('gets February right in a leap year', () => {
    expect(new Date(monthRange(2028, 1).to).getDate()).toBe(29);
  });

  it('gets February right in a common year', () => {
    expect(new Date(monthRange(2026, 1).to).getDate()).toBe(28);
  });

  it('covers the very end of the last day', () => {
    const end = new Date(monthRange(2026, 8).to);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('noticesToCalendarItems', () => {
  const now = new Date(2026, 8, 15);

  it('keeps notices that have a deadline', () => {
    const items = noticesToCalendarItems(
      [{ id: 'n1', noticeNumber: 'GST-1', responseDeadline: '2026-09-20T00:00:00Z', status: 'analyzed' }],
      now
    );
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('notice');
    expect(items[0].noticeId).toBe('n1');
  });

  it('drops notices with no deadline — they belong on no date', () => {
    expect(noticesToCalendarItems([{ id: 'n1', status: 'analyzed' }], now)).toEqual([]);
  });

  it.each(['closed', 'archived'])('drops %s notices, whose deadline is history', (status) => {
    const items = noticesToCalendarItems(
      [{ id: 'n1', responseDeadline: '2026-09-20T00:00:00Z', status }],
      now
    );
    expect(items).toEqual([]);
  });

  it('flags a past deadline as overdue', () => {
    const items = noticesToCalendarItems(
      [{ id: 'n1', responseDeadline: '2026-09-01T00:00:00Z', status: 'analyzed' }],
      now
    );
    expect(items[0].isOverdue).toBe(true);
  });

  it('falls back to the notice type when there is no number', () => {
    const items = noticesToCalendarItems(
      [{ id: 'n1', noticeType: 'GSTR-3B', responseDeadline: '2026-09-20T00:00:00Z' }],
      now
    );
    expect(items[0].title).toBe('GSTR-3B');
  });

  it('defaults an absent priority to medium rather than blank', () => {
    const items = noticesToCalendarItems(
      [{ id: 'n1', responseDeadline: '2026-09-20T00:00:00Z' }],
      now
    );
    expect(items[0].priority).toBe('medium');
  });
});

describe('tasksToCalendarItems', () => {
  const now = new Date(2026, 8, 15);
  const task = (over = {}) => ({
    id: 't1',
    title: 'Draft reply',
    dueDate: '2026-09-20T00:00:00Z',
    priority: 'high',
    status: 'todo',
    notice: { id: 'n1', noticeNumber: 'GST-1' },
    ...over,
  });

  it('keeps tasks that have a due date', () => {
    const items = tasksToCalendarItems([task()], now);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('task');
  });

  it('points at the parent notice, since there is no task screen to open', () => {
    expect(tasksToCalendarItems([task()], now)[0].noticeId).toBe('n1');
  });

  it('drops tasks with no due date', () => {
    expect(tasksToCalendarItems([task({ dueDate: undefined })], now)).toEqual([]);
  });

  it.each(['done', 'cancelled', 'archived'])('drops %s tasks', (status) => {
    expect(tasksToCalendarItems([task({ status })], now)).toEqual([]);
  });

  it('keeps blocked and on-hold tasks, which are still outstanding', () => {
    expect(tasksToCalendarItems([task({ status: 'blocked' })], now)).toHaveLength(1);
    expect(tasksToCalendarItems([task({ status: 'on_hold' })], now)).toHaveLength(1);
  });

  it("trusts the server's overdue flag when it sent one", () => {
    // The server owns the definition; a future date marked overdue stays so.
    const items = tasksToCalendarItems([task({ isOverdue: true })], now);
    expect(items[0].isOverdue).toBe(true);
  });

  it('falls back to comparing dates when the server sent no flag', () => {
    const items = tasksToCalendarItems([task({ dueDate: '2026-09-01T00:00:00Z' })], now);
    expect(items[0].isOverdue).toBe(true);
  });

  it('gives notice and task items distinct ids even when the rows share one', () => {
    const notices = noticesToCalendarItems(
      [{ id: 'same', responseDeadline: '2026-09-20T00:00:00Z' }],
      now
    );
    const tasks = tasksToCalendarItems([task({ id: 'same' })], now);
    expect(notices[0].id).not.toBe(tasks[0].id);
  });
});
