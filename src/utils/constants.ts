/**
 * App Constants
 */

import Constants from "expo-constants";

// API Configuration.
// Resolution order: build-time env var → app.json `extra.apiUrl` (previously
// ignored, which meant production could silently fall back to localhost) →
// the production host as a last resort. There is intentionally NO localhost
// default any more (audit B12).
const RESOLVED_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  "https://api.effortlessinsight.in";

export const API_CONFIG = {
  BASE_URL: RESOLVED_API_URL,
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
  // Per-notice detail, suffixed with the notice id. The list cache holds only
  // summary rows, which the detail screen cannot render (TC-MOB-056).
  CACHED_NOTICE_DETAIL_PREFIX: "cached_notice_detail:",
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

// Risk Level Colors — Calm Intelligence domain language (mint/amber/coral).
// Kept in sync with the theme risk map in src/theme/palettes.ts.
export const RISK_COLORS = {
  critical: "#cf3d28",
  high: "#e8563e",
  medium: "#e08d17",
  low: "#1f9968",
} as const;

// Priority Colors
export const PRIORITY_COLORS = {
  critical: "#cf3d28",
  high: "#e8563e",
  medium: "#e08d17",
  low: "#1f9968",
} as const;

// Status Colors — mapped onto the accent families.
export const STATUS_COLORS = {
  // Notice statuses
  uploaded: "#6b7280",
  processing: "#0e93e0", // azure
  analyzed: "#7f5fdd", // lavender (AI)
  in_progress: "#e08d17", // amber
  responded: "#1f9968", // mint
  closed: "#6b7280",
  archived: "#a8a296",
  failed: "#e8563e", // coral
  // Task statuses
  todo: "#6b7280",
  done: "#1f9968",
  blocked: "#e8563e",
  on_hold: "#e08d17",
} as const;

// Design System — legacy static palette. Mirrors the light Calm Intelligence
// palette so any screen still importing this (rather than useColors) matches.
export const COLORS = {
  primary: "#0e93e0",
  primaryLight: "#eaf5fd",
  primaryDark: "#0a78bd",
  secondary: "#7f5fdd",
  success: "#1f9968",
  warning: "#e08d17",
  error: "#e8563e",
  info: "#0e93e0",
  white: "#ffffff",
  black: "#000000",
  gray: {
    50: "#fbfaf6",
    100: "#f4f1ea",
    200: "#e9e5dc",
    300: "#d8d2c6",
    400: "#a8a296",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#262d3d",
    900: "#1b2338",
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

// File Upload — MAX_SIZE mirrors the backend's 25 MB notice-upload limit
// (FileValidationService / [RequestSizeLimit] on /notices/upload).
export const FILE_CONFIG = {
  MAX_SIZE_MB: 25,
  MAX_SIZE_BYTES: 25 * 1024 * 1024,
  ALLOWED_TYPES: ["image/jpeg", "image/png", "application/pdf"],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".pdf"],
  UPLOAD_TIMEOUT_MS: 120000,
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
  // The API's GetAndroidChannelId falls back to "default" for every medium and
  // low priority type outside the Task/Collaboration categories — notice
  // assignments, 7-day deadlines, GST sync, billing. Without a channel of this
  // name the OS drops them into an auto-created "Miscellaneous" channel with
  // the wrong importance and no user-visible settings (TC-MOB-049).
  DEFAULT: "default",
} as const;
