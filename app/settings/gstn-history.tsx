/**
 * GSTN Sync History Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  User,
  AlertTriangle,
} from 'lucide-react-native';
import { format, formatDistanceToNow } from 'date-fns';

import { useGstnSyncHistory } from '../../src/hooks/useGstn';
import type { GstnSyncLogEntry } from '../../src/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number | undefined | null): string | null {
  if (ms === undefined || ms === null) return null;
  if (ms === 0) return '< 1ms';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Sanitize error message to prevent injection
 */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'&]/g, '')
    .substring(0, 300);
}

/**
 * Safely format a date string
 */
function safeFormatDate(dateString: string, formatString: string): string {
  try {
    return format(new Date(dateString), formatString);
  } catch {
    return 'Invalid date';
  }
}

export default function GstnHistoryScreen() {
  const params = useLocalSearchParams<{
    gstinId: string;
    gstin: string;
  }>();

  const { data, isLoading, refetch, isRefetching } = useGstnSyncHistory(params.gstinId || '', 50);

  const renderItem = ({ item }: { item: GstnSyncLogEntry }) => (
    <SyncLogCard log={item} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <RefreshCw size={48} color={COLORS.gray[300]} />
      <Text style={styles.emptyTitle}>No Sync History</Text>
      <Text style={styles.emptyText}>
        Sync history will appear here after your first sync.
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Sync History',
          headerBackTitle: 'Settings',
        }}
      />

      {/* GSTIN Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>GSTIN</Text>
        <Text style={styles.headerGstin}>{params.gstin}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <FlatList
          data={data?.logs || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </>
  );
}

function SyncLogCard({ log }: { log: GstnSyncLogEntry }) {
  const isSuccess = log.status === 'completed';
  const isFailed = log.status === 'failed';
  const isPartial = log.status === 'partial';

  const getStatusIcon = () => {
    if (isSuccess) return <CheckCircle size={20} color={COLORS.success} />;
    if (isFailed) return <XCircle size={20} color={COLORS.error} />;
    if (isPartial) return <AlertTriangle size={20} color={COLORS.warning} />;
    return <RefreshCw size={20} color={COLORS.info} />;
  };

  const getStatusColor = () => {
    if (isSuccess) return COLORS.success;
    if (isFailed) return COLORS.error;
    if (isPartial) return COLORS.warning;
    return COLORS.info;
  };

  const getStatusLabel = () => {
    switch (log.status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'partial':
        return 'Partial';
      case 'in_progress':
        return 'In Progress';
      default:
        return log.status;
    }
  };

  const duration = formatDuration(log.durationMs);

  return (
    <View style={styles.card} accessible={true} accessibilityRole="none">
      {/* Header */}
      <View style={styles.cardHeader}>
        {getStatusIcon()}
        <View style={styles.cardHeaderText}>
          <Text style={[styles.statusLabel, { color: getStatusColor() }]}>
            {getStatusLabel()}
          </Text>
          <Text style={styles.syncTime}>
            {safeFormatDate(log.startedAt, 'MMM d, yyyy h:mm a')}
          </Text>
        </View>
        <View style={[styles.typeBadge, log.triggerSource === 'manual' && styles.typeBadgeManual]}>
          <Text
            style={[
              styles.typeBadgeText,
              log.triggerSource === 'manual' && styles.typeBadgeTextManual,
            ]}
          >
            {log.triggerSource === 'manual' ? 'Manual' : 'Auto'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow} accessibilityRole="none" accessibilityLabel="Sync statistics">
        <View style={styles.stat}>
          <Text style={styles.statValue}>{log.noticesFound ?? 0}</Text>
          <Text style={styles.statLabel}>Found</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>
            {log.noticesImported ?? 0}
          </Text>
          <Text style={styles.statLabel}>Imported</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{log.noticesSkipped ?? 0}</Text>
          <Text style={styles.statLabel}>Skipped</Text>
        </View>
        {(log.noticesFailed ?? 0) > 0 && (
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: COLORS.error }]}>
              {log.noticesFailed}
            </Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Clock size={14} color={COLORS.gray[400]} />
          <Text style={styles.detailText}>
            {safeFormatDate(log.startedAt, 'MMM d, yyyy h:mm a')}
          </Text>
        </View>
        {duration && (
          <View style={styles.detailRow}>
            <RefreshCw size={14} color={COLORS.gray[400]} />
            <Text style={styles.detailText}>Duration: {duration}</Text>
          </View>
        )}
        {log.triggeredByName && log.triggerSource === 'manual' && (
          <View style={styles.detailRow}>
            <User size={14} color={COLORS.gray[400]} />
            <Text style={styles.detailText}>By {log.triggeredByName}</Text>
          </View>
        )}
      </View>

      {/* Error Message */}
      {log.errorMessage && (
        <View style={styles.errorContainer} accessibilityRole="alert">
          <XCircle size={14} color={COLORS.error} />
          <Text style={styles.errorText}>{sanitizeErrorMessage(log.errorMessage)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  headerLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerGstin: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: COLORS.gray[900],
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[100],
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.gray[500],
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
    backgroundColor: COLORS.gray[100],
  },
  separator: {
    height: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[600],
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  statusLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  syncTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
  },
  typeBadgeManual: {
    backgroundColor: COLORS.primaryLight,
  },
  typeBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  typeBadgeTextManual: {
    color: COLORS.primary,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  details: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginLeft: SPACING.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: '#fef2f2',
    borderRadius: BORDER_RADIUS.md,
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },
});
