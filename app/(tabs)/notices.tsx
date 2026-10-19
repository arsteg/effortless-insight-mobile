/**
 * Notices List Screen
 * Shows all notices with filtering and search
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { Search, Filter, FileText, Clock, AlertCircle, ChevronDown, Zap, Upload, Edit3, X } from 'lucide-react-native';
import { useNoticesInfinite, useCacheAge } from '../../src/hooks/useNotices';
import { getCachedNoticesAge } from '../../src/services/storage/cache';
import { useUIStore } from '../../src/stores';
import { LoadingSpinner, EmptyState, OfflineContentBadge } from '../../src/components/common';
import { NoticeDto, NoticeStatus, NoticePriority, NoticeSource } from '../../src/types';
import { SPACING, FONT_SIZES, BORDER_RADIUS, RISK_COLORS, STATUS_COLORS, PRIORITY_COLORS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';

/** Built per render so the labels follow the active language. */
const statusOptions = (
  t: (key: string) => string
): { label: string; value: NoticeStatus | 'all' }[] => [
  { label: t('notices.all'), value: 'all' },
  { label: t('notices.processing'), value: 'processing' },
  { label: t('notices.analyzed'), value: 'analyzed' },
  { label: t('notices.inProgress'), value: 'in_progress' },
  { label: t('notices.responded'), value: 'responded' },
  { label: t('notices.closed'), value: 'closed' },
];

export default function NoticesScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string; status?: string }>();

  const [search, setSearch] = useState('');
  const isOnline = useUIStore((state) => state.isOnline);
  const cachedAt = useCacheAge(getCachedNoticesAge);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<NoticeStatus | 'all'>(
    (params.status as NoticeStatus) || 'all'
  );
  const [showFilters, setShowFilters] = useState(false);

  // Debounce the search text so we don't fire a query on every keystroke
  // (audit B-search).
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handle);
  }, [search]);

  // Build query params
  const queryParams = useMemo(() => {
    const p: Record<string, unknown> = {};

    if (selectedStatus !== 'all') {
      p.status = selectedStatus;
    }
    if (debouncedSearch) {
      p.search = debouncedSearch;
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
  }, [selectedStatus, debouncedSearch, params.filter]);

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

  const totalCount = data?.pages[0]?.totalCount || 0;

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <LoadingSpinner size="small" />
      </View>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message={t('notices.loadingNotices')} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notices}
        renderItem={renderNotice}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <NoticesListHeader
            cachedAt={cachedAt}
            isOnline={isOnline}
            search={search}
            onSearchChange={setSearch}
            onClearSearch={() => setSearch('')}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
            totalCount={totalCount}
          />
        }
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

