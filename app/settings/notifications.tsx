/**
 * Notification Settings Screen
 * Allows users to configure notification preferences
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import {
  Bell,
  Mail,
  Smartphone,
  ExternalLink,
  Moon,
  Clock,
  FileText,
  CheckSquare,
  MessageCircle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react-native';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../src/hooks/useNotifications';
import {
  scheduleLocalNotification,
  registerPushTokenWithRetry,
  getScheduledReminders,
  getNotificationPermissionStatus,
  openDeviceNotificationSettings,
  ScheduledReminder,
  NotificationPermissionStatus,
} from '../../src/services/pushNotifications';
import { pushRowState, registrationMessage } from '../../src/utils/notificationPriming';
import { useUIStore } from '../../src/stores';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import type { NotificationChannelPreferences, NotificationType } from '../../src/types/notification';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingSection({ title, children }: SettingSectionProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

interface SettingRowProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  rightContent?: React.ReactNode;
  disabled?: boolean;
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  onPress,
  rightContent,
  disabled,
}: SettingRowProps) {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const content = (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      {icon && <View style={styles.settingIcon}>{icon}</View>}
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, disabled && styles.settingTitleDisabled]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        )}
      </View>
      {onValueChange !== undefined && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: COLORS.gray[200], true: COLORS.primary }}
          thumbColor={COLORS.white}
          disabled={disabled}
        />
      )}
      {rightContent}
      {onPress && <ChevronRight color={COLORS.gray[400]} size={20} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const notificationTypes = (
  COLORS: Palette
): { type: NotificationType; label: string; icon: React.ReactNode }[] => [
  { type: 'deadline_reminder', label: 'Deadline Reminders', icon: <Clock color={COLORS.warning} size={20} /> },
  { type: 'task_assigned', label: 'Task Assignments', icon: <CheckSquare color={COLORS.primary} size={20} /> },
  { type: 'task_due', label: 'Task Due Alerts', icon: <AlertTriangle color={COLORS.warning} size={20} /> },
  { type: 'document_requested', label: 'Document Requests', icon: <FileText color={COLORS.secondary} size={20} /> },
  { type: 'comment_mention', label: 'Mentions', icon: <MessageCircle color={COLORS.primary} size={20} /> },
  { type: 'comment_reply', label: 'Replies', icon: <MessageCircle color={COLORS.gray[500]} size={20} /> },
  { type: 'sla_warning', label: 'SLA Warnings', icon: <AlertTriangle color={COLORS.error} size={20} /> },
];

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const { data: preferences, isLoading: isLoadingPreferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const showToast = useUIStore((state) => state.showToast);

  const [localChannels, setLocalChannels] = useState<NotificationChannelPreferences | null>(null);
  // The OS's answer, not the stored preference. Without this the push row read
  // "on" from a server default while the OS refused everything (TC-MOB-050).
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>('granted');

  useFocusEffect(
    useCallback(() => {
      void getNotificationPermissionStatus().then(setPermissionStatus);
    }, [])
  );

  const channels = localChannels ?? preferences?.channels ?? {
    inApp: true,
    email: true,
    push: true,
    sms: false,
    whatsApp: false,
  };

  const handleChannelChange = useCallback(
    async (channel: keyof NotificationChannelPreferences, value: boolean) => {
      // Enabling the push channel must actually secure OS permission and
      // register the device token — not just flip a stored preference (audit B5).
      if (channel === 'push' && value) {
        const result = await registerPushTokenWithRetry();
        if (result !== 'registered') {
          // Say which of the three failure modes it was, rather than one
          // catch-all that blames device settings even when the network is
          // at fault (TC-MOB-050).
          showToast('error', registrationMessage(result) ?? 'Could not enable push.');
          setPermissionStatus(await getNotificationPermissionStatus());
          return; // don't persist push=true if we couldn't register
        }
        setPermissionStatus('granted');
      }
      const newChannels = { ...channels, [channel]: value };
      setLocalChannels(newChannels);
      updatePreferences.mutate({ channels: newChannels });
    },
    [channels, updatePreferences, showToast]
  );

  const handleQuietHoursToggle = useCallback(
    (enabled: boolean) => {
      updatePreferences.mutate({
        quietHours: { enabled },
      });
    },
    [updatePreferences]
  );

  const handleDailyDigestToggle = useCallback(
    (enabled: boolean) => {
      updatePreferences.mutate({
        dailyDigest: { enabled },
      });
    },
    [updatePreferences]
  );

  const handleTestNotification = useCallback(async () => {
    try {
      await scheduleLocalNotification(
        'Test Notification',
        'This is a test notification from EffortlessInsight',
        { type: 'test', priority: 'medium' } as any
      );
      Alert.alert(t('settings.success'), t('settings.testNotificationSent'));
    } catch (error) {
      Alert.alert(t('settings.error'), t('settings.failedToSendTestNotification'));
    }
  }, []);

  if (isLoadingPreferences) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Notification Settings' }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Notification Settings' }} />

      <ScrollView>
        {/* Channels */}
        <SettingSection title={t('settings.notificationChannels')}>
          <SettingRow
            icon={<Bell color={COLORS.primary} size={20} />}
            title={t('settings.inAppNotifications')}
            subtitle={t('settings.showNotificationsWithinTheApp')}
            value={channels.inApp}
            onValueChange={(v) => handleChannelChange('inApp', v)}
          />
          {pushRowState(permissionStatus) === 'toggle' ? (
            <SettingRow
              icon={<Smartphone color={COLORS.success} size={20} />}
              title={t('settings.pushNotifications')}
              subtitle={t('settings.receivePushNotificationsOnYourDevice')}
              value={channels.push}
              onValueChange={(v) => handleChannelChange('push', v)}
            />
          ) : (
            <TouchableOpacity
              style={styles.blockedRow}
              onPress={
                pushRowState(permissionStatus) === 'blocked'
                  ? openDeviceNotificationSettings
                  : undefined
              }
              disabled={pushRowState(permissionStatus) !== 'blocked'}
              accessibilityRole="button"
            >
              <Smartphone color={COLORS.gray[400]} size={20} />
              <View style={styles.blockedText}>
                <Text style={styles.blockedTitle}>{t('settings.pushNotifications')}</Text>
                <Text style={styles.blockedSubtitle}>
                  {pushRowState(permissionStatus) === 'blocked'
                    ? 'Turned off for this app. Tap to open device settings.'
                    : 'Needs a physical device.'}
                </Text>
              </View>
              {pushRowState(permissionStatus) === 'blocked' && (
                <ExternalLink color={COLORS.primary} size={18} />
              )}
            </TouchableOpacity>
          )}
          <SettingRow
            icon={<Mail color={COLORS.secondary} size={20} />}
            title={t('settings.emailNotifications')}
            subtitle={t('settings.getNotifiedViaEmail')}
            value={channels.email}
            onValueChange={(v) => handleChannelChange('email', v)}
          />
        </SettingSection>

        {/* Quiet Hours */}
        <SettingSection title={t('settings.quietHours')}>
          <SettingRow
            icon={<Moon color={COLORS.gray[600]} size={20} />}
            title={t('settings.enableQuietHours')}
            subtitle={t('settings.pauseNonCriticalNotificationsDuringSetHo')}
            value={preferences?.quietHours?.enabled ?? false}
            onValueChange={handleQuietHoursToggle}
          />
          {preferences?.quietHours?.enabled && (
            <SettingRow
              icon={<Clock color={COLORS.gray[400]} size={20} />}
              title={t('settings.schedule')}
              subtitle={`${preferences.quietHours.startTime || '22:00'} - ${preferences.quietHours.endTime || '08:00'}`}
              onPress={() => Alert.alert(t('settings.comingSoon'), t('settings.timePickerWillBeAdded'))}
            />
          )}
        </SettingSection>

        {/* Digests */}
        <SettingSection title={t('settings.emailDigests')}>
          <SettingRow
            icon={<Mail color={COLORS.warning} size={20} />}
            title={t('settings.dailyDigest')}
            subtitle={t('settings.receiveASummaryOfNotificationsEachDay')}
            value={preferences?.dailyDigest?.enabled ?? false}
            onValueChange={handleDailyDigestToggle}
          />
        </SettingSection>

        {/* Notification Types */}
        <SettingSection title={t('settings.notificationTypes')}>
          {notificationTypes(COLORS).map((item) => {
            const typePrefs = preferences?.typePreferences?.[item.type];
            return (
              <SettingRow
                key={item.type}
                icon={item.icon}
                title={item.label}
                value={typePrefs?.enabled ?? true}
                onValueChange={(value) => {
                  updatePreferences.mutate({
                    typePreferences: {
                      [item.type]: { enabled: value },
                    },
                  });
                }}
              />
            );
          })}
        </SettingSection>

        {/* What is actually queued with the OS */}
        <SettingSection title={t('settings.scheduledReminders')}>
          <ScheduledRemindersList />
        </SettingSection>

        {/* Test */}
        <SettingSection title={t('settings.testing')}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestNotification}
          >
            <Bell color={COLORS.white} size={20} />
            <Text style={styles.testButtonText}>{t('settings.sendTestNotification')}</Text>
          </TouchableOpacity>
        </SettingSection>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Critical deadline notifications will always be delivered regardless of settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Shows the reminders the OS has queued (TC-MOB-048).
 *
 * Reads the system list on focus rather than the app's own record, so it
 * reflects what will really fire — including reminders scheduled in an earlier
 * session, and excluding any the user revoked permission for.
 */
