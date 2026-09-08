/**
 * Support Ticket Thread Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { LifeBuoy, Send, User, CheckCircle2 } from 'lucide-react-native';
import {
  useSupportTicket,
  useReplyToSupportTicket,
  useCloseSupportTicket,
} from '../../src/hooks/useSupport';
import { SupportTicketMessage, SupportTicketStatus } from '../../src/services/api/support';
import { Button, Input, LoadingSpinner, EmptyState } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export default function SupportTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reply, setReply] = useState('');

  const { data: ticket, isLoading } = useSupportTicket(id);
  const replyMutation = useReplyToSupportTicket();
  const closeMutation = useCloseSupportTicket();

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading ticket..." />;
  }

  if (!ticket) {
    return (
      <EmptyState
        type="error"
        title="Ticket not found"
        actionLabel="Back to Support"
        onAction={() => router.back()}
      />
    );
  }

  const isClosed = ticket.status === 'closed';

  const handleSend = () => {
    const message = reply.trim();
    if (!message) return;
    replyMutation.mutate(
      { ticketId: ticket.id, message },
      {
        onSuccess: () => setReply(''),
        onError: () => Alert.alert('Could not send reply', 'Please try again in a moment.'),
      }
    );
  };

  const handleClose = () => {
    Alert.alert('Close this ticket?', 'Close it once your issue is sorted.', [
      { text: 'Keep open', style: 'cancel' },
      {
        text: 'Close ticket',
        style: 'destructive',
        onPress: () => closeMutation.mutate(ticket.id),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header card */}
      <View style={styles.header}>
        <Text style={styles.subject} numberOfLines={2}>
          {ticket.subject}
        </Text>
        <View style={styles.headerRow}>
          <Text style={styles.statusLabel}>{STATUS_LABELS[ticket.status]}</Text>
          {!isClosed && (
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <CheckCircle2 size={14} color={COLORS.gray[600]} />
              <Text style={styles.closeButtonText}>Close ticket</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={ticket.messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => <MessageBubble message={item} />}
      />

      {isClosed ? (
        <View style={styles.closedFooter}>
          <Text style={styles.closedText}>
            This ticket is closed. Need more help? Open a new ticket.
          </Text>
          <Button
            title="New ticket"
            variant="outline"
            size="sm"
            onPress={() => router.push('/support/new')}
          />
        </View>
      ) : (
        <View style={styles.replyBar}>
          {ticket.status === 'resolved' && (
            <Text style={styles.reopenHint}>
              This ticket is marked resolved — replying will reopen it.
            </Text>
          )}
          <View style={styles.replyRow}>
            <Input
              value={reply}
              placeholder="Write a reply…"
              onChangeText={setReply}
              multiline
              containerStyle={styles.replyInput}
            />
            <Button
              title="Send"
              size="sm"
              loading={replyMutation.isPending}
              disabled={reply.trim().length === 0 || replyMutation.isPending}
              onPress={handleSend}
              icon={<Send size={16} color={COLORS.white} />}
            />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: SupportTicketMessage }) {
  const fromSupport = message.isFromSupport;

  return (
    <View style={[styles.bubbleRow, fromSupport ? styles.bubbleLeft : styles.bubbleRight]}>
      <View style={[styles.bubble, fromSupport ? styles.bubbleSupport : styles.bubbleMine]}>
        <View style={styles.bubbleHeader}>
          {fromSupport ? (
            <LifeBuoy size={12} color={COLORS.gray[500]} />
          ) : (
            <User size={12} color={COLORS.gray[500]} />
          )}
          <Text style={styles.bubbleSender}>{message.senderName}</Text>
          <Text style={styles.bubbleTime}>
            {format(new Date(message.createdAt), 'd MMM, h:mm a')}
          </Text>
        </View>
        <Text style={styles.bubbleBody}>{message.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  subject: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  statusLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  closeButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
  },
  messages: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  bubbleRow: {
    marginBottom: SPACING.sm,
    flexDirection: 'row',
  },
  bubbleLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  bubbleSupport: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.gray[200],
  },
  bubbleMine: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary + '30',
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  bubbleSender: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
  bubbleTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
  },
  bubbleBody: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[800],
    lineHeight: 20,
  },
  replyBar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    padding: SPACING.sm,
  },
  reopenHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginBottom: SPACING.xs,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  replyInput: {
    flex: 1,
    marginBottom: 0,
  },
  closedFooter: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  closedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    textAlign: 'center',
  },
});
