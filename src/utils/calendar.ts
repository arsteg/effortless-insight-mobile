/**
 * Calendar grid maths for the date picker (TC-MOB-043).
 *
 * Kept apart from the component so the awkward parts — month lengths, leap
 * years, the leading blanks that align the 1st under the right weekday — are
 * unit-testable without rendering anything.
 *
 * Everything here works in LOCAL time. A due date the user picks as "the 12th"
 * must mean the 12th where they are; converting to UTC happens once, at the
 * edge, in `toDueDateIso`.
 */

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Days in a month, leap years included. `month` is 0-based. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month + 1, 0).getDate();
}

/**
 * The cells of a month grid: leading nulls to pad the first row, then the day
 * numbers. Not padded at the end — a trailing blank row adds nothing.
 */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const leadingBlanks = new Date(year, month, 1).getDay();
  const total = daysInMonth(year, month);

  const cells: (number | null)[] = new Array(leadingBlanks).fill(null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(day);
  }
  return cells;
}

/** Move a {year, month} cursor by whole months, rolling the year over. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const shifted = new Date(year, month + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

/** True when both dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Whether a day is before today — drives the "this is in the past" styling.
 * Past dates stay selectable: back-dating a task that was already due is a
 * legitimate thing to want.
 */
export function isPastDay(date: Date, today: Date): boolean {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return day.getTime() < start.getTime();
}

/**
 * A picked day as the ISO instant to send the API.
 *
 * Anchored to 23:59:59 local, because a task due "on the 12th" is not overdue
 * at 00:01 on the 12th — it is overdue once the 12th is over. The server
 * compares `DueDate < UtcNow`, so the anchor decides when the overdue flag
 * flips.
 */
export function toDueDateIso(year: number, month: number, day: number): string {
  return new Date(year, month, day, 23, 59, 59, 999).toISOString();
}

/** Today, plus a whole number of days, as a local Date. */
export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}
