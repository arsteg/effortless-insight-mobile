/**
 * Push Notifications Service
 * Handles push notification registration, handlers, and Android channels
 */

import { Platform, Alert, Linking } from 'react-native';
import type * as NotificationsTypes from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { setPushToken, getPushToken } from './storage/secure';
import { notificationsApi } from './api/notifications';
import { NOTIFICATION_CHANNELS } from '../utils/constants';
import { getAppInfo, formatVersion } from '../utils/appInfo';
import type { NotificationData } from '../types/notification';

// expo-notifications' Android push module was removed from Expo Go in SDK 53+
// and throws at import time there, so load it lazily and no-op every export in
// Expo Go. Full behavior is preserved in development/production builds.
/**
 * NOTE ON APP TRACKING TRANSPARENCY (TC-MOB-071).
 *
 * Firebase is used here for PUSH ONLY. `IS_ADS_ENABLED` and
 * `IS_ANALYTICS_ENABLED` are false in GoogleService-Info.plist, no analytics or
 * advertising SDK is installed, and the IDFA is never read — so the app does no
 * cross-company tracking and iOS ATT does not apply. There is deliberately no
 * `NSUserTrackingUsageDescription` in app.json: adding that key declares the
 * app tracks, and showing the ATT prompt without a tracking purpose is itself
 * grounds for App Review rejection (guideline 5.1.2).
 *
 * IF YOU ADD Firebase Analytics, ads, or an attribution SDK (AppsFlyer,
 * Adjust, Branch), ATT becomes mandatory and this all changes:
 *   1. add `expo-tracking-transparency` and call
 *      requestTrackingPermissionsAsync() before any tracking begins,
 *   2. add NSUserTrackingUsageDescription to app.json,
 *   3. update the App Store privacy labels to declare tracking.
 */
const isExpoGo = Constants.executionEnvironment === 'storeClient';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: typeof NotificationsTypes | null = isExpoGo
  ? null
  : require('expo-notifications');

const noopSubscription = { remove: () => {} } as NotificationsTypes.Subscription;

// TEMP (testing only): allow remote push on emulators in dev builds. Emulator
// images WITH Google Play services can receive FCM, so the Device.isDevice
// guard below is relaxed under __DEV__. Remove before production if undesired.
//
// Android only: the iOS Simulator has no APNs connection, so it cannot mint an
// FCM token at all. Relaxing the guard there makes getToken() throw ("No APNS
// token specified before retrieving FCM Token") instead of returning the clear
// "requires a physical device" warning.
const allowEmulatorPush = __DEV__ && Platform.OS === 'android';

