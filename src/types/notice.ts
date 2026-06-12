/**
 * Notice Types
 * Matches backend Notice DTOs
 */

import {
  NoticeStatus,
  NoticePriority,
  RiskLevel,
  ProcessingStatus,
  PaginationDto
} from './api';

// Notice List Item
export interface NoticeDto {
  id: string;
  noticeType?: string;
  noticeCategory?: string;
  noticeNumber?: string;
  gstin?: string;
  issueDate?: string;
  responseDeadline?: string;
  daysRemaining?: number;
  taxAmount?: number;
  penaltyAmount?: number;
  status: NoticeStatus;
  priority: NoticePriority;
  riskScore?: number;
  riskLevel?: RiskLevel;
  summaryEn?: string;
  assignedToId?: string;
  assignedToName?: string;
  createdAt: string;
}

// Notice Detail
export interface NoticeDetailDto extends NoticeDto {
  extendedDeadline?: string;
  interestAmount?: number;
  periodFrom?: string;
  periodTo?: string;
  issuingAuthority?: string;
  fileUrl?: string;
  processingStatus: ProcessingStatus;
  tags?: string[];
  aiReport?: NoticeAiReportDto;
  updatedAt?: string;
}

// AI Analysis Report
export interface NoticeAiReportDto {
  id: string;
  riskScore?: number;
  riskLevel?: RiskLevel;
  summaryEn?: string;
  summaryHi?: string;
  plainEnglish?: string;
  actionItems?: ActionItemDto[];
  requiredDocuments?: RequiredDocumentDto[];
  legalReferences?: LegalReferenceDto[];
  confidenceScores?: Record<string, number>;
  modelUsed?: string;
  processingTimeMs?: number;
  createdAt: string;
}

export interface ActionItemDto {
  priority: NoticePriority;
  action: string;
  description: string;
  dueInDays?: number;
  assigneeSuggestion?: string;
}

export interface RequiredDocumentDto {
  document: string;
  mandatory: boolean;
}

export interface LegalReferenceDto {
  section: string;
  description: string;
}

// Notice List Response
export interface NoticeListResponse {
  notices: NoticeDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  aggregations?: NoticeAggregationsDto;
}

export interface NoticeAggregationsDto {
  byStatus: Record<NoticeStatus, number>;
  byPriority: Record<NoticePriority, number>;
  overdueCount: number;
  dueThisWeek: number;
}

// Notice Statistics (for Dashboard)
export interface NoticeStatisticsDto {
  byStatus: Record<NoticeStatus, number>;
  byPriority: Record<NoticePriority, number>;
  overdueCount: number;
  dueThisWeek: number;
  dueThisMonth: number;
  totalDemandAmount: number;
  totalCount: number;
}

// Notice Upload
export interface NoticeUploadResponse {
  noticeId: string;
  fileName: string;
  fileSize: number;
  status: NoticeStatus;
  processingJobId?: string;
  estimatedCompletionSeconds?: number;
  duplicateWarning?: DuplicateWarningDto;
  createdAt: string;
}

export interface DuplicateWarningDto {
  isPotentialDuplicate: boolean;
  similarNoticeId?: string;
  similarNoticeNumber?: string;
  similarityScore?: number;
  uploadedAt?: string;
}

// Attachments
export interface AttachmentDto {
  id: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  documentType?: string;
  description?: string;
  uploadedById: string;
  uploadedByName?: string;
  createdAt: string;
}

export interface DownloadUrlResponse {
  url: string;
  expiresAt: string;
}

// Notice Query Params
export interface NoticeQueryParams {
  page?: number;
  pageSize?: number;
  status?: NoticeStatus | NoticeStatus[];
  priority?: NoticePriority | NoticePriority[];
  search?: string;
  gstin?: string;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: 'createdAt' | 'responseDeadline' | 'riskScore' | 'taxAmount';
  sortOrder?: 'asc' | 'desc';
}

// Workflow
export interface WorkflowProgressDto {
  noticeId: string;
  workflowInstanceId: string;
  currentStageKey: string;
  stages: WorkflowStageInfo[];
  completedStages: number;
  totalStages: number;
  progressPercent: number;
}

export interface WorkflowStageInfo {
  stageKey: string;
  name: string;
  stageType: string;
  color?: string;
  icon?: string;
  slaHours?: number;
  isCurrentStage: boolean;
  isCompleted: boolean;
  enteredAt?: string;
  exitedAt?: string;
  timeInStageMinutes?: number;
}