function ScheduledRemindersList() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReminders(await getScheduledReminders());
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return <Text style={styles.reminderEmpty}>{t('settings.checking')}</Text>;
  }

  if (reminders.length === 0) {
    return (
      <View>
        <Text style={styles.reminderEmpty}>{t('settings.noRemindersScheduled')}</Text>
        <Text style={styles.reminderHint}>
          Give a task a due date and one is set automatically.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {reminders.map((reminder) => (
        <View key={reminder.identifier} style={styles.reminderRow}>
          <Clock size={16} color={COLORS.primary} />
          <View style={styles.reminderBody}>
            <Text style={styles.reminderTitle} numberOfLines={1}>
              {reminder.title}
            </Text>
            <Text style={styles.reminderWhen}>
              {reminder.fireAt
                ? reminder.fireAt.toLocaleString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Scheduled'}
            </Text>
          </View>
        </View>
      ))}
      <TouchableOpacity onPress={load} style={styles.reminderRefresh}>
        <Text style={styles.reminderRefreshText}>{t('settings.refresh')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  blockedText: {
    flex: 1,
  },
  blockedTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[500],
  },
  blockedSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: 2,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  reminderBody: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  reminderWhen: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  reminderEmpty: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    paddingVertical: SPACING.md,
  },
  reminderHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[400],
    paddingBottom: SPACING.md,
  },
  reminderRefresh: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  reminderRefreshText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionContent: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.gray[200],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 32,
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  settingTitleDisabled: {
    color: COLORS.gray[400],
  },
  settingSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  testButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[400],
    textAlign: 'center',
    lineHeight: 18,
  },
});
