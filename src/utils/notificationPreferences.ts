/**
 * Translating notification preferences between the API's wire format and the
 * flat shape the settings screen works in.
 *
 * The mobile types were written against a different contract than the API
 * actually serves, and nothing surfaced the mismatch because both sides
 * "succeeded":
 *
 *  - Reading, `channels.email` arrives as `{ enabled, address, verified }`, but
 *    the screen treated it as a boolean. An object is truthy in JS, so every
 *    switch rendered ON no matter what was stored.
 *  - Writing, the screen sent `{ email: false }` where the API binds
 *    `UpdateEmailChannelDto`. A bool cannot bind to an object, so the field
 *    arrived null — which the server reads as "leave unchanged". The PUT
 *    returned 200 and saved nothing.
 *
 * Web already sends the object form, which is why the same screen works there.
 * Rather than reshape the screen, the conversion lives here at the boundary.
 */

import type {
  NotificationChannelPreferences,
  NotificationPreferencesDto,
  UpdateNotificationPreferencesRequest,
} from '../types/notification';

/* ------------------------------------------------------------------ *
 * Wire types — these mirror the API DTOs exactly. Do not "tidy" them.
 * ------------------------------------------------------------------ */

interface WireToggle {
  enabled: boolean;
}

export interface WireChannelPreferences {
  email?: WireToggle & { address?: string; verified?: boolean };
  sms?: WireToggle & { phone?: string; verified?: boolean };
  whatsApp?: WireToggle & { phone?: string; verified?: boolean };
  push?: WireToggle & { tokens?: unknown[] };
}

export interface WireQuietHours {
  enabled?: boolean;
  /** The API calls these `start`/`end`, not `startTime`/`endTime`. */
  start?: string;
  end?: string;
  timezone?: string;
}

export interface WireTypePreference {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  whatsApp?: boolean;
  inApp?: boolean;
}

export interface WireDigest {
  daily?: { enabled?: boolean; time?: string; timezone?: string };
  weekly?: { enabled?: boolean; dayOfWeek?: number; time?: string; timezone?: string };
}

export interface WireNotificationPreferences {
  channels?: WireChannelPreferences;
  quietHours?: WireQuietHours;
  /** Keyed by notification type. The API calls this `preferences`. */
  preferences?: Record<string, WireTypePreference>;
  digest?: WireDigest;
}

export interface WireUpdateRequest {
  channels?: WireChannelPreferences;
  quietHours?: WireQuietHours;
  preferences?: Record<string, WireTypePreference>;
  digest?: WireDigest;
}

/**
 * The API has no global in-app channel — `ChannelPreferencesDto` carries only
 * email, sms, whatsApp and push. It exists per notification *type*, but not as
 * a blanket switch, so there is nowhere to persist this one server-side. It is
 * kept in the returned object so the screen still renders it, defaulting on.
 */
export const IN_APP_HAS_NO_SERVER_FIELD = true;

/* ------------------------------------------------------------------ *
 * Wire -> app
 * ------------------------------------------------------------------ */

/** Reads a channel's enabled flag, tolerating the field being absent. */
function toggleOf(channel: (WireToggle & object) | undefined, fallback: boolean): boolean {
  return typeof channel?.enabled === 'boolean' ? channel.enabled : fallback;
}

export function channelsFromWire(
  wire: WireChannelPreferences | undefined,
  inApp = true
): NotificationChannelPreferences {
  return {
    inApp,
    email: toggleOf(wire?.email, true),
    push: toggleOf(wire?.push, true),
    sms: toggleOf(wire?.sms, false),
    whatsApp: toggleOf(wire?.whatsApp, false),
  };
}

/** A type is "on" when it may still reach the user by some channel. */
function typeEnabled(pref: WireTypePreference | undefined): boolean {
  if (!pref) return true;
  return Boolean(pref.email || pref.sms || pref.push || pref.whatsApp || pref.inApp);
}

