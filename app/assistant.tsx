/**
 * EI Assistant — app-wide chat screen (text + voice).
 *
 * Uses the gateway's non-streaming sync endpoint (mobile-friendly).
 * Writes proposed by the assistant render as confirmation cards; nothing
 * executes until the user taps Confirm, and then the app itself calls the
 * regular API endpoint with the user's own session.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  Bot,
  Check,
  History,
  Mic,
  Plus,
  Send,
  ShieldQuestion,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';

import { useThemedStyles, useColors } from '../src/theme/useTheme';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../src/utils/constants';
import { apiClient, getApiErrorMessage } from '../src/services/api/client';
import { useAssistantChat, useAssistantConversations } from '../src/hooks/useAssistant';
import {
  speakReply,
  stopSpeaking,
  useAssistantVoiceInput,
} from '../src/hooks/useAssistantVoice';
import type {
  AssistantAction,
  AssistantConfirmAction,
  AssistantMessageDto,
  AssistantNavigateAction,
} from '../src/types/assistant';

const SUGGESTED_QUESTIONS = [
  'Show my notices that are due soon',
  'What does a DRC-01 notice mean?',
  'How do I reply to a notice?',
  'What can you help me with?',
];

const AI_DISCLAIMER =
  'AI-generated for guidance only — not legal or tax advice. Verify details with your CA.';

export default function AssistantScreen() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const params = useLocalSearchParams<{ noticeId?: string; route?: string }>();

  const clientContext = useMemo(
    () => ({ route: params.route ?? null, noticeId: params.noticeId ?? null }),
    [params.noticeId, params.route]
  );

  const {
    conversationId,
    switchConversation,
    messages,
    pending,
    error,
    clearError,
    isSending,
    sendMessage,
    startNewConversation,
  } = useAssistantChat(clientContext);

  const conversationsQuery = useAssistantConversations();
  const [input, setInput] = useState('');
  const [speakReplies, setSpeakReplies] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef<FlatList>(null);
  const lastSpokenIdRef = useRef<string | null>(null);

  const voice = useAssistantVoiceInput((transcript) => {
    setInput((previous) => (previous ? previous + ' ' : '') + transcript);
  });

  // Speak new assistant replies when enabled
  useEffect(() => {
    if (!speakReplies) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.isError);
    if (lastAssistant && lastAssistant.id !== lastSpokenIdRef.current) {
      lastSpokenIdRef.current = lastAssistant.id;
      speakReply(lastAssistant.content);
    }
  }, [messages, speakReplies]);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages.length, pending]);

  const handleSend = () => {
    const content = input.trim();
    if (!content || isSending) return;
    setInput('');
    sendMessage(content);
  };

  type ListItem =
    | { key: string; kind: 'message'; message: AssistantMessageDto }
    | { key: string; kind: 'pending-user'; content: string }
    | { key: string; kind: 'typing' };

  const listItems: ListItem[] = [
    ...messages.map((message) => ({ key: message.id, kind: 'message' as const, message })),
    ...(pending
      ? [
          { key: 'pending-user', kind: 'pending-user' as const, content: pending.userContent },
          ...(pending.inFlight ? [{ key: 'typing', kind: 'typing' as const }] : []),
        ]
      : []),
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Toolbar: new chat / history / speak toggle */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={startNewConversation}
          accessibilityLabel="New chat"
        >
          <Plus size={18} color={COLORS.gray[600]} />
          <Text style={styles.toolbarButtonText}>New</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setShowHistory((value) => !value)}
          accessibilityLabel="Conversation history"
        >
          <History size={18} color={COLORS.gray[600]} />
          <Text style={styles.toolbarButtonText}>History</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => {
            if (speakReplies) stopSpeaking();
            setSpeakReplies((value) => !value);
          }}
          accessibilityLabel={speakReplies ? 'Stop speaking replies' : 'Speak replies aloud'}
        >
          {speakReplies ? (
            <Volume2 size={18} color={COLORS.primary} />
          ) : (
            <VolumeX size={18} color={COLORS.gray[500]} />
          )}
        </TouchableOpacity>
      </View>

      {showHistory && (
        <View style={styles.historyPanel}>
          {(conversationsQuery.data?.conversations ?? []).slice(0, 8).map((conversation) => (
            <TouchableOpacity
              key={conversation.id}
              style={[
                styles.historyItem,
                conversation.id === conversationId && styles.historyItemActive,
              ]}
              onPress={() => {
                switchConversation(conversation.id);
                setShowHistory(false);
              }}
            >
              <Text style={styles.historyItemText} numberOfLines={1}>
                {conversation.title}
              </Text>
            </TouchableOpacity>
          ))}
          {!conversationsQuery.data?.conversations?.length && (
            <Text style={styles.historyEmpty}>No conversations yet</Text>
          )}
        </View>
      )}

      {listItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Sparkles size={36} color={COLORS.lavender} />
          <Text style={styles.emptyTitle}>How can I help?</Text>
          <Text style={styles.emptySubtitle}>
            Ask about your GST notices, deadlines, or how to use the app.
          </Text>
          {SUGGESTED_QUESTIONS.map((question) => (
            <TouchableOpacity
              key={question}
              style={styles.suggestionChip}
              onPress={() => sendMessage(question)}
            >
              <Text style={styles.suggestionText}>{question}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.kind === 'pending-user') {
              return <UserBubble content={item.content} styles={styles} />;
            }
            if (item.kind === 'typing') {
              return (
                <View style={styles.typingRow}>
                  <BotAvatar styles={styles} COLORS={COLORS} />
                  <View style={styles.assistantBubble}>
                    <ActivityIndicator size="small" color={COLORS.gray[500]} />
                  </View>
                </View>
              );
            }
            const { message } = item;
            return message.role === 'user' ? (
              <UserBubble content={message.content} styles={styles} />
            ) : (
              <AssistantBubbleView message={message} styles={styles} COLORS={COLORS} />
            );
          }}
        />
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <X size={16} color={COLORS.coral} />
          </TouchableOpacity>
        </View>
      )}
      {voice.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{voice.error}</Text>
          <TouchableOpacity onPress={voice.clearError}>
            <X size={16} color={COLORS.coral} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={
            voice.isRecording
              ? 'Listening… tap ■ when done'
              : voice.isTranscribing
                ? 'Transcribing…'
                : 'Ask the assistant…'
          }
          placeholderTextColor={COLORS.gray[400]}
          multiline
          editable={!voice.isRecording}
          testID="assistant-input"
        />
        <TouchableOpacity
          style={[styles.iconButton, voice.isRecording && styles.iconButtonActive]}
          onPress={() => (voice.isRecording ? voice.stopAndTranscribe() : voice.start())}
          disabled={voice.isTranscribing}
          accessibilityLabel={voice.isRecording ? 'Stop and transcribe' : 'Speak your question'}
          testID="assistant-mic"
        >
          {voice.isTranscribing ? (
            <ActivityIndicator size="small" color={COLORS.gray[500]} />
          ) : voice.isRecording ? (
            <Square size={18} color={COLORS.white} />
          ) : (
            <Mic size={18} color={COLORS.gray[600]} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, styles.sendButton, (!input.trim() || isSending) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isSending}
          accessibilityLabel="Send"
          testID="assistant-send"
        >
          <Send size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>{AI_DISCLAIMER}</Text>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------- bubbles --

function BotAvatar({ styles, COLORS }: any) {
  return (
    <View style={styles.botAvatar}>
      <Bot size={14} color={COLORS.lavender} />
    </View>
  );
}

function UserBubble({ content, styles }: { content: string; styles: any }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{content}</Text>
      </View>
    </View>
  );
}

function AssistantBubbleView({
  message,
  styles,
  COLORS,
}: {
  message: AssistantMessageDto;
  styles: any;
  COLORS: any;
}) {
  return (
    <View style={styles.assistantRow}>
      <BotAvatar styles={styles} COLORS={COLORS} />
      <View style={{ flex: 1 }}>
        <View style={[styles.assistantBubble, message.isError && styles.errorBubble]}>
          <Text style={[styles.assistantText, message.isError && styles.errorBubbleText]}>
            {message.content}
          </Text>
        </View>
        {!!message.citations?.length && (
          <View style={styles.citationsRow}>
            {message.citations.map((citation) => (
              <View key={citation} style={styles.citationChip}>
                <Text style={styles.citationText}>{citation}</Text>
              </View>
            ))}
          </View>
        )}
        {!!message.actions?.length && (
          <ActionList actions={message.actions} styles={styles} COLORS={COLORS} />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- actions --

export function ActionList({
  actions,
  styles,
  COLORS,
}: {
  actions: AssistantAction[];
  styles: any;
  COLORS: any;
}) {
  return (
    <View style={styles.actionsColumn}>
      {actions.map((action, index) =>
        action.type === 'navigate' ? (
          <NavigateButton key={`nav-${index}`} action={action} styles={styles} COLORS={COLORS} />
        ) : (
          <ConfirmCard key={`confirm-${index}`} action={action} styles={styles} COLORS={COLORS} />
        )
      )}
    </View>
  );
}

export function NavigateButton({
  action,
  styles,
  COLORS,
}: {
  action: AssistantNavigateAction;
  styles: any;
  COLORS: any;
}) {
  if (!action.mobileRoute) {
    return action.webOnlyNote ? (
      <Text style={styles.webOnlyNote}>{action.webOnlyNote}</Text>
    ) : null;
  }
  return (
    <TouchableOpacity
      style={styles.navigateButton}
      onPress={() => router.push(action.mobileRoute as never)}
    >
      <Text style={styles.navigateText}>{action.label}</Text>
      <ArrowRight size={14} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

type ConfirmState = 'idle' | 'running' | 'done' | 'dismissed' | 'failed';

export function ConfirmCard({
  action,
  styles,
  COLORS,
}: {
  action: AssistantConfirmAction;
  styles: any;
  COLORS: any;
}) {
  const [state, setState] = useState<ConfirmState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const execute = async () => {
    setState('running');
    try {
      const path = action.path.replace(/^\/api\/v1/, '');
      if (action.method === 'PUT') {
        await apiClient.put(path, action.body);
      } else {
        await apiClient.post(path, action.body);
      }
      setState('done');
    } catch (err) {
      setState('failed');
      setMessage(getApiErrorMessage(err));
    }
  };

  if (state === 'dismissed') return null;

  return (
    <View style={styles.confirmCard}>
      <View style={styles.confirmHeader}>
        <ShieldQuestion size={14} color={COLORS.lavender} />
        <Text style={styles.confirmTitle}>Needs your confirmation</Text>
      </View>
      <Text style={styles.confirmSummary}>{action.summary}</Text>

      {state === 'done' && (
        <View style={styles.confirmDoneRow}>
          <Check size={14} color={COLORS.mint} />
          <Text style={styles.confirmDoneText}>Done</Text>
        </View>
      )}
      {state === 'failed' && message && <Text style={styles.confirmFailedText}>{message}</Text>}

      {(state === 'idle' || state === 'running') && (
        <View style={styles.confirmButtons}>
          <Pressable
            style={[styles.confirmButton, state === 'running' && styles.sendDisabled]}
            onPress={execute}
            disabled={state === 'running'}
            testID="assistant-confirm"
          >
            {state === 'running' ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.dismissButton}
            onPress={() => setState('dismissed')}
            disabled={state === 'running'}
          >
            <Text style={styles.dismissButtonText}>Not now</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ----------------------------------------------------------------- styles --

export const createStyles = (COLORS: any) => ({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  toolbar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  toolbarButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  toolbarButtonText: { fontSize: FONT_SIZES.sm, color: COLORS.gray[600] },
  historyPanel: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
    paddingVertical: SPACING.xs,
  },
  historyItem: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  historyItemActive: { backgroundColor: COLORS.gray[100] },
  historyItemText: { fontSize: FONT_SIZES.sm, color: COLORS.gray[800] },
  historyEmpty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600' as const, color: COLORS.gray[900] },
  emptySubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: 'center' as const,
    marginBottom: SPACING.sm,
  },
  suggestionChip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  suggestionText: { fontSize: FONT_SIZES.sm, color: COLORS.gray[700] },
  listContent: { padding: SPACING.md, gap: SPACING.sm },
  userRow: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const },
  userBubble: {
    maxWidth: '85%' as const,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  userText: { color: COLORS.white, fontSize: FONT_SIZES.md },
  assistantRow: { flexDirection: 'row' as const, gap: SPACING.sm },
  typingRow: { flexDirection: 'row' as const, gap: SPACING.sm, marginTop: SPACING.sm },
  botAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.lavenderLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 2,
  },
  assistantBubble: {
    maxWidth: '90%' as const,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.xl,
    borderTopLeftRadius: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  assistantText: { color: COLORS.gray[900], fontSize: FONT_SIZES.md, lineHeight: 21 },
  errorBubble: {
    backgroundColor: COLORS.coralLight,
    borderColor: COLORS.coral,
  },
  errorBubbleText: { color: COLORS.coral },
  citationsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 4,
    marginTop: 4,
  },
  citationChip: {
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  citationText: { fontSize: 10, color: COLORS.gray[500] },
  actionsColumn: { gap: SPACING.xs, marginTop: SPACING.xs },
  navigateButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  navigateText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '500' as const },
  webOnlyNote: { fontSize: FONT_SIZES.xs, color: COLORS.gray[500], fontStyle: 'italic' as const },
  confirmCard: {
    backgroundColor: COLORS.lavenderLight,
    borderWidth: 1,
    borderColor: COLORS.lavender,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    gap: 4,
  },
  confirmHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  confirmTitle: { fontSize: FONT_SIZES.xs, color: COLORS.gray[500], fontWeight: '500' as const },
  confirmSummary: { fontSize: FONT_SIZES.sm, color: COLORS.gray[900] },
  confirmButtons: { flexDirection: 'row' as const, gap: SPACING.sm, marginTop: 4 },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    minWidth: 84,
    alignItems: 'center' as const,
  },
  confirmButtonText: { color: COLORS.white, fontSize: FONT_SIZES.sm, fontWeight: '600' as const },
  dismissButton: { paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  dismissButtonText: { color: COLORS.gray[500], fontSize: FONT_SIZES.sm },
  confirmDoneRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  confirmDoneText: { color: COLORS.mint, fontSize: FONT_SIZES.sm },
  confirmFailedText: { color: COLORS.coral, fontSize: FONT_SIZES.sm },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: COLORS.coralLight,
    borderTopWidth: 1,
    borderTopColor: COLORS.coral,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.coral,
    marginRight: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconButtonActive: { backgroundColor: COLORS.coral, borderColor: 'transparent' },
  sendButton: { backgroundColor: COLORS.primary, borderColor: 'transparent' },
  sendDisabled: { opacity: 0.5 },
  disclaimer: {
    fontSize: 10,
    color: COLORS.gray[400],
    textAlign: 'center' as const,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
});
