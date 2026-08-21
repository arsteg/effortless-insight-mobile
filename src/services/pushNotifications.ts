/**
 * Push Notifications Service
 * Handles push notification registration, handlers, and Android channels
 */

import { Platform, Alert } from 'react-native';
import type * as NotificationsTypes from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { setPushToken, getPushToken } from './storage/secure';
import { notificationsApi } from './api/notifications';
import { NOTIFICATION_CHANNELS } from '../utils/constants';
import type { NotificationData } from '../types/notification';

// expo-notifications' Android push module was removed from Expo Go in SDK 53+
// and throws at import time there, so load it lazily and no-op every export in
// Expo Go. Full behavior is preserved in development/production builds.
const isExpoGo = Constants.executionEnvironment === 'storeClient';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: typeof NotificationsTypes | null = isExpoGo
  ? null
  : require('expo-notifications');

const noopSubscription = { remove: () => {} } as NotificationsTypes.Subscription;

// TEMP (testing only): allow remote push on emulators in dev builds. Emulator
// images WITH Google Play services can receive FCM, so the Device.isDevice
// guard below is relaxed under __DEV__. Remove before production if undesired.
const allowEmulatorPush = __DEV__;

// Configure notification handler behavior
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as NotificationData;
      const priority = (data?.priority as string) || 'medium';
      const shouldSound = priority === 'critical' || priority === 'high';

      return {
        shouldShowAlert: true,
        shouldPlaySound: shouldSound,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

/**
 * Setup Android notification channels
 * Must be called early in app initialization
 */
export async function setupNotificationChannels(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;

  // Critical deadline alerts - high priority
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DEADLINE_CRITICAL, {
    name: 'Critical Deadlines',
    description: 'Urgent deadline reminders that require immediate attention',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#ef4444',
    enableVibrate: true,
    enableLights: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  // Regular deadline reminders
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DEADLINE_REGULAR, {
    name: 'Deadline Reminders',
    description: 'Standard deadline reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250],
    lightColor: '#f59e0b',
    enableVibrate: true,
    enableLights: true,
    sound: 'default',
  });

  // Task assignments and updates
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.TASKS, {
    name: 'Tasks',
    description: 'Task assignments, updates, and completions',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 100],
    lightColor: '#0ea5e9',
    enableVibrate: true,
    sound: 'default',
  });

  // Collaboration notifications (comments, mentions)
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.COLLABORATION, {
    name: 'Collaboration',
    description: 'Comments, mentions, and team updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 100],
    lightColor: '#8b5cf6',
    enableVibrate: true,
    sound: 'default',
  });
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications || (!Device.isDevice && !allowEmulatorPush)) {
    console.warn('Push notifications require a physical device and a development build');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Get the push token to register with the backend.
 *
 * Android: the NATIVE FCM registration token (getDevicePushTokenAsync) — the
 * backend routes non-Expo tokens directly through the Firebase Admin SDK, so
 * delivery is API -> FCM -> device with no Expo push service in the path.
 *
 * iOS: the FCM token from @react-native-firebase/messaging. A raw APNs token
 * (what getDevicePushTokenAsync returns on iOS) cannot be addressed by the
 * Firebase Admin SDK, so the FCM iOS SDK bridges APNs -> FCM. Requires the
 * GoogleService-Info.plist + APNs .p8 key uploaded in the Firebase console.
 */
export async function getNativePushToken(): Promise<string | null> {
  try {
    if (!Notifications || (!Device.isDevice && !allowEmulatorPush)) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    // Check permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Notification permissions not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      return typeof tokenData.data === 'string' ? tokenData.data : null;
    }

    // iOS: FCM token via the Firebase iOS SDK. Lazy require - the native module
    // only exists in builds made after @react-native-firebase was added, and
    // never in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messaging = require('@react-native-firebase/messaging').default;
    await messaging().registerDeviceForRemoteMessages();
    const fcmToken: string = await messaging().getToken();
    return fcmToken || null;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Register push token with backend
 */
export async function registerPushToken(): Promise<boolean> {
  try {
    const token = await getNativePushToken();
    if (!token) {
      return false;
    }

    // Check if we already registered this token
    const existingToken = await getPushToken();
    if (existingToken === token) {
      console.log('Push token already registered');
      return true;
    }

    // Get device identifier
    const deviceId = Device.modelId || Device.osInternalBuildId || 'unknown';
    const deviceName = Device.deviceName || undefined;

    // Register with backend
    await notificationsApi.registerPushToken({
      token,
      platform: Platform.OS as 'ios' | 'android',
      deviceId,
      deviceName,
    });

    // Store token locally
    await setPushToken(token);

    console.log('Push token registered successfully');
    return true;
  } catch (error) {
    console.error('Error registering push token:', error);
    return false;
  }
}

/**
 * Register with a few retries and backoff. Registration is otherwise
 * fire-and-forget, so a transient failure (offline at login, a 5xx) meant no
 * push until the next cold start (audit MO-06). Returns true on success or if
 * the token was already registered.
 */
export async function registerPushTokenWithRetry(maxAttempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ok = await registerPushToken();
    if (ok) return true;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  console.warn('Push token registration failed after retries');
  return false;
}

/**
 * Re-register whenever the OS rotates the push token (device restore, FCM/APNs
 * rotation). Without this the app registers only once per session and rotated
 * tokens silently stop receiving pushes (audit MO-05).
 */
export function addPushTokenRotationListener(): NotificationsTypes.Subscription {
  if (!Notifications) return noopSubscription;
  return Notifications.addPushTokenListener(() => {
    console.log('Push token rotated; re-registering');
    registerPushTokenWithRetry();
  });
}

/**
 * Unregister push token
 */
export async function unregisterPushToken(): Promise<void> {
  const token = await getPushToken();
  if (!token) {
    return;
  }

  try {
    await notificationsApi.unregisterPushToken(token);
  } catch (error) {
    // Server deactivation failed (e.g. offline). The backend will still
    // reassign or invalidate the token later; what matters here is clearing
    // the local cache below.
    console.error('Error unregistering push token:', error);
  } finally {
    // ALWAYS clear the local cache, even if the server call failed. The
    // registerPushToken() dedup short-circuits when the cached token matches,
    // so a stale cache would block the next user on this device from
    // registering their own token (audit MO-01).
    await setPushToken('');
  }
}

/**
 * Handle notification tap - navigate to appropriate screen
 */
// UUID shape check so a spoofed/garbled id can't be pushed into a route.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only these path prefixes may be opened from a notification payload, so a
// server-supplied (or spoofed) actionUrl cannot deep-link anywhere arbitrary
// (audit MO-10).
const ALLOWED_ACTION_PREFIXES = ['/notices/', '/tasks', '/documents/', '/notifications', '/dashboard'];

/**
 * Route from a notification's data with the same validation everywhere — a
 * UUID-checked noticeId and an allow-listed actionUrl — so both a push tap and
 * the in-app list tap are safe from spoofed/arbitrary deep links (audit MO-10 /
 * B-list-tap). Shared by handleNotificationTap and the notifications screen.
 */
export function navigateForNotificationData(data: NotificationData | null | undefined): void {
  if (!data) return;

  if (data.noticeId && UUID_RE.test(String(data.noticeId))) {
    router.push(`/notices/${data.noticeId}` as any);
    return;
  }

  if (data.taskId) {
    router.push('/tasks');
    return;
  }

  if (data.actionUrl) {
    const url = String(data.actionUrl);
    if (url.startsWith('/') && ALLOWED_ACTION_PREFIXES.some((p) => url.startsWith(p))) {
      router.push(url as any);
    }
  }
}

export function handleNotificationTap(notification: NotificationsTypes.Notification): void {
  navigateForNotificationData(notification.request.content.data as NotificationData);
}

/**
 * Read the notification response that cold-started the app, if any.
 * Returns null in Expo Go, where the push module is unavailable.
 */
export async function getLastNotificationResponse(): Promise<NotificationsTypes.NotificationResponse | null> {
  if (!Notifications) return null;
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Get Android channel for notification type
 */
export function getNotificationChannel(type: string, priority: string): string {
  // Critical priority notifications
  if (priority === 'critical') {
    return NOTIFICATION_CHANNELS.DEADLINE_CRITICAL;
  }

  // Map notification types to channels
  switch (type) {
    case 'deadline_reminder':
    case 'sla_warning':
    case 'sla_breach':
    case 'document_overdue':
      return priority === 'high'
        ? NOTIFICATION_CHANNELS.DEADLINE_CRITICAL
        : NOTIFICATION_CHANNELS.DEADLINE_REGULAR;

    case 'task_assigned':
    case 'task_completed':
    case 'task_due':
      return NOTIFICATION_CHANNELS.TASKS;

    case 'comment_mention':
    case 'comment_reply':
    case 'document_requested':
    case 'document_received':
    case 'collaboration_invite':
      return NOTIFICATION_CHANNELS.COLLABORATION;

    default:
      return NOTIFICATION_CHANNELS.TASKS;
  }
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  seconds = 1
): Promise<string> {
  if (!Notifications) return '';

  const channelId = data?.type
    ? getNotificationChannel(data.type as string, (data.priority as string) || 'medium')
    : NOTIFICATION_CHANNELS.TASKS;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as Record<string, unknown>,
      sound: true,
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });

  return identifier;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(identifier: string): Promise<void> {
  await Notifications?.cancelScheduledNotificationAsync(identifier);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications?.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (!Notifications) return 0;
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications?.setBadgeCountAsync(count);
}

/**
 * Clear badge
 */
export async function clearBadge(): Promise<void> {
  await Notifications?.setBadgeCountAsync(0);
}

// Notification listener types
export type NotificationReceivedListener = (notification: NotificationsTypes.Notification) => void;
export type NotificationResponseListener = (response: NotificationsTypes.NotificationResponse) => void;

/**
 * Add notification received listener
 */
export function addNotificationReceivedListener(
  listener: NotificationReceivedListener
): NotificationsTypes.Subscription {
  if (!Notifications) return noopSubscription;
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Add notification response listener (tap handling)
 */
export function addNotificationResponseReceivedListener(
  listener: NotificationResponseListener
): NotificationsTypes.Subscription {
  if (!Notifications) return noopSubscription;
  return Notifications.addNotificationResponseReceivedListener(listener);
}
