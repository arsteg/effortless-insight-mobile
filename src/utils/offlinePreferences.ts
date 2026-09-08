/**
 * What the app is allowed to store and sync without being asked (TC-MOB-061).
 *
 * Two settings, because they answer the two questions people actually have
 * about offline behaviour: "why is this app using so much space?" and "why is
 * it uploading on my mobile data?".
 *
 * Deliberately not granular per-notice selection. That reads well on a
 * requirements list and goes unused in practice — the useful control is a
 * blanket policy plus the per-document pin that already exists.
 */

export interface OfflinePreferences {
  /**
   * Keep a copy of every document opened, so it is available offline later.
   *
   * Off does not disable offline documents — a pinned attachment is an
   * explicit request and is always kept. It only stops the automatic copy
   * taken on viewing.
   */
  autoSaveDocuments: boolean;

  /**
   * Hold queued work until the device is on Wi-Fi.
   *
   * Scans are multi-megabyte; uploading them over a metered connection is a
   * real cost in a market where mobile data is the norm.
   */
  syncOnWifiOnly: boolean;
}

export const DEFAULT_OFFLINE_PREFERENCES: OfflinePreferences = {
  // On by default: a document you looked at is the one you are most likely to
  // want again, and the cache is bounded and clearable.
  autoSaveDocuments: true,
  // Off by default: holding a user's work back is worse than spending data
  // they did not explicitly protect.
  syncOnWifiOnly: false,
};

/** Whether a viewed document should be kept. Pins bypass this. */
export function shouldAutoSaveDocument(prefs: OfflinePreferences): boolean {
  return prefs.autoSaveDocuments;
}

/**
 * Whether a viewed document should be kept *right now*, given the connection.
 *
 * The automatic copy is a second full download of a file the viewer has
 * already fetched, so on a metered connection it silently doubles the data
 * cost of opening a notice. A user who asked to sync on Wi-Fi only meant this
 * too. Pins still bypass it — an explicit request is worth the data
 * (TC-MOB-086).
 */
export function shouldAutoSaveDocumentNow(
  prefs: OfflinePreferences,
  connectionType: string | null
): boolean {
  return shouldAutoSaveDocument(prefs) && canSyncNow(prefs, connectionType);
}

/**
 * Whether queued work may sync now.
 *
 * `connectionType` comes from NetInfo. An unknown type is treated as
 * acceptable: refusing to sync because the type could not be determined would
 * strand queued work on connections that are, in fact, Wi-Fi.
 */
export function canSyncNow(
  prefs: OfflinePreferences,
  connectionType: string | null
): boolean {
  if (!prefs.syncOnWifiOnly) return true;
  if (connectionType === null || connectionType === 'unknown') return true;
  return connectionType === 'wifi' || connectionType === 'ethernet';
}

/** Why a sync was held back, for the message shown to the user. */
export function syncHeldReason(
  prefs: OfflinePreferences,
  connectionType: string | null
): string | undefined {
  if (canSyncNow(prefs, connectionType)) return undefined;
  return 'Waiting for Wi-Fi to sync. Change this in Profile → Storage.';
}
