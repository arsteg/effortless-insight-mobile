/**
 * Offline Banner Component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useUIStore, useOfflineStore } from '../../stores';
import { COLORS, SPACING, FONT_SIZES } from '../../utils/constants';

export function OfflineBanner() {
  const { isOnline } = useUIStore();
  const { queuePending, isSyncing, syncQueue } = useOfflineStore();

  if (isOnline && queuePending === 0) {
    return null;
  }

  const handleSync = async () => {
    if (isOnline && !isSyncing) {
      await syncQueue();
    }
  };

  return (
    <View style={[styles.container, isOnline ? styles.syncPending : styles.offline]}>
      <View style={styles.content}>
        <WifiOff size={16} color={COLORS.white} />
        <Text style={styles.text}>
          {isOnline
            ? `${queuePending} pending changes to sync`
            : 'You are offline'}
        </Text>
      </View>
      {isOnline && queuePending > 0 && (
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

const styles = StyleSheet.create({
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
