/**
 * UsageBar Component
 * Usage meter for notices, users, storage
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FileText, Users, Database, Sparkles } from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { UsageMetricDto, StorageUsageDto } from '../../types';

interface UsageBarProps {
  used: number;
  limit: number;
  percentage: number;
  label: string;
  type: 'notices' | 'users' | 'storage' | 'aiAnalyses';
  suffix?: string;
}

export function UsageBar({ used, limit, percentage, label, type, suffix = '' }: UsageBarProps) {
  const getIcon = () => {
    const size = 18;
    const color = COLORS.gray[400];
    switch (type) {
      case 'notices':
        return <FileText size={size} color={color} />;
      case 'users':
        return <Users size={size} color={color} />;
      case 'storage':
        return <Database size={size} color={color} />;
      case 'aiAnalyses':
        return <Sparkles size={size} color={color} />;
    }
  };

  // Consider unlimited if limit is 0 or very high (>= 10000)
  const isUnlimited = limit === 0 || limit >= 10000;

  const getProgressColor = () => {
    if (isUnlimited) return COLORS.primary;
    if (percentage >= 90) return COLORS.error;
    if (percentage >= 75) return COLORS.warning;
    return COLORS.primary;
  };

  const formatValue = () => {
    return `${used}${suffix}`;
  };

  const formatLimit = () => {
    if (isUnlimited) {
      return 'Unlimited';
    }
    return `${limit}${suffix}`;
  };

  const progressWidth = isUnlimited ? 20 : Math.min(percentage, 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelContainer}>
          {getIcon()}
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.value}>
          {formatValue()} / {formatLimit()}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progressWidth}%`,
              backgroundColor: getProgressColor(),
            },
          ]}
        />
      </View>

      {!isUnlimited && percentage >= 75 && (
        <Text
          style={[
            styles.warningText,
            { color: percentage >= 90 ? COLORS.error : COLORS.warning },
          ]}
        >
          {percentage >= 90
            ? 'You have almost reached your limit'
            : 'You are approaching your limit'}
        </Text>
      )}
    </View>
  );
}

interface UsageSummaryProps {
  notices: UsageMetricDto;
  users: UsageMetricDto;
  storage: StorageUsageDto;
  apiCalls: UsageMetricDto | null;
}

export function UsageSummary({ notices, users, storage, apiCalls }: UsageSummaryProps) {
  return (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>Usage This Period</Text>
      <View style={styles.summaryGrid}>
        <UsageBar
          used={notices.used}
          limit={notices.limit}
          percentage={notices.percentage}
          label="Notices"
          type="notices"
        />
        <UsageBar
          used={users.used}
          limit={users.limit}
          percentage={users.percentage}
          label="Team Members"
          type="users"
        />
        <UsageBar
          used={storage.usedGb}
          limit={storage.limitGb}
          percentage={storage.percentage}
          label="Storage"
          type="storage"
          suffix=" GB"
        />
        {apiCalls && (
          <UsageBar
            used={apiCalls.used}
            limit={apiCalls.limit}
            percentage={apiCalls.percentage}
            label="API Calls"
            type="aiAnalyses"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  value: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  progressContainer: {
    height: 6,
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  warningText: {
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  summaryContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  summaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.lg,
  },
  summaryGrid: {
    gap: SPACING.md,
  },
});
