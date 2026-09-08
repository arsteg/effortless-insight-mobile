/**
 * How stale is the data on screen (TC-MOB-056).
 *
 * Offline, the app shows the last copy it fetched. Presenting that as though it
 * were live is the actual hazard: a notice status or deadline read hours ago
 * looks identical to one read a second ago. These helpers turn a cache
 * timestamp into something the UI can say out loud.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "Updated just now" / "Updated 2h ago" / "Updated 3d ago".
 *
 * Returns undefined when there is no timestamp, so the caller can omit the
 * label entirely rather than render "Updated unknown".
 */
export function formatCacheAge(cachedAt: number | null, now: number = Date.now()): string | undefined {
  if (cachedAt === null || Number.isNaN(cachedAt)) return undefined;

  const elapsed = now - cachedAt;

  // A clock that has gone backwards (timezone change, manual set) would
  // otherwise produce "Updated -3h ago".
  if (elapsed < MINUTE) return 'Updated just now';

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `Updated ${minutes}m ago`;
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `Updated ${hours}h ago`;
  }

  const days = Math.floor(elapsed / DAY);
  return `Updated ${days}d ago`;
}

/**
 * Whether cached data is old enough to be worth warning about.
 *
 * An hour is the threshold because a GST notice's status can change within a
 * working day; anything older should not be relied on for a decision.
 */
export function isStale(cachedAt: number | null, now: number = Date.now()): boolean {
  if (cachedAt === null) return false;
  return now - cachedAt >= HOUR;
}