// A standalone component (not a useCallback-wrapped render function) passed
// to FlatList as a JSX element. React keeps the TextInput instance alive
// across re-renders because the element TYPE at this tree position never
// changes — only its props do. The previous approach passed a function whose
// identity changed on every keystroke (it depended on `search`), which made
// FlatList treat it as a brand-new component and remount the header —
// including the TextInput — after every single character (BUG-008).
function NoticesListHeader({
  cachedAt,
  isOnline,
  search,
  onSearchChange,
  onClearSearch,
  showFilters,
  onToggleFilters,
  selectedStatus,
  onSelectStatus,
  totalCount,
}: {
  cachedAt: number | null;
  isOnline: boolean;
  search: string;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  selectedStatus: NoticeStatus | 'all';
  onSelectStatus: (status: NoticeStatus | 'all') => void;
  totalCount: number;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();

  return (
    <View style={styles.header}>
      {/* Offline, say that this list is a saved copy and how old it is. */}
      <OfflineContentBadge cachedAt={cachedAt} visible={!isOnline} />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.gray[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('notices.searchPlaceholder')}
          placeholderTextColor={COLORS.gray[400]}
          value={search}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />
        {search.length > 0 && (
          // Clearing a 15-character GSTIN by backspace is 15 taps; this is one.
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClearSearch}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color={COLORS.gray[500]} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.filterButton} onPress={onToggleFilters}>
          <Filter size={20} color={showFilters ? COLORS.primary : COLORS.gray[500]} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      {showFilters && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>{t('notices.statusLabel')}</Text>
          <View style={styles.filterPills}>
            {statusOptions(t).map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterPill,
                  selectedStatus === option.value && styles.filterPillActive,
                ]}
                onPress={() => onSelectStatus(option.value)}
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
          {totalCount} {totalCount === 1 ? 'notice' : 'notices'}
        </Text>
      </View>
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
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const getStatusColor = (status: NoticeStatus) => {
    return STATUS_COLORS[status] || COLORS.gray[500];
  };

  const getRiskColor = (riskLevel?: string) => {
    if (!riskLevel) return COLORS.gray[400];
    return RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] || COLORS.gray[400];
  };

  const getPriorityColor = (priority?: string) => {
    if (!priority) return COLORS.gray[400];
    return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || COLORS.gray[400];
  };

  const formatCurrency = (amount?: number | null) => {
    if (!amount) return '-';
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const getSourceConfig = (source?: NoticeSource) => {
    switch (source) {
      case 'gstn_portal':
        return { icon: Zap, color: COLORS.success, label: t('notices.sourcePortal') };
      case 'manual':
        return { icon: Edit3, color: COLORS.gray[500], label: t('notices.sourceManual') };
      default:
        return { icon: Upload, color: COLORS.info, label: t('notices.sourceUpload') };
    }
  };

  const sourceConfig = getSourceConfig(notice.source);
  const SourceIcon = sourceConfig.icon;

  const statusColor = getStatusColor(notice.status);
  const riskColor = getRiskColor(notice.riskLevel);
  const priorityColor = getPriorityColor(notice.priority);

  // Deadline tone: overdue = coral, due today/≤3 = amber, else comfortable mint.
  // `== null` so a notice with no due date is caught whether the API omits
  // daysRemaining or sends it as null — the latter used to fall through to
  // the numeric branches below and render the literal word "null" (BUG-003:
  // "null days left").
  const days = notice.daysRemaining;
  const deadlineTone =
    days == null
      ? { fg: COLORS.gray[500], bg: COLORS.gray[100] }
      : days < 0
        ? { fg: COLORS.coral, bg: COLORS.coralLight }
        : days <= 3
          ? { fg: COLORS.amber, bg: COLORS.amberLight }
          : { fg: COLORS.mint, bg: COLORS.mintLight };

  return (
    <TouchableOpacity style={styles.noticeCard} onPress={onPress} activeOpacity={0.85}>
      {/* Risk-keyed left rail — the notice design language */}
      <View style={[styles.noticeRail, { backgroundColor: riskColor }]} />
      <View style={styles.noticeHeader}>
        <View style={styles.noticeTypeContainer}>
          <View style={styles.noticeTypeIcon}>
            <FileText size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.noticeType} numberOfLines={1}>{notice.noticeType || 'Notice'}</Text>
          {notice.source === 'gstn_portal' && (
            <View style={styles.sourceBadge}>
              <SourceIcon size={12} color={sourceConfig.color} />
            </View>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}1A` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
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
        {/* Deadline chip */}
        <View style={[styles.deadlineChip, { backgroundColor: deadlineTone.bg }]}>
          <Clock size={13} color={deadlineTone.fg} />
          <Text style={[styles.deadlineText, { color: deadlineTone.fg }]}>
            {days == null
              ? 'No due date'
              : days < 0
              ? `${Math.abs(days)}d overdue`
              : days === 0
              ? 'Due today'
              : `${days}d left`}
          </Text>
        </View>

        {/* Priority pill — distinct from the risk pill below. The app used
            to show only risk level here, which QA mistook for priority since
            it sat where web shows its Priority column (BUG-018: an overdue
            notice web marks High priority showed as "Low" here). */}
        {notice.priority && (
          <View style={[styles.riskBadge, { backgroundColor: `${priorityColor}1A` }]}>
            <View style={[styles.riskDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.riskText, { color: priorityColor }]}>
              {t('notices.priorityBadge', { value: t(`analysis.priority.${notice.priority}`) })}
            </Text>
          </View>
        )}

        {/* Risk pill */}
        {notice.riskLevel && (
          <View style={[styles.riskBadge, { backgroundColor: `${riskColor}1A` }]}>
            <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
            <Text style={[styles.riskText, { color: riskColor }]}>
              {t('notices.riskBadge', { value: t(`analysis.priority.${notice.riskLevel}`) })}
            </Text>
          </View>
        )}
      </View>

      {/* Overdue Warning */}
      {notice.daysRemaining != null && notice.daysRemaining < 0 && (
        <View style={styles.overdueWarning}>
          <AlertCircle size={14} color={COLORS.coral} />
          <Text style={styles.overdueText}>{t('notices.immediateAttention')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
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
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[200],
    marginRight: SPACING.xs,
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
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingRight: SPACING.md,
    paddingLeft: SPACING.md + 6,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  noticeRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
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
    flex: 1,
    marginRight: SPACING.sm,
  },
  noticeTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeType: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.gray[900],
    flexShrink: 1,
  },
  sourceBadge: {
    marginLeft: SPACING.xs,
    padding: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.success}15`,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
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
    fontWeight: '800',
    color: COLORS.gray[900],
    fontVariant: ['tabular-nums'],
  },
  noticeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  deadlineText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  riskText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
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
    color: COLORS.coral,
    fontWeight: '600',
  },
  footer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
});
