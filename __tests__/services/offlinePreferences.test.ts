/**
 * TC-MOB-061 — what the app may store and sync without asking.
 */

import {
  DEFAULT_OFFLINE_PREFERENCES,
  shouldAutoSaveDocument,
  canSyncNow,
  syncHeldReason,
  OfflinePreferences,
} from '../../src/utils/offlinePreferences';

const prefs = (over: Partial<OfflinePreferences> = {}): OfflinePreferences => ({
  ...DEFAULT_OFFLINE_PREFERENCES,
  ...over,
});

describe('defaults', () => {
  it('saves documents automatically — the one you opened is the one you want again', () => {
    expect(DEFAULT_OFFLINE_PREFERENCES.autoSaveDocuments).toBe(true);
  });

  it('does not restrict syncing to Wi-Fi by default', () => {
    // Holding a user's work back is worse than spending data they did not
    // explicitly protect.
    expect(DEFAULT_OFFLINE_PREFERENCES.syncOnWifiOnly).toBe(false);
  });
});

describe('shouldAutoSaveDocument', () => {
  it('follows the preference', () => {
    expect(shouldAutoSaveDocument(prefs({ autoSaveDocuments: true }))).toBe(true);
    expect(shouldAutoSaveDocument(prefs({ autoSaveDocuments: false }))).toBe(false);
  });
});

describe('canSyncNow', () => {
  it('allows any connection when the preference is off', () => {
    const off = prefs({ syncOnWifiOnly: false });
    expect(canSyncNow(off, 'cellular')).toBe(true);
    expect(canSyncNow(off, 'wifi')).toBe(true);
  });

  it('allows Wi-Fi and ethernet when the preference is on', () => {
    const on = prefs({ syncOnWifiOnly: true });
    expect(canSyncNow(on, 'wifi')).toBe(true);
    expect(canSyncNow(on, 'ethernet')).toBe(true);
  });

  it('blocks cellular when the preference is on', () => {
    expect(canSyncNow(prefs({ syncOnWifiOnly: true }), 'cellular')).toBe(false);
  });

  it('allows an unknown connection rather than stranding queued work', () => {
    // Refusing because the type could not be determined would hold uploads on
    // connections that are, in fact, Wi-Fi.
    const on = prefs({ syncOnWifiOnly: true });
    expect(canSyncNow(on, null)).toBe(true);
    expect(canSyncNow(on, 'unknown')).toBe(true);
  });
});

describe('syncHeldReason', () => {
  it('is undefined when syncing is allowed, so nothing is said', () => {
    expect(syncHeldReason(prefs(), 'cellular')).toBeUndefined();
    expect(syncHeldReason(prefs({ syncOnWifiOnly: true }), 'wifi')).toBeUndefined();
  });

  it('explains the hold and where to change it', () => {
    const reason = syncHeldReason(prefs({ syncOnWifiOnly: true }), 'cellular');
    expect(reason).toMatch(/Wi-Fi/);
    expect(reason).toMatch(/Storage/);
  });
});
