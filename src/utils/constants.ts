/**
 * App Constants
 */

// API Configuration
export const API_CONFIG = {
  // Development URL - change for production
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || "https://localhost:59110",
  API_VERSION: "v1",
  TIMEOUT: 30000, // 30 seconds
} as const;

export const API_BASE_URL = `${API_CONFIG.BASE_URL}/api/${API_CONFIG.API_VERSION}`;

// Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  REFRESH_TOKEN: "auth_refresh_token",
  USER: "auth_user",
  BIOMETRIC_ENABLED: "biometric_enabled",
  DARK_MODE_ENABLED: "dark_mode_enabled",
  CACHED_NOTICES: "cached_notices",
  CACHED_TASKS: "cached_tasks",
  CACHED_PLANS: "cached_plans",
  CACHED_SUBSCRIPTION: "cached_subscription",
  OFFLINE_QUEUE: "offline_queue",
  PUSH_TOKEN: "push_token",
  LAST_SYNC: "last_sync_timestamp",
} as const;

// Token Configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY_BUFFER: 60 * 1000, // 1 minute before expiry
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
  REMEMBER_ME_EXPIRY_DAYS: 30,
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  NOTICE_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  TASK_CACHE_DURATION: 60 * 60 * 1000, // 1 hour
  DASHBOARD_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  PLANS_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours - plans don't change often
  SUBSCRIPTION_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
} as const;

// Risk Level Colors
export const RISK_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
} as const;

// Priority Colors
export const PRIORITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
} as const;

// Status Colors
export const STATUS_COLORS = {
  // Notice statuses
  uploaded: "#6b7280",
  processing: "#3b82f6",
  analyzed: "#8b5cf6",
  in_progress: "#f59e0b",
  responded: "#10b981",
  closed: "#6b7280",
  archived: "#9ca3af",
  failed: "#ef4444",
  // Task statuses
  todo: "#6b7280",
  done: "#10b981",
  blocked: "#ef4444",
  on_hold: "#f59e0b",
} as const;

// Design System
export const COLORS = {
  primary: "#0ea5e9",
  primaryLight: "#e0f2fe",
  primaryDark: "#0284c7",
  secondary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  white: "#ffffff",
  black: "#000000",
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// File Upload
export const FILE_CONFIG = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_TYPES: ["image/jpeg", "image/png", "application/pdf"],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".pdf"],
} as const;

// Offline Queue
export const OFFLINE_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  MAX_QUEUE_SIZE: 100,
} as const;

// Notification Channels (Android)
export const NOTIFICATION_CHANNELS = {
  DEADLINE_CRITICAL: "deadline_critical",
  DEADLINE_REGULAR: "deadline_regular",
  TASKS: "tasks",
  COLLABORATION: "collaboration",
} as const;
