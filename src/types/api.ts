/**
 * API Response Types
 * Matches backend EffortlessInsight.Api DTOs
 */

// Generic API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginationDto {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Common enums matching backend
export type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'ca' | 'viewer';

export type NoticeStatus =
  | 'uploaded'
  | 'processing'
  | 'analyzed'
  | 'in_progress'
  | 'responded'
  | 'closed'
  | 'archived'
  | 'failed';

export type NoticePriority = 'low' | 'medium' | 'high' | 'critical';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ProcessingStatus =
  | 'queued'
  | 'ocr_processing'
  | 'extracting'
  | 'classifying'
  | 'analyzing'
  | 'completed'
  | 'failed';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'on_hold' | 'archived';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type CommentVisibility = 'all' | 'internal';

export type DocumentRequestStatus =
  | 'pending'
  | 'submitted'
  | 'reviewing'
  | 'fulfilled'
  | 'resubmit_needed'
  | 'cancelled';

export type ActivityType =
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_assigned'
  | 'task_status_changed'
  | 'comment_added'
  | 'comment_edited'
  | 'comment_deleted'
  | 'comment_reaction'
  | 'user_mentioned'
  | 'document_requested'
  | 'document_uploaded'
  | 'document_reviewed'
  | 'document_overdue'
  | 'notice_assigned'
  | 'notice_status_changed'
  | 'ai_analysis_completed'
  | 'workflow_stage_changed';

export type ResponseStatus = 'draft' | 'review' | 'approved' | 'submitted';

export type SlaStatus = 'on_track' | 'at_risk' | 'warning' | 'breached';
