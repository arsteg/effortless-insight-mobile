/**
 * Notification Types
 * Matches backend EffortlessInsight.Api DTOs
 */

// Notification Types
export type NotificationType =
  | 'deadline_reminder'
  | 'task_assigned'
  | 'task_completed'
  | 'task_due'
  | 'document_requested'
  | 'document_received'
  | 'document_overdue'
  | 'comment_mention'
  | 'comment_reply'
  | 'notice_status_changed'
  | 'notice_assigned'
  | 'collaboration_invite'
  | 'workflow_update'
  | 'system_announcement'
  | 'ai_analysis_complete'
  | 'sla_warning'
  | 'sla_breach';

// Notification Priority
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

// Notification Channel
export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms' | 'whatsapp';

// Notification DTO matching backend
export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: NotificationData;
  isRead: boolean;
  readAt?: string;
  actionUrl?: string;
  expiresAt?: string;
  groupId?: string;
  groupCount?: number;
  createdAt: string;
}

// Notification Data (flexible metadata)
export interface NotificationData {
  noticeId?: string;
  noticeName?: string;
  taskId?: string;
  taskTitle?: string;
  commentId?: string;
  documentRequestId?: string;
  userId?: string;
  userName?: string;
  deadline?: string;
  daysRemaining?: number;
  oldStatus?: string;
  newStatus?: string;
  amount?: number;
  [key: string]: unknown;
}

// Notification list response
export interface NotificationListResponse {
  notifications: NotificationDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  unreadCount: number;
}

// Notification filters
export interface NotificationFilters {
  status?: 'all' | 'unread' | 'read';
  type?: NotificationType;
  priority?: NotificationPriority;
  since?: string;
  page?: number;
  pageSize?: number;
}

// Mark as read request
export interface MarkNotificationsReadRequest {
  notificationIds?: string[];
  all?: boolean;
}

// Unread count response
export interface UnreadCountResponse {
  unreadCount: number;
}

// User notification preferences
export interface NotificationPreferencesDto {
  userId: string;
  channels: NotificationChannelPreferences;
  quietHours: QuietHoursPreferences;
  dailyDigest: DailyDigestPreferences;
  weeklyDigest: WeeklyDigestPreferences;
  typePreferences: Record<NotificationType, TypePreference>;
  updatedAt: string;
}

// Channel preferences
export interface NotificationChannelPreferences {
  inApp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
  whatsApp: boolean;
}

// Quiet hours preferences
export interface QuietHoursPreferences {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string;
  allowCritical: boolean;
}

// Daily digest preferences
export interface DailyDigestPreferences {
  enabled: boolean;
  sendTime: string; // HH:mm format
  timezone: string;
  includeRead: boolean;
}

// Weekly digest preferences
export interface WeeklyDigestPreferences {
  enabled: boolean;
  dayOfWeek: number; // 0 = Sunday
  sendTime: string;
  timezone: string;
}

// Type-specific preference
export interface TypePreference {
  enabled: boolean;
  channels: NotificationChannel[];
  priority: NotificationPriority;
}

// Update preferences request
export interface UpdateNotificationPreferencesRequest {
  channels?: Partial<NotificationChannelPreferences>;
  quietHours?: Partial<QuietHoursPreferences>;
  dailyDigest?: Partial<DailyDigestPreferences>;
  weeklyDigest?: Partial<WeeklyDigestPreferences>;
  typePreferences?: Partial<Record<NotificationType, Partial<TypePreference>>>;
}

// Push token registration
export interface RegisterPushTokenRequest {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  deviceName?: string;
}

// Notification action result
export interface NotificationActionResult {
  success: boolean;
  message?: string;
}

// Grouped notifications
export interface GroupedNotifications {
  today: NotificationDto[];
  yesterday: NotificationDto[];
  thisWeek: NotificationDto[];
  older: NotificationDto[];
}
