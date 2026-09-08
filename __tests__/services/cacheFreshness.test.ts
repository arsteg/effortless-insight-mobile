/**
 * TC-MOB-056 — how stale cached content is described to the user.
 */

import { formatCacheAge, isStale } from '../../src/utils/cacheFreshness';

const now = new Date(2026, 8, 15, 12, 0, 0).getTime();
const minutesAgo = (n: number) => now - n * 60 * 1000;
const hoursAgo = (n: number) => now - n * 60 * 60 * 1000;
const daysAgo = (n: number) => now - n * 24 * 60 * 60 * 1000;

describe('formatCacheAge', () => {
  it('returns undefined with no timestamp, so the label can be omitted', () => {
    // Better to say nothing than "Updated unknown".
    expect(formatCacheAge(null, now)).toBeUndefined();
  });

  it('says "just now" under a minute', () => {
    expect(formatCacheAge(now - 30 * 1000, now)).toBe('Updated just now');
  });

  it('counts minutes under an hour', () => {
    expect(formatCacheAge(minutesAgo(5), now)).toBe('Updated 5m ago');
    expect(formatCacheAge(minutesAgo(59), now)).toBe('Updated 59m ago');
  });

  it('switches to hours at the hour boundary', () => {
    expect(formatCacheAge(hoursAgo(1), now)).toBe('Updated 1h ago');
    expect(formatCacheAge(hoursAgo(23), now)).toBe('Updated 23h ago');
  });

  it('switches to days at the day boundary', () => {
    expect(formatCacheAge(daysAgo(1), now)).toBe('Updated 1d ago');
    expect(formatCacheAge(daysAgo(3), now)).toBe('Updated 3d ago');
  });

  it('never shows a negative age when the clock has gone backwards', () => {
    // A timezone change or a manually set clock would otherwise render
    // "Updated -3h ago".
    const future = now + 3 * 60 * 60 * 1000;
    expect(formatCacheAge(future, now)).toBe('Updated just now');
  });

  it('handles an unparseable timestamp', () => {
    expect(formatCacheAge(NaN, now)).toBeUndefined();
  });
});

describe('isStale', () => {
  it('is not stale with no timestamp — nothing to warn about', () => {
    expect(isStale(null, now)).toBe(false);
  });

  it('treats fresh data as fresh', () => {
    expect(isStale(minutesAgo(5), now)).toBe(false);
    expect(isStale(minutesAgo(59), now)).toBe(false);
  });

  it('treats an hour or more as stale', () => {
    // A GST notice status can change within a working day; older than an hour
    // should not be relied on for a decision.
    expect(isStale(hoursAgo(1), now)).toBe(true);
    expect(isStale(hoursAgo(6), now)).toBe(true);
    expect(isStale(daysAgo(2), now)).toBe(true);
  });

  it('flips exactly at the hour, not before', () => {
    expect(isStale(now - (60 * 60 * 1000 - 1), now)).toBe(false);
    expect(isStale(now - 60 * 60 * 1000, now)).toBe(true);
  });
});
