/**
 * Offline Banner Component
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, AppState } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useUIStore, useOfflineStore } from '../../stores';
import { listPendingUploads, syncPendingUploads } from '../../services/pendingUploads';
import { pendingSummary, syncableUploads } from '../../utils/pendingUploadPolicy';
import type { PendingUpload } from '../../utils/pendingUploadPolicy';
import { SPACING, FONT_SIZES } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';

export function OfflineBanner() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const { isOnline } = useUIStore();
  const { queuePending, isSyncing, syncQueue } = useOfflineStore();

  // Scans waiting to upload are counted here too: they are the queued work a
  // user is most likely to be anxious about, and were previously invisible
  // (TC-MOB-058).
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const hasPendingWork = pendingUploads.length > 0;

  /**
   * Re-read the queue so the count clears once uploads drain, without needing
   * every screen to push updates into this banner.
   *
   * Two things keep it from being a battery cost (TC-MOB-085). It stops while
   * the app is backgrounded — this banner is mounted app-wide, so a bare
   * interval read AsyncStorage every five seconds all day, including in the
   * user's pocket. And it backs off to 30s when there is nothing queued, which
   * is almost always; the fast cadence only matters while work is draining.
   */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = () =>
      listPendingUploads().then((items) => {
        if (!cancelled) setPendingUploads(items);
      });

    const start = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(load, hasPendingWork ? 5000 : 30000);
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    void load();
    if (AppState.currentState === 'active') start();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void load(); // catch up on anything that drained while away
        start();
      } else {
        stop();
      }
    });

    return () => {
      cancelled = true;
      stop();
      subscription.remove();
    };
  }, [isOnline, hasPendingWork]);

  // Only work that can still sync belongs in the banner. A blocked upload has
  // exhausted its retries and needs a decision from the user, so counting it
  // here kept the bar on screen permanently while online — it looked like the
  // header had grown taller on every tab. Blocked items are surfaced in
  // Profile -> Storage, where Retry and Discard live.
  const pendingSyncable = syncableUploads(pendingUploads);
  const uploadSummary = pendingSummary(pendingSyncable);
  const hasWork = queuePending > 0 || pendingSyncable.length > 0;

  if (isOnline && !hasWork) {
    return null;
  }

  const handleSync = async () => {
    if (isOnline && !isSyncing) {
      await syncQueue();
      await syncPendingUploads();
      setPendingUploads(await listPendingUploads());
    }
  };

  return (
    <View style={[styles.container, isOnline ? styles.syncPending : styles.offline]}>
      <View style={styles.content}>
        <WifiOff size={16} color={COLORS.white} />
        <Text style={styles.text}>
          {isOnline
            ? [
                queuePending > 0 ? `${queuePending} pending changes` : null,
                uploadSummary,
              ]
                .filter(Boolean)
                .join(' · ') || 'Syncing'
            : uploadSummary
            ? `You are offline · ${uploadSummary}`
            : 'You are offline'}
        </Text>
      </View>
      {isOnline && hasWork && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw
            size={14}
            color={COLORS.white}
            style={isSyncing ? styles.spinning : undefined}
          />
          <Text style={styles.syncText}>{isSyncing ? 'Syncing...' : 'Sync'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  offline: {
    backgroundColor: COLORS.gray[700],
  },
  syncPending: {
    backgroundColor: COLORS.warning,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  text: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  syncText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  spinning: {
    // Animation would be handled by Reanimated in production
  },
});
