/**
 * Email Sync History Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, Link } from 'expo-router';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Timer,
  User,
  Sparkles,
  FileText,
} from 'lucide-react-native';
import { format } from 'date-fns';

import { useEmailSyncHistory } from '../../src/hooks/useEmailSync';
import type { EmailSyncLogEntry } from '../../src/types/emailSync';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';

function formatDuration(ms: number | undefined | null): string | null {
  if (ms === undefined || ms === null) return null;
  if (ms === 0) return '< 1ms';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'&]/g, '')
    .substring(0, 300);
}

function safeFormatDate(dateString: string, formatString: string): string {
  try {
    return format(new Date(dateString), formatString);
  } catch {
    return 'Invalid date';
  }
}

function getTriggerSourceLabel(source: string): string {
  switch (source) {
    case 'manual':
      return 'Manual';
    case 'scheduled':
      return 'Scheduled';
    case 'initial':
      return 'Initial';
    default:
      return source;
  }
}

export default function EmailSyncHistoryScreen() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const { accountId, email } = useLocalSearchParams<{
    accountId: string;
    email: string;
  }>();

  const { data, isLoading, error, refetch, isRefetching } = useEmailSyncHistory(accountId, 20);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Sync History',
        }}
      />

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <Text style={styles.headerEmail}>{email}</Text>
          <Text style={styles.headerSubtext}>Recent email sync activity</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={40} color={COLORS.error} />
            <Text style={styles.errorText}>Failed to load sync history</Text>
          </View>
        ) : data?.logs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FileText size={40} color={COLORS.gray[400]} />
            <Text style={styles.emptyText}>No sync history yet</Text>
            <Text style={styles.emptySubtext}>
              Sync history will appear here after the first sync
            </Text>
          </View>
        ) : (
          <View style={styles.logsList}>
            {data?.logs.map((log) => (
              <SyncLogEntry key={log.id} log={log} />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

function SyncLogEntry({ log }: { log: EmailSyncLogEntry }) {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const duration = formatDuration(log.durationMs);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return { bg: '#dcfce7', text: '#16a34a', icon: CheckCircle2, label: 'Completed' };
      case 'completed_with_warnings':
        return { bg: '#fef3c7', text: '#d97706', icon: AlertCircle, label: 'Warnings' };
      case 'failed':
        return { bg: '#fee2e2', text: '#dc2626', icon: AlertCircle, label: 'Failed' };
      case 'in_progress':
        return { bg: '#dbeafe', text: '#2563eb', icon: Clock, label: 'In Progress' };
      default:
        return { bg: '#f3f4f6', text: '#6b7280', icon: Clock, label: status };
    }
  };

  const statusInfo = getStatusBadge(log.status);
  const StatusIcon = statusInfo.icon;

  return (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.logBadges}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <StatusIcon size={12} color={statusInfo.text} />
            <Text style={[styles.statusText, { color: statusInfo.text }]}>
              {statusInfo.label}
            </Text>
          </View>
          <View style={styles.triggerBadge}>
            <Text style={styles.triggerText}>
              {getTriggerSourceLabel(log.triggerSource)}
            </Text>
          </View>
        </View>
        {duration && (
          <View style={styles.durationContainer}>
            <Timer size={12} color={COLORS.gray[500]} />
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        )}
      </View>

      <Text style={styles.logDate}>
        {safeFormatDate(log.startedAt, 'MMM d, yyyy h:mm a')}
      </Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{log.emailsScanned ?? 0}</Text>
          <Text style={styles.statLabel}>Scanned</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>
            {log.noticesImported ?? 0}
          </Text>
          <Text style={styles.statLabel}>Imported</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{log.duplicatesSkipped ?? 0}</Text>
          <Text style={styles.statLabel}>Duplicates</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.error }]}>
            {log.noticesFailed ?? 0}
          </Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* AI Usage */}
      {log.aiDetectionUsed > 0 && (
        <View style={styles.aiUsageRow}>
          <Sparkles size={12} color={COLORS.gray[500]} />
          <Text style={styles.aiUsageText}>
            AI detection used for {log.aiDetectionUsed} email{log.aiDetectionUsed > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {log.importedNoticeIds?.map((id, index) => (
        <Link key={id} href={`/notices/${id}`} style={{ color: COLORS.primary, marginVertical: 4 }}>View imported notice {index + 1}</Link>
      ))}
      {/* Error */}
      {log.errorMessage && (
        <View style={styles.errorBanner}>
          <AlertCircle size={14} color={COLORS.error} />
          <Text style={styles.errorBannerText} numberOfLines={3}>
            {sanitizeErrorMessage(log.errorMessage)}
          </Text>
        </View>
      )}

      {/* Triggered By */}
      {log.triggeredByName && (
        <View style={styles.triggeredByRow}>
          <User size={12} color={COLORS.gray[500]} />
          <Text style={styles.triggeredByText}>
            Triggered by {log.triggeredByName}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.gray[100],
    },
    headerInfo: {
      padding: SPACING.md,
      backgroundColor: COLORS.white,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.gray[200],
    },
    headerEmail: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      color: COLORS.gray[900],
    },
    headerSubtext: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[500],
      marginTop: 2,
    },
    loadingContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: SPACING.md,
      color: COLORS.gray[600],
    },
    errorContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    errorText: {
      marginTop: SPACING.md,
      color: COLORS.error,
      fontSize: FONT_SIZES.md,
    },
    emptyContainer: {
      padding: SPACING.xl,
      alignItems: 'center',
    },
    emptyText: {
      marginTop: SPACING.md,
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      color: COLORS.gray[600],
    },
    emptySubtext: {
      marginTop: SPACING.xs,
      color: COLORS.gray[500],
      textAlign: 'center',
    },
    logsList: {
      padding: SPACING.md,
    },
    logCard: {
      backgroundColor: COLORS.white,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      shadowColor: COLORS.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    logHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    logBadges: {
      flexDirection: 'row',
      gap: SPACING.xs,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.full,
      gap: 4,
    },
    statusText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
    },
    triggerBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: COLORS.gray[200],
    },
    triggerText: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.gray[600],
    },
    durationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    durationText: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.gray[500],
    },
    logDate: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[500],
      marginBottom: SPACING.sm,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: SPACING.sm,
      backgroundColor: COLORS.gray[100],
      borderRadius: BORDER_RADIUS.md,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: COLORS.gray[900],
    },
    statLabel: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.gray[500],
    },
    aiUsageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.sm,
      gap: 4,
    },
    aiUsageText: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.gray[500],
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: `${COLORS.error}10`,
      padding: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      marginTop: SPACING.sm,
      gap: SPACING.sm,
    },
    errorBannerText: {
      flex: 1,
      fontSize: FONT_SIZES.xs,
      color: COLORS.error,
    },
    triggeredByRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.sm,
      gap: 4,
    },
    triggeredByText: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.gray[500],
    },
  });
