/**
 * Support Tickets API Service
 *
 * In-app customer support — tickets raised here are answered by the team in
 * the admin panel; replies appear in the ticket thread as
 * "EffortlessInsight Support". There is deliberately no support email.
 *
 * Note: unlike the collaboration endpoints, the support endpoints wrap their
 * payload in the standard `{ success, data }` envelope, so responses are
 * unwrapped here.
 */

import { apiClient } from './client';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SupportTicketCategory =
  | 'question'
  | 'problem'
  | 'billing'
  | 'feature_request'
  | 'other';

export interface SupportTicketSummary {
  id: string;
  subject: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  hasUnreadSupportReply: boolean;
}

export interface SupportTicketMessage {
  id: string;
  isFromSupport: boolean;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicketDetail {
  id: string;
  subject: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  createdAt: string;
  lastMessageAt: string;
  messages: SupportTicketMessage[];
}

export interface CreateSupportTicketRequest {
  subject: string;
  category: SupportTicketCategory;
  message: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export const supportApi = {
  /**
   * List the organization's support tickets, most recently active first
   */
  list: async (): Promise<SupportTicketSummary[]> => {
    const response = await apiClient.get<ApiEnvelope<SupportTicketSummary[]>>(
      '/support/tickets'
    );
    return response.data.data;
  },

  /**
   * Get a ticket with its full message thread
   */
  get: async (ticketId: string): Promise<SupportTicketDetail> => {
    const response = await apiClient.get<ApiEnvelope<SupportTicketDetail>>(
      `/support/tickets/${ticketId}`
    );
    return response.data.data;
  },

  /**
   * Create a new ticket with an initial message
   */
  create: async (data: CreateSupportTicketRequest): Promise<SupportTicketDetail> => {
    const response = await apiClient.post<ApiEnvelope<SupportTicketDetail>>(
      '/support/tickets',
      data
    );
    return response.data.data;
  },

  /**
   * Add a customer reply (replying to a resolved ticket reopens it)
   */
  reply: async (ticketId: string, message: string): Promise<SupportTicketMessage> => {
    const response = await apiClient.post<ApiEnvelope<SupportTicketMessage>>(
      `/support/tickets/${ticketId}/messages`,
      { message }
    );
    return response.data.data;
  },

  /**
   * Close a ticket
   */
  close: async (ticketId: string): Promise<void> => {
    await apiClient.post(`/support/tickets/${ticketId}/close`);
  },
};