// Configure notification handler behavior
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as NotificationData;
      const priority = (data?.priority as string) || 'medium';

      // The server already applied the user's channel preferences and quiet
      // hours before sending (NotificationEngineService), so anything that
      // arrives is something they asked to be told about. Silencing `medium`
      // here overrode that decision and left a notice assignment — the most
      // common notification there is — mute in the foreground (TC-MOB-049).
      // Only `low` stays silent, as background chatter while the app is in use.
      const shouldSound = priority !== 'low';

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

  // General — the API's fallback channel id. Notice assignments, 7-day
  // deadline warnings, GST sync and billing all arrive on this one, so it is
  // not a rare edge case; without it the OS invents a "Miscellaneous" channel
  // the user cannot meaningfully configure (TC-MOB-049).
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.DEFAULT, {
    name: 'General',
    description: 'Notice assignments, updates, and other alerts',
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
/**
 * Notification permission as the app needs to reason about it (TC-MOB-050).
 *
 * `undetermined` and `denied` are very different situations and were
 * previously collapsed into one boolean: the first can still be asked, the
 * second cannot — on iOS the system prompt is offered exactly once, and after
 * a refusal the only route back is the device's own settings.
 */
export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

/**
 * Read the current permission WITHOUT prompting.
 *
 * Lets the UI show what is actually true — settings can stop claiming push is
 * on when the OS is refusing it — and lets the primer be shown only when the
 * prompt is still available.
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (!Notifications || (!Device.isDevice && !allowEmulatorPush)) {
    return 'unavailable';
  }

  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'undetermined' || canAskAgain) return 'undetermined';
    return 'denied';
  } catch {
    return 'unavailable';
  }
}

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

/** Open this app's page in the device's own settings, for a denied permission. */
export async function openDeviceNotificationSettings(): Promise<void> {
  await Linking.openSettings();
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
export type PushRegistrationResult =
  | 'registered'
  /** The OS refused. Retrying cannot help; only device settings can. */
  | 'permission-denied'
  /** Simulator, Expo Go, or no Play services. Retrying cannot help either. */
  | 'unavailable'
  /** Something transient — offline, a 5xx. Worth retrying. */
  | 'failed';

/**
 * Register this device's push token with the backend.
 *
 * Returns a reason rather than a bare boolean so callers can tell a refusal
 * apart from a network blip: the old boolean made `registerPushTokenWithRetry`
 * re-attempt a denied permission three times, which cannot succeed and which
 * on Android can burn the user's remaining prompt (TC-MOB-050).
 */
export async function registerPushToken(): Promise<PushRegistrationResult> {
  const status = await getNotificationPermissionStatus();
  if (status === 'unavailable') return 'unavailable';
  if (status === 'denied') return 'permission-denied';

  try {
    const token = await getNativePushToken();
    if (!token) {
      // Permission was available a moment ago, so re-read it: the user may
      // have just refused the prompt getNativePushToken raised.
      const after = await getNotificationPermissionStatus();
      return after === 'granted' ? 'failed' : 'permission-denied';
    }

    // Check if we already registered this token
    const existingToken = await getPushToken();
    if (existingToken === token) {
      console.log('Push token already registered');
      return 'registered';
    }

    // Register with backend. The API takes a `deviceInfo` map; the flat
    // deviceId/deviceName sent before bound to nothing and every token row
    // stored an empty object, so a user's devices were indistinguishable.
    await notificationsApi.registerPushToken({
      token,
      platform: Platform.OS as 'ios' | 'android',
      deviceInfo: {
        deviceId: Device.modelId || Device.osInternalBuildId || 'unknown',
        deviceName: Device.deviceName || undefined,
        model: Device.modelName || undefined,
        os: `${Platform.OS} ${Device.osVersion ?? ''}`.trim(),
        appVersion: formatVersion(getAppInfo()),
      },
    });

    // Store token locally
    await setPushToken(token);

    console.log('Push token registered successfully');
    return 'registered';
  } catch (error) {
    console.error('Error registering push token:', error);
    return 'failed';
  }
}

/**
 * Register with a few retries and backoff. Registration is otherwise
 * fire-and-forget, so a transient failure (offline at login, a 5xx) meant no
 * push until the next cold start (audit MO-06). Returns true on success or if
 * the token was already registered.
 */
export async function registerPushTokenWithRetry(
  maxAttempts = 3
): Promise<PushRegistrationResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await registerPushToken();

    // Only a transient failure is worth another attempt. A refusal or an
    // unsupported device will return the same answer however many times it is
    // asked, and asking again wastes the user's prompts.
    if (result !== 'failed') return result;

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  console.warn('Push token registration failed after retries');
  return 'failed';
}

/**
 * Re-register whenever the OS rotates the push token (device restore, FCM/APNs
 * rotation). Without this the app registers only once per session and rotated
 * tokens silently stop receiving pushes (audit MO-05).
 */
export function addPushTokenRotationListener(): NotificationsTypes.Subscription {
  if (!Notifications) return noopSubscription;

  const subscriptions: { remove: () => void }[] = [
    Notifications.addPushTokenListener(() => {
      console.log('Device push token rotated; re-registering');
      registerPushTokenWithRetry();
    }),
  ];

  // addPushTokenListener reports the DEVICE token, which on iOS is the APNs
  // token — but getNativePushToken registers the FCM token there, and Firebase
  // rotates the two independently. An FCM-only rotation (app reinstall, data
  // restore, token expiry) therefore never fires the listener above, leaving a
  // stale token on the backend and silently killing push. Subscribe to
  // Firebase's own refresh event to cover that case.
  if (Platform.OS === 'ios') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const messaging = require('@react-native-firebase/messaging').default;
      const unsubscribe = messaging().onTokenRefresh(() => {
        console.log('FCM token refreshed; re-registering');
        registerPushTokenWithRetry();
      });
      subscriptions.push({ remove: unsubscribe });
    } catch {
      // Native module absent (Expo Go). The APNs listener above is all we get.
    }
  }

  return {
    remove: () => subscriptions.forEach((subscription) => subscription.remove()),
  } as NotificationsTypes.Subscription;
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
      return NOTIFICATION_CHANNELS.DEFAULT;
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
 * Schedule a local notification for a specific moment (TC-MOB-048).
 *
 * `scheduleLocalNotification` above only takes an interval in seconds, so it
 * cannot express "09:00 on the 15th". This uses a DATE trigger instead.
 *
 * Returns '' when nothing was scheduled — in Expo Go, where the notifications
 * module is unavailable, or for a time already past (expo fires a past DATE
 * trigger immediately, which would alert the user the moment they save).
 */
export async function scheduleNotificationAt(
  fireAt: Date,
  title: string,
  body: string,
  data?: NotificationData
): Promise<string> {
  if (!Notifications) return '';
  if (fireAt.getTime() <= Date.now()) return '';

  const granted = await requestNotificationPermissions();
  if (!granted) return '';

  const channelId = data?.type
    ? getNotificationChannel(data.type as string, (data.priority as string) || 'medium')
    : NOTIFICATION_CHANNELS.TASKS;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as Record<string, unknown>,
      sound: true,
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}

export interface ScheduledReminder {
  identifier: string;
  title: string;
  body: string;
  /** When it will fire, or undefined for a trigger with no readable date. */
  fireAt?: Date;
  taskId?: string;
}

/**
 * Everything currently queued with the OS (TC-MOB-048).
 *
 * Reads the system's own scheduling list rather than the app's bookkeeping, so
 * it answers "will this actually fire?" and not merely "did we think we set
 * it?". Empty in Expo Go, where nothing can be scheduled at all.
 */
export async function getScheduledReminders(): Promise<ScheduledReminder[]> {
  if (!Notifications) return [];

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  return scheduled
    .map((entry) => {
      const trigger = entry.trigger as { type?: string; date?: number | string } | null;
      const raw = trigger?.date;
      const fireAt = raw != null ? new Date(raw) : undefined;

      return {
        identifier: entry.identifier,
        title: entry.content.title ?? 'Reminder',
        body: entry.content.body ?? '',
        fireAt: fireAt && !Number.isNaN(fireAt.getTime()) ? fireAt : undefined,
        taskId: (entry.content.data as Record<string, unknown> | undefined)?.taskId as
          | string
          | undefined,
      };
    })
    .sort((a, b) => (a.fireAt?.getTime() ?? 0) - (b.fireAt?.getTime() ?? 0));
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
