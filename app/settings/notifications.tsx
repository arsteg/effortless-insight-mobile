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
import { Stack } from 'expo-router';
import {
  Bell,
  Mail,
  Smartphone,
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
import { scheduleLocalNotification } from '../../src/services/pushNotifications';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import type { NotificationChannelPreferences, NotificationType } from '../../src/types/notification';

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingSection({ title, children }: SettingSectionProps) {
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

const NOTIFICATION_TYPES: { type: NotificationType; label: string; icon: React.ReactNode }[] = [
  { type: 'deadline_reminder', label: 'Deadline Reminders', icon: <Clock color={COLORS.warning} size={20} /> },
  { type: 'task_assigned', label: 'Task Assignments', icon: <CheckSquare color={COLORS.primary} size={20} /> },
  { type: 'task_due', label: 'Task Due Alerts', icon: <AlertTriangle color={COLORS.warning} size={20} /> },
  { type: 'document_requested', label: 'Document Requests', icon: <FileText color={COLORS.secondary} size={20} /> },
  { type: 'comment_mention', label: 'Mentions', icon: <MessageCircle color={COLORS.primary} size={20} /> },
  { type: 'comment_reply', label: 'Replies', icon: <MessageCircle color={COLORS.gray[500]} size={20} /> },
  { type: 'sla_warning', label: 'SLA Warnings', icon: <AlertTriangle color={COLORS.error} size={20} /> },
];

export default function NotificationSettingsScreen() {
  const { data: preferences, isLoading: isLoadingPreferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const [localChannels, setLocalChannels] = useState<NotificationChannelPreferences | null>(null);

  const channels = localChannels ?? preferences?.channels ?? {
    inApp: true,
    email: true,
    push: true,
    sms: false,
    whatsApp: false,
  };

  const handleChannelChange = useCallback(
    (channel: keyof NotificationChannelPreferences, value: boolean) => {
      const newChannels = { ...channels, [channel]: value };
      setLocalChannels(newChannels);
      updatePreferences.mutate({ channels: newChannels });
    },
    [channels, updatePreferences]
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
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
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
        <SettingSection title="Notification Channels">
          <SettingRow
            icon={<Bell color={COLORS.primary} size={20} />}
            title="In-App Notifications"
            subtitle="Show notifications within the app"
            value={channels.inApp}
            onValueChange={(v) => handleChannelChange('inApp', v)}
          />
          <SettingRow
            icon={<Smartphone color={COLORS.success} size={20} />}
            title="Push Notifications"
            subtitle="Receive push notifications on your device"
            value={channels.push}
            onValueChange={(v) => handleChannelChange('push', v)}
          />
          <SettingRow
            icon={<Mail color={COLORS.secondary} size={20} />}
            title="Email Notifications"
            subtitle="Get notified via email"
            value={channels.email}
            onValueChange={(v) => handleChannelChange('email', v)}
          />
        </SettingSection>

        {/* Quiet Hours */}
        <SettingSection title="Quiet Hours">
          <SettingRow
            icon={<Moon color={COLORS.gray[600]} size={20} />}
            title="Enable Quiet Hours"
            subtitle="Pause non-critical notifications during set hours"
            value={preferences?.quietHours?.enabled ?? false}
            onValueChange={handleQuietHoursToggle}
          />
          {preferences?.quietHours?.enabled && (
            <SettingRow
              icon={<Clock color={COLORS.gray[400]} size={20} />}
              title="Schedule"
              subtitle={`${preferences.quietHours.startTime || '22:00'} - ${preferences.quietHours.endTime || '08:00'}`}
              onPress={() => Alert.alert('Coming Soon', 'Time picker will be added')}
            />
          )}
        </SettingSection>

        {/* Digests */}
        <SettingSection title="Email Digests">
          <SettingRow
            icon={<Mail color={COLORS.warning} size={20} />}
            title="Daily Digest"
            subtitle="Receive a summary of notifications each day"
            value={preferences?.dailyDigest?.enabled ?? false}
            onValueChange={handleDailyDigestToggle}
          />
        </SettingSection>

        {/* Notification Types */}
        <SettingSection title="Notification Types">
          {NOTIFICATION_TYPES.map((item) => {
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

        {/* Test */}
        <SettingSection title="Testing">
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestNotification}
          >
            <Bell color={COLORS.white} size={20} />
            <Text style={styles.testButtonText}>Send Test Notification</Text>
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

const styles = StyleSheet.create({
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
