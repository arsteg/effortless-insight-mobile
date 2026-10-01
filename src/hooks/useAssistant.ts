/**
 * Hooks for the EI Assistant chat (mobile uses the non-streaming sync turn).
 */

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assistantApi } from '../services/api/assistant';
import { getApiErrorMessage } from '../services/api/client';
import {
  AssistantClientContext,
  AssistantMessageDto,
} from '../types/assistant';

export const assistantKeys = {
  all: ['assistant'] as const,
  conversations: () => [...assistantKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...assistantKeys.all, 'conversation', id] as const,
};

export function useAssistantConversations(enabled = true) {
  return useQuery({
    queryKey: assistantKeys.conversations(),
    queryFn: () => assistantApi.getConversations(),
    enabled,
  });
}

export function useAssistantConversation(conversationId: string | null) {
  return useQuery({
    queryKey: assistantKeys.conversation(conversationId ?? 'none'),
    queryFn: () => assistantApi.getConversation(conversationId!),
    enabled: !!conversationId,
  });
}

export interface PendingTurn {
  userContent: string;
  /** True while waiting for the assistant's reply */
  inFlight: boolean;
}

/**
 * Chat driver: lazily creates the conversation, sends the turn via the sync
 * endpoint, and keeps an optimistic pending state for the UI.
 */
export function useAssistantChat(clientContext?: AssistantClientContext) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conversationQuery = useAssistantConversation(conversationId);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      let id = conversationId;
      if (!id) {
        const created = await assistantApi.createConversation();
        id = created.id;
        setConversationId(created.id);
        queryClient.invalidateQueries({ queryKey: assistantKeys.conversations() });
      }
      return assistantApi.sendMessage(id, { content, context: clientContext ?? null });
    },
    onSuccess: (_, __) => {
      setPending(null);
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: assistantKeys.conversation(conversationId) });
      }
      queryClient.invalidateQueries({ queryKey: assistantKeys.conversations() });
    },
    onError: (err) => {
      setPending((previous) => (previous ? { ...previous, inFlight: false } : null));
      setError(getApiErrorMessage(err));
    },
  });

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || sendMutation.isPending) return;
      setError(null);
      setPending({ userContent: trimmed, inFlight: true });
      sendMutation.mutate(trimmed);
    },
    [sendMutation]
  );

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setPending(null);
    setError(null);
    sendMutation.reset();
  }, [sendMutation]);

  const switchConversation = useCallback(
    (id: string) => {
      setConversationId(id);
      setPending(null);
      setError(null);
      sendMutation.reset();
    },
    [sendMutation]
  );

  // The turn result lands in the conversation query after invalidation; but to
  // avoid a visible refetch gap we also surface the mutation's direct result.
  const lastTurn = sendMutation.data ?? null;

  const savedMessages: AssistantMessageDto[] = conversationQuery.data?.messages ?? [];
  const messages: AssistantMessageDto[] = [...savedMessages];
  if (lastTurn && !savedMessages.some((message) => message.id === lastTurn.assistantMessage.id)) {
    if (!savedMessages.some((message) => message.id === lastTurn.userMessage.id)) {
      messages.push(lastTurn.userMessage);
    }
    messages.push(lastTurn.assistantMessage);
  }

  return {
    conversationId,
    switchConversation,
    messages,
    pending,
    error,
    clearError: () => setError(null),
    isLoading: conversationQuery.isLoading && !!conversationId,
    isSending: sendMutation.isPending,
    sendMessage,
    startNewConversation,
  };
}
