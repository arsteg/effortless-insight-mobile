/**
 * Types for the app-wide EI Assistant (gateway: /api/v1/assistant/*)
 */

export interface AssistantConversationDto {
  id: string;
  title: string;
  status: string;
  platform: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface AssistantNavigateAction {
  type: 'navigate';
  intent: string;
  label: string;
  webRoute?: string | null;
  mobileRoute?: string | null;
  webOnlyNote?: string | null;
}

export interface AssistantConfirmAction {
  type: 'confirm_action';
  kind: string;
  summary: string;
  method: 'POST' | 'PUT';
  path: string;
  body: Record<string, unknown>;
}

export type AssistantAction = AssistantNavigateAction | AssistantConfirmAction;

export interface AssistantMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: string[];
  actions: AssistantAction[] | null;
  tokenCount: number;
  modelId: string | null;
  isError: boolean;
  createdAt: string;
}

export interface AssistantConversationDetailDto extends AssistantConversationDto {
  messages: AssistantMessageDto[];
}

export interface AssistantConversationListDto {
  conversations: AssistantConversationDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AssistantClientContext {
  route?: string | null;
  noticeId?: string | null;
}

export interface SendAssistantMessageRequest {
  content: string;
  context?: AssistantClientContext | null;
}

export interface AssistantTurnDto {
  userMessage: AssistantMessageDto;
  assistantMessage: AssistantMessageDto;
}

export interface AssistantTranscriptionDto {
  text: string;
  language: string | null;
  durationSeconds: number | null;
}
