/**
 * Notices List Screen
 * Shows all notices with filtering and search
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search, Filter, FileText, Clock, AlertCircle, ChevronDown, Zap, Upload, Edit3 } from 'lucide-react-native';
import { useNoticesInfinite } from '../../src/hooks/useNotices';
import { LoadingSpinner, EmptyState } from '../../src/components/common';
import { NoticeDto, NoticeStatus, NoticePriority, NoticeSource } from '../../src/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RISK_COLORS, STATUS_COLORS } from '../../src/utils/constants';

const STATUS_OPTIONS: { label: string; value: NoticeStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Processing', value: 'processing' },
  { label: 'Analyzed', value: 'analyzed' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Responded', value: 'responded' },
  { label: 'Closed', value: 'closed' },
];

export default function NoticesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string; status?: string }>();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<NoticeStatus | 'all'>(
    (params.status as NoticeStatus) || 'all'
  );
  const [showFilters, setShowFilters] = useState(false);

  // Build query params
  const queryParams = useMemo(() => {
    const p: Record<string, unknown> = {};

    if (selectedStatus !== 'all') {
      p.status = selectedStatus;
    }
    if (search) {
      p.search = search;
    }

    // Handle special filters
    if (params.filter === 'overdue') {
      p.dueBefore = new Date().toISOString();
    } else if (params.filter === 'due-soon') {
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      p.dueBefore = weekFromNow.toISOString();
    }

    return p;
  }, [selectedStatus, search, params.filter]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useNoticesInfinite(queryParams);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const notices = useMemo(() => {
    return data?.pages.flatMap((page) => page.notices) || [];
  }, [data]);

  const renderNotice = useCallback(
    ({ item }: { item: NoticeDto }) => (
      <NoticeCard
        notice={item}
        onPress={() => router.push(`/notices/${item.id}`)}
      />
    ),
    [router]
  );

  const keyExtractor = useCallback((item: NoticeDto) => item.id, []);

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.gray[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notices..."
          placeholderTextColor={COLORS.gray[400]}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color={showFilters ? COLORS.primary : COLORS.gray[500]} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      {showFilters && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Status:</Text>
          <View style={styles.filterPills}>
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterPill,
                  selectedStatus === option.value && styles.filterPillActive,
                ]}
                onPress={() => setSelectedStatus(option.value)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selectedStatus === option.value && styles.filterPillTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {data?.pages[0]?.totalCount || 0} notices
        </Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <LoadingSpinner size="small" />
      </View>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading notices..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notices}
        renderItem={renderNotice}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <EmptyState
            type="notices"
            actionLabel="Upload Notice"
            onAction={() => router.push('/upload')}
          />
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function NoticeCard({
  notice,
  onPress,
}: {
  notice: NoticeDto;
  onPress: () => void;
}) {
  const getStatusColor = (status: NoticeStatus) => {
    return STATUS_COLORS[status] || COLORS.gray[500];
  };

  const getRiskColor = (riskLevel?: string) => {
    if (!riskLevel) return COLORS.gray[400];
    return RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] || COLORS.gray[400];
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const getSourceConfig = (source?: NoticeSource) => {
    switch (source) {
      case 'gstn_portal':
        return { icon: Zap, color: COLORS.success, label: 'Portal' };
      case 'manual':
        return { icon: Edit3, color: COLORS.gray[500], label: 'Manual' };
      default:
        return { icon: Upload, color: COLORS.info, label: 'Upload' };
    }
  };

  const sourceConfig = getSourceConfig(notice.source);
  const SourceIcon = sourceConfig.icon;

  return (
    <TouchableOpacity style={styles.noticeCard} onPress={onPress}>
      <View style={styles.noticeHeader}>
        <View style={styles.noticeTypeContainer}>
          <FileText size={20} color={COLORS.gray[500]} />
          <Text style={styles.noticeType}>{notice.noticeType || 'Notice'}</Text>
          {notice.source === 'gstn_portal' && (
            <View style={styles.sourceBadge}>
              <SourceIcon size={12} color={sourceConfig.color} />
            </View>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(notice.status) }]}>
          <Text style={styles.statusText}>
            {notice.status.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
          </Text>
        </View>
      </View>

      <View style={styles.noticeBody}>
        {notice.noticeNumber && (
          <Text style={styles.noticeNumber}>#{notice.noticeNumber}</Text>
        )}
        <Text style={styles.noticeAmount}>{formatCurrency(notice.taxAmount)}</Text>
      </View>

      <View style={styles.noticeFooter}>
        {/* Deadline */}
        <View style={styles.deadlineContainer}>
          <Clock size={14} color={COLORS.gray[500]} />
          <Text style={styles.deadlineText}>
            {notice.daysRemaining !== undefined
              ? notice.daysRemaining < 0
                ? `${Math.abs(notice.daysRemaining)} days overdue`
                : notice.daysRemaining === 0
                ? 'Due today'
                : `${notice.daysRemaining} days left`
              : 'No deadline'}
          </Text>
        </View>

        {/* Risk Level */}
        {notice.riskLevel && (
          <View style={[styles.riskBadge, { backgroundColor: getRiskColor(notice.riskLevel) }]}>
            <Text style={styles.riskText}>
              {notice.riskLevel.charAt(0).toUpperCase() + notice.riskLevel.slice(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Overdue Warning */}
      {notice.daysRemaining !== undefined && notice.daysRemaining < 0 && (
        <View style={styles.overdueWarning}>
          <AlertCircle size={14} color={COLORS.error} />
          <Text style={styles.overdueText}>Immediate attention required</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    backgroundColor: COLORS.white,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[100],
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  filterButton: {
    padding: SPACING.xs,
  },
  filterContainer: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  filterLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.xs,
  },
  filterPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  filterPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  filterPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  filterPillTextActive: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  resultsHeader: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  resultsCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  list: {
    paddingBottom: SPACING.xxl,
  },
  noticeCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  noticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  noticeTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  noticeType: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  sourceBadge: {
    marginLeft: SPACING.xs,
    padding: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.success}15`,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: COLORS.white,
  },
  noticeBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  noticeNumber: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  noticeAmount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  noticeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deadlineText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  riskBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  riskText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: COLORS.white,
  },
  overdueWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  overdueText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    fontWeight: '500',
  },
  footer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
});
