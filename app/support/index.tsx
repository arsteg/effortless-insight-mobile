/**
 * Support Tickets List Screen
 *
 * In-app support: customers raise tickets here and the team replies in the
 * thread — no support email.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { LifeBuoy, MessageCircle, Plus, ChevronRight } from 'lucide-react-native';
import { useSupportTickets } from '../../src/hooks/useSupport';
import { SupportTicketSummary, SupportTicketStatus } from '../../src/services/api/support';
import { Button, LoadingSpinner, EmptyState } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS: Record<SupportTicketStatus, { bg: string; text: string }> = {
  open: { bg: COLORS.primary + '20', text: COLORS.primary },
  in_progress: { bg: COLORS.warning + '20', text: COLORS.warning },
  resolved: { bg: COLORS.success + '20', text: COLORS.success },
  closed: { bg: COLORS.gray[200], text: COLORS.gray[600] },
};

export default function SupportTicketsScreen() {
  const router = useRouter();
  const { data: tickets, isLoading, refetch, isRefetching } = useSupportTickets();

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading tickets..." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tickets ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => <TicketRow ticket={item} />}
        ListEmptyComponent={
          <EmptyState
            type="custom"
            icon={<LifeBuoy size={48} color={COLORS.gray[300]} />}
            title="No tickets yet"
            message="Stuck on something, found a problem, or have a billing question? Raise a ticket and a real person will reply."
            actionLabel="New ticket"
            onAction={() => router.push('/support/new')}
          />
        }
      />

      {(tickets?.length ?? 0) > 0 && (
        <View style={styles.footer}>
          <Button
            title="New ticket"
            fullWidth
            icon={<Plus size={18} color={COLORS.white} />}
            onPress={() => router.push('/support/new')}
          />
        </View>
      )}
    </View>
  );
}

function TicketRow({ ticket }: { ticket: SupportTicketSummary }) {
  const router = useRouter();
  const statusStyle = STATUS_COLORS[ticket.status];
  const showNewReply = ticket.hasUnreadSupportReply && ticket.status !== 'closed';

  return (
    <TouchableOpacity
      style={styles.ticketCard}
      onPress={() => router.push(`/support/${ticket.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.ticketMain}>
        <View style={styles.subjectRow}>
          <Text style={styles.subject} numberOfLines={1}>
            {ticket.subject}
          </Text>
          {showNewReply && (
            <View style={styles.newReplyBadge}>
              <Text style={styles.newReplyText}>New reply</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta}>
          Updated {formatDistanceToNow(new Date(ticket.lastMessageAt), { addSuffix: true })}
        </Text>
        <View style={styles.bottomRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {STATUS_LABELS[ticket.status]}
            </Text>
          </View>
          <View style={styles.messageCount}>
            <MessageCircle size={14} color={COLORS.gray[500]} />
            <Text style={styles.messageCountText}>{ticket.messageCount}</Text>
          </View>
        </View>
      </View>
      <ChevronRight size={20} color={COLORS.gray[400]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  ticketMain: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  subject: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  newReplyBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  newReplyText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  meta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  statusBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  messageCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageCountText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
});
