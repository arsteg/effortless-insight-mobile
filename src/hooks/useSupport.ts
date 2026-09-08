/**
 * Support ticket hooks (React Query)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi, CreateSupportTicketRequest } from '../services/api/support';

export const supportKeys = {
  all: ['support-tickets'] as const,
  lists: () => [...supportKeys.all, 'list'] as const,
  details: () => [...supportKeys.all, 'detail'] as const,
  detail: (id: string) => [...supportKeys.details(), id] as const,
};

export function useSupportTickets() {
  return useQuery({
    queryKey: supportKeys.lists(),
    queryFn: () => supportApi.list(),
  });
}

export function useSupportTicket(ticketId: string) {
  return useQuery({
    queryKey: supportKeys.detail(ticketId),
    queryFn: () => supportApi.get(ticketId),
    enabled: !!ticketId,
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupportTicketRequest) => supportApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
    },
  });
}

export function useReplyToSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      supportApi.reply(ticketId, message),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supportKeys.detail(variables.ticketId) });
    },
  });
}

export function useCloseSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => supportApi.close(ticketId),
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supportKeys.detail(ticketId) });
    },
  });
}