export function preferencesFromWire(
  wire: WireNotificationPreferences | undefined,
  inApp = true
): NotificationPreferencesDto {
  const typePreferences: Record<string, { enabled: boolean }> = {};
  for (const [type, pref] of Object.entries(wire?.preferences ?? {})) {
    typePreferences[type] = { enabled: typeEnabled(pref) };
  }

  return {
    channels: channelsFromWire(wire?.channels, inApp),
    quietHours: {
      enabled: wire?.quietHours?.enabled ?? false,
      // Renamed on the way in, so the screen's `startTime` keeps working.
      startTime: wire?.quietHours?.start ?? '22:00',
      endTime: wire?.quietHours?.end ?? '07:00',
      timezone: wire?.quietHours?.timezone ?? 'Asia/Kolkata',
    },
    dailyDigest: {
      enabled: wire?.digest?.daily?.enabled ?? false,
      sendTime: wire?.digest?.daily?.time ?? '09:00',
      timezone: wire?.digest?.daily?.timezone ?? 'Asia/Kolkata',
    },
    weeklyDigest: {
      enabled: wire?.digest?.weekly?.enabled ?? false,
      dayOfWeek: wire?.digest?.weekly?.dayOfWeek ?? 1,
      sendTime: wire?.digest?.weekly?.time ?? '09:00',
      timezone: wire?.digest?.weekly?.timezone ?? 'Asia/Kolkata',
    },
    typePreferences: typePreferences as NotificationPreferencesDto['typePreferences'],
  };
}

/* ------------------------------------------------------------------ *
 * App -> wire
 * ------------------------------------------------------------------ */

/**
 * Only channels the caller actually set are included. Sending
 * `{ enabled: undefined }` would bind to a DTO whose every field is null,
 * which the server treats as a no-op — the original bug in a new disguise.
 */
export function channelsToWire(
  channels: Partial<NotificationChannelPreferences>
): WireChannelPreferences {
  const wire: WireChannelPreferences = {};
  if (typeof channels.email === 'boolean') wire.email = { enabled: channels.email };
  if (typeof channels.push === 'boolean') wire.push = { enabled: channels.push };
  if (typeof channels.sms === 'boolean') wire.sms = { enabled: channels.sms };
  if (typeof channels.whatsApp === 'boolean') wire.whatsApp = { enabled: channels.whatsApp };
  // `inApp` is deliberately dropped — see IN_APP_HAS_NO_SERVER_FIELD.
  return wire;
}

/**
 * Turning a type off means it should reach the user by no channel at all, so
 * the single `enabled` switch fans out across every channel the type has.
 */
function typePreferenceToWire(enabled: boolean): WireTypePreference {
  return { email: enabled, sms: false, push: enabled, whatsApp: false, inApp: enabled };
}

export function updateToWire(
  update: UpdateNotificationPreferencesRequest
): WireUpdateRequest {
  const wire: WireUpdateRequest = {};

  if (update.channels) {
    const channels = channelsToWire(update.channels);
    if (Object.keys(channels).length > 0) wire.channels = channels;
  }

  if (update.quietHours) {
    wire.quietHours = {};
    if (typeof update.quietHours.enabled === 'boolean') {
      wire.quietHours.enabled = update.quietHours.enabled;
    }
    if (update.quietHours.startTime) wire.quietHours.start = update.quietHours.startTime;
    if (update.quietHours.endTime) wire.quietHours.end = update.quietHours.endTime;
    if (update.quietHours.timezone) wire.quietHours.timezone = update.quietHours.timezone;
  }

  if (update.dailyDigest || update.weeklyDigest) {
    wire.digest = {};
    if (update.dailyDigest) {
      wire.digest.daily = {};
      if (typeof update.dailyDigest.enabled === 'boolean') {
        wire.digest.daily.enabled = update.dailyDigest.enabled;
      }
      if (update.dailyDigest.sendTime) wire.digest.daily.time = update.dailyDigest.sendTime;
    }
    if (update.weeklyDigest) {
      wire.digest.weekly = {};
      if (typeof update.weeklyDigest.enabled === 'boolean') {
        wire.digest.weekly.enabled = update.weeklyDigest.enabled;
      }
      if (update.weeklyDigest.sendTime) wire.digest.weekly.time = update.weeklyDigest.sendTime;
      if (typeof update.weeklyDigest.dayOfWeek === 'number') {
        wire.digest.weekly.dayOfWeek = update.weeklyDigest.dayOfWeek;
      }
    }
  }

  if (update.typePreferences) {
    wire.preferences = {};
    for (const [type, pref] of Object.entries(update.typePreferences)) {
      if (pref && typeof pref.enabled === 'boolean') {
        wire.preferences[type] = typePreferenceToWire(pref.enabled);
      }
    }
  }

  return wire;
}
