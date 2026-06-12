/**
 * Task & Collaboration Types
 * Matches backend TaskCollaborationDtos
 */

import {
  TaskStatus,
  TaskPriority,
  CommentVisibility,
  DocumentRequestStatus,
  ActivityType,
  PaginationDto
} from './api';

// Task Types
export interface CreateTaskDto {
  title: string;
  description?: string;
  assignees: string[];
  priority?: TaskPriority;
  dueDate?: string;
  estimatedHours?: number;
  labels?: string[];
  parentTaskId?: string;
  templateId?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  assignees?: string[];
  priority?: TaskPriority;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  labels?: string[];
  status?: TaskStatus;
  completionNote?: string;
}

export interface TaskDto {
  id: string;
  noticeId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  isOverdue: boolean;
  assignees: TaskAssigneeDto[];
  labels?: string[];
  parentTaskId?: string;
  subtaskCount: number;
  subtasksCompleted: number;
  createdBy: TaskUserDto;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  completedBy?: TaskUserDto;
  completionNote?: string;
}

export interface TaskDetailDto extends TaskDto {
  subtasks?: TaskDto[];
}

export interface TaskAssigneeDto {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  assignedAt: string;
}

export interface TaskUserDto {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface TaskListResponseDto {
  tasks: TaskDto[];
  summary: TaskSummaryDto;
}

export interface TaskSummaryDto {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  blocked: number;
  onHold: number;
  overdue: number;
}

// My Tasks (cross-notice)
export interface MyTaskDto {
  id: string;
  title: string;
  notice: {
    id: string;
    noticeNumber?: string;
    noticeType?: string;
  };
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  isOverdue: boolean;
}

export interface MyTasksResponseDto {
  tasks: MyTaskDto[];
  pagination: PaginationDto;
}

// Task Templates
export interface TaskTemplateDto {
  id: string;
  organizationId?: string;
  name: string;
  description?: string;
  defaultTitle: string;
  defaultDescription?: string;
  defaultPriority: TaskPriority;
  defaultEstimatedHours?: number;
  defaultLabels?: string[];
  applicableNoticeTypes?: string[];
  isActive: boolean;
  createdAt: string;
}

// Comment Types
export interface CreateCommentDto {
  content: string;
  visibility?: CommentVisibility;
  parentCommentId?: string;
  attachmentUrls?: string[];
}

export interface UpdateCommentDto {
  content: string;
}

export interface CommentResponseDto {
  id: string;
  noticeId: string;
  content: string;
  contentHtml?: string;
  visibility: CommentVisibility;
  mentions?: MentionDto[];
  attachmentUrls?: string[];
  reactions: ReactionSummaryDto[];
  replyCount: number;
  author: CommentAuthorDto;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  isDeleted: boolean;
  parentCommentId?: string;
  replies?: CommentResponseDto[];
}

export interface CommentAuthorDto {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface MentionDto {
  userId: string;
  username: string;
  name: string;
}

export interface ReactionSummaryDto {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

export interface CommentListResponseDto {
  comments: CommentResponseDto[];
  pagination: PaginationDto;
}

// Document Request Types
export interface CreateDocumentRequestDto {
  title: string;
  description: string;
  requestedFrom: string;
  dueDate: string;
  priority?: TaskPriority;
  acceptedFormats?: string[];
  templateId?: string;
}

export interface UpdateDocumentRequestDto {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  acceptedFormats?: string[];
  status?: DocumentRequestStatus;
  reviewNote?: string;
}

export interface DocumentRequestDto {
  id: string;
  noticeId: string;
  title: string;
  description: string;
  status: DocumentRequestStatus;
  priority: TaskPriority;
  dueDate: string;
  isOverdue: boolean;
  daysRemaining: number;
  acceptedFormats?: string[];
  requestedFrom: DocumentRequestUserDto;
  requestedBy: DocumentRequestUserDto;
  fulfilledAt?: string;
  reviewedBy?: DocumentRequestUserDto;
  reviewNote?: string;
  documents: DocumentRequestDocumentDto[];
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentRequestUserDto {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface DocumentRequestDocumentDto {
  id: string;
  fileId: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: DocumentRequestUserDto;
  uploadedAt: string;
  note?: string;
}

export interface DocumentRequestListResponseDto {
  requests: DocumentRequestDto[];
  summary: DocumentRequestSummaryDto;
}

export interface DocumentRequestSummaryDto {
  total: number;
  pending: number;
  submitted: number;
  reviewing: number;
  fulfilled: number;
  resubmitNeeded: number;
  overdue: number;
}

// Activity Types
export interface ActivityDto {
  id: string;
  type: ActivityType;
  timestamp: string;
  actor?: ActivityActorDto;
  data: Record<string, unknown>;
  message: string;
}

export interface ActivityActorDto {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ActivityFeedResponseDto {
  activities: ActivityDto[];
  hasMore: boolean;
  nextCursor?: string;
}

// Task Query Params
export interface TaskQueryParams {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assignee?: string;
  dueWithin?: 'today' | 'week' | 'month';
  includeSubtasks?: boolean;
}
