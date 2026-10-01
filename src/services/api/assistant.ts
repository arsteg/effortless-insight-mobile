/**
 * EI Assistant API Service (app-wide assistant gateway).
 *
 * All endpoints use the standard {success, data} envelope. Mobile uses the
 * non-streaming /messages/sync turn endpoint (no SSE client needed).
 */

import { apiClient } from './client';
import { ApiResponse } from '../../types';
import {
  AssistantConversationDetailDto,
  AssistantConversationListDto,
  AssistantTranscriptionDto,
  AssistantTurnDto,
  SendAssistantMessageRequest,
} from '../../types/assistant';

export const assistantApi = {
  getConversations: async (page = 1, pageSize = 20): Promise<AssistantConversationListDto> => {
    const response = await apiClient.get<ApiResponse<AssistantConversationListDto>>(
      `/assistant/conversations?page=${page}&pageSize=${pageSize}`
    );
    return response.data.data;
  },

  createConversation: async (): Promise<AssistantConversationDetailDto> => {
    const response = await apiClient.post<ApiResponse<AssistantConversationDetailDto>>(
      '/assistant/conversations',
      { title: null, platform: 'mobile' }
    );
    return response.data.data;
  },

  getConversation: async (
    conversationId: string,
    messageLimit = 50
  ): Promise<AssistantConversationDetailDto> => {
    const response = await apiClient.get<ApiResponse<AssistantConversationDetailDto>>(
      `/assistant/conversations/${conversationId}?messageLimit=${messageLimit}`
    );
    return response.data.data;
  },

  deleteConversation: async (conversationId: string): Promise<void> => {
    await apiClient.delete(`/assistant/conversations/${conversationId}`);
  },

  sendMessage: async (
    conversationId: string,
    request: SendAssistantMessageRequest
  ): Promise<AssistantTurnDto> => {
    const response = await apiClient.post<ApiResponse<AssistantTurnDto>>(
      `/assistant/conversations/${conversationId}/messages/sync`,
      request,
      // Identifies the platform so navigate actions resolve to mobile routes
      { headers: { 'X-Platform': 'mobile' } }
    );
    return response.data.data;
  },

  transcribe: async (file: {
    uri: string;
    type: string;
    name: string;
  }): Promise<AssistantTranscriptionDto> => {
    const form = new FormData();
    // React Native FormData file object
    form.append('file', file as unknown as Blob);
    const response = await apiClient.post<ApiResponse<AssistantTranscriptionDto>>(
      '/assistant/transcribe',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
    );
    return response.data.data;
  },
};
