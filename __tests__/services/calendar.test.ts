/**
 * TC-MOB-043 — calendar grid maths behind the due-date picker.
 */

import {
  daysInMonth,
  buildMonthGrid,
  shiftMonth,
  isSameDay,
  isPastDay,
  toDueDateIso,
  addDays,
  WEEKDAY_LABELS,
  MONTH_LABELS,
} from '../../src/utils/calendar';

describe('daysInMonth', () => {
  it('knows the ordinary months', () => {
    expect(daysInMonth(2026, 0)).toBe(31); // January
    expect(daysInMonth(2026, 3)).toBe(30); // April
    expect(daysInMonth(2026, 11)).toBe(31); // December
  });

  it('handles February in a common year', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
  });

  it('handles February in a leap year', () => {
    expect(daysInMonth(2028, 1)).toBe(29);
  });

  it('handles the century leap-year rule', () => {
    expect(daysInMonth(1900, 1)).toBe(28); // divisible by 100, not 400
    expect(daysInMonth(2000, 1)).toBe(29); // divisible by 400
  });
});

describe('buildMonthGrid', () => {
  it('pads the start so the 1st lands under the right weekday', () => {
    // 1 Sep 2026 is a Tuesday -> two leading blanks (Sun, Mon).
    const grid = buildMonthGrid(2026, 8);
    expect(grid.slice(0, 2)).toEqual([null, null]);
    expect(grid[2]).toBe(1);
  });

  it('has no leading blanks when the month starts on a Sunday', () => {
    // 1 Feb 2026 is a Sunday.
    const grid = buildMonthGrid(2026, 1);
    expect(grid[0]).toBe(1);
  });

  it('ends on the last day of the month', () => {
    const grid = buildMonthGrid(2026, 8);
    expect(grid[grid.length - 1]).toBe(30);
  });

  it('contains every day exactly once', () => {
    const days = buildMonthGrid(2028, 1).filter((d): d is number => d !== null);
    expect(days).toHaveLength(29);
    expect(new Set(days).size).toBe(29);
  });

  it('has seven weekday labels to align against', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(MONTH_LABELS).toHaveLength(12);
  });
});

describe('shiftMonth', () => {
  it('moves forward within a year', () => {
    expect(shiftMonth(2026, 0, 1)).toEqual({ year: 2026, month: 1 });
  });

  it('rolls over into the next year from December', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('rolls back into the previous year from January', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('isSameDay', () => {
  it('matches the same day at different times', () => {
    expect(
      isSameDay(new Date(2026, 8, 12, 1, 0), new Date(2026, 8, 12, 23, 59))
    ).toBe(true);
  });

  it('does not match across a month or year boundary', () => {
    expect(isSameDay(new Date(2026, 8, 12), new Date(2026, 9, 12))).toBe(false);
    expect(isSameDay(new Date(2026, 8, 12), new Date(2027, 8, 12))).toBe(false);
  });
});

describe('isPastDay', () => {
  const today = new Date(2026, 7, 27, 14, 30); // 27 Aug 2026, mid-afternoon

  it('marks yesterday as past', () => {
    expect(isPastDay(new Date(2026, 7, 26), today)).toBe(true);
  });

  it('does not mark today as past, even earlier in the day', () => {
    expect(isPastDay(new Date(2026, 7, 27, 0, 1), today)).toBe(false);
  });

  it('does not mark tomorrow as past', () => {
    expect(isPastDay(new Date(2026, 7, 28), today)).toBe(false);
  });
});

describe('toDueDateIso', () => {
  it('anchors to the end of the chosen day, not the start', () => {
    // A task due "on the 12th" is not overdue at 00:01 on the 12th. The server
    // compares DueDate < UtcNow, so this anchor decides when overdue flips.
    const iso = toDueDateIso(2026, 8, 12);
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(12);
    expect(parsed.getHours()).toBe(23);
    expect(parsed.getMinutes()).toBe(59);
  });

  it('produces a string the API can parse', () => {
    expect(Number.isNaN(new Date(toDueDateIso(2026, 0, 1)).getTime())).toBe(false);
  });
});

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays(new Date(2026, 7, 20), 3).getDate()).toBe(23);
  });

  it('rolls over a month boundary', () => {
    const result = addDays(new Date(2026, 7, 30), 3);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(2);
  });

  it('does not mutate the input', () => {
    const base = new Date(2026, 7, 20);
    addDays(base, 5);
    expect(base.getDate()).toBe(20);
  });
});
