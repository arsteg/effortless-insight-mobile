/**
 * GSTN Connection Settings Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  RefreshCw,
  Clock,
  Zap,
  AlertCircle,
  Link2Off,
  CheckCircle,
} from 'lucide-react-native';
import { formatDistanceToNow, format } from 'date-fns';

import {
  useGstnConnectionStatus,
  useUpdateSettings,
  useDisconnect,
  useTriggerSync,
} from '../../src/hooks/useGstn';
import { getStatusLabel, canSync } from '../../src/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const SYNC_INTERVAL_OPTIONS = [
  { value: 1, label: 'Every hour' },
  { value: 2, label: 'Every 2 hours' },
  { value: 4, label: 'Every 4 hours' },
  { value: 6, label: 'Every 6 hours' },
  { value: 12, label: 'Every 12 hours' },
  { value: 24, label: 'Once a day' },
];

export default function GstnSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gstinId: string;
    gstin: string;
  }>();

  const { data: connection, isLoading, refetch } = useGstnConnectionStatus(params.gstinId || '');
  const updateSettings = useUpdateSettings();
  const disconnect = useDisconnect();
  const triggerSync = useTriggerSync();

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncIntervalHours, setSyncIntervalHours] = useState(6);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from connection data
  useEffect(() => {
    if (connection) {
      setAutoSyncEnabled(connection.autoSyncEnabled);
      setSyncIntervalHours(connection.syncIntervalHours);
    }
  }, [connection]);

  // Track changes
  useEffect(() => {
    if (connection) {
      const changed =
        autoSyncEnabled !== connection.autoSyncEnabled ||
        syncIntervalHours !== connection.syncIntervalHours;
      setHasChanges(changed);
    }
  }, [autoSyncEnabled, syncIntervalHours, connection]);

  const handleSave = async () => {
    if (!params.gstinId) return;

    try {
      await updateSettings.mutateAsync({
        gstinId: params.gstinId,
        settings: {
          autoSyncEnabled,
          syncIntervalHours,
        },
      });
      setHasChanges(false);
    } catch (e) {
      // Error handled by hook
    }
  };

  const handleSync = async () => {
    if (!params.gstinId) return;
    triggerSync.mutate(params.gstinId);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect GSTIN',
      `Are you sure you want to disconnect ${params.gstin} from the GST Portal?\n\nThis will stop automatic notice fetching. You can reconnect later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            if (!params.gstinId) return;
            try {
              await disconnect.mutateAsync({ gstinId: params.gstinId });
              router.back();
            } catch (e) {
              // Error handled by hook
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Connection Settings' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Connection Settings',
          headerRight: () =>
            hasChanges ? (
              <TouchableOpacity
                onPress={handleSave}
                disabled={updateSettings.isPending}
                style={styles.saveButton}
              >
                {updateSettings.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            ) : null,
        }}
      />

      <ScrollView style={styles.container}>
        {/* GSTIN Info */}
        <View style={styles.card}>
          <Text style={styles.gstinLabel}>GSTIN</Text>
          <Text style={styles.gstin}>{params.gstin}</Text>
          {connection && (
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: connection.isConnected ? COLORS.success : COLORS.error },
                ]}
              />
              <Text style={styles.statusText}>{getStatusLabel(connection.status)}</Text>
            </View>
          )}
        </View>

        {/* Auto-Sync Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auto-Sync Settings</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Zap size={20} color={COLORS.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Auto-Sync Enabled</Text>
                <Text style={styles.settingDescription}>
                  Automatically fetch new notices from the GST Portal
                </Text>
              </View>
            </View>
            <Switch
              value={autoSyncEnabled}
              onValueChange={setAutoSyncEnabled}
              trackColor={{ false: COLORS.gray[300], true: COLORS.primaryLight }}
              thumbColor={autoSyncEnabled ? COLORS.primary : COLORS.gray[100]}
            />
          </View>

          {autoSyncEnabled && (
            <View style={styles.intervalSection}>
              <View style={styles.intervalHeader}>
                <Clock size={16} color={COLORS.gray[500]} />
                <Text style={styles.intervalLabel}>Sync Interval</Text>
              </View>
              <View style={styles.intervalOptions}>
                {SYNC_INTERVAL_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.intervalOption,
                      syncIntervalHours === option.value && styles.intervalOptionSelected,
                    ]}
                    onPress={() => setSyncIntervalHours(option.value)}
                  >
                    <Text
                      style={[
                        styles.intervalOptionText,
                        syncIntervalHours === option.value && styles.intervalOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Connection Info */}
        {connection?.isConnected && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connection Info</Text>

            <View style={styles.infoCard}>
              {connection.connectedAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Connected</Text>
                  <Text style={styles.infoValue}>
                    {format(new Date(connection.connectedAt), 'MMM d, yyyy')}
                  </Text>
                </View>
              )}

              {connection.lastSyncAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Last Synced</Text>
                  <Text style={styles.infoValue}>
                    {formatDistanceToNow(new Date(connection.lastSyncAt), { addSuffix: true })}
                  </Text>
                </View>
              )}

              {connection.nextScheduledSyncAt && autoSyncEnabled && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Next Sync</Text>
                  <Text style={styles.infoValue}>
                    {formatDistanceToNow(new Date(connection.nextScheduledSyncAt), {
                      addSuffix: true,
                    })}
                  </Text>
                </View>
              )}

              {connection.connectedByName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Connected By</Text>
                  <Text style={styles.infoValue}>{connection.connectedByName}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity
            style={[
              styles.actionButton,
              (!connection?.isConnected || !canSync(connection.status) || triggerSync.isPending) &&
                styles.actionButtonDisabled,
            ]}
            onPress={handleSync}
            disabled={
              !connection?.isConnected || !canSync(connection.status) || triggerSync.isPending
            }
          >
            {triggerSync.isPending ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <RefreshCw size={20} color={COLORS.primary} />
            )}
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionButtonLabel}>Sync Now</Text>
              <Text style={styles.actionButtonDescription}>
                Manually fetch notices from the GST Portal
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleDisconnect}
            disabled={disconnect.isPending}
          >
            {disconnect.isPending ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Link2Off size={20} color={COLORS.error} />
            )}
            <View style={styles.actionButtonContent}>
              <Text style={[styles.actionButtonLabel, { color: COLORS.error }]}>Disconnect</Text>
              <Text style={styles.actionButtonDescription}>
                Stop automatic notice fetching
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Error Banner */}
        {connection?.lastSyncError && (
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color={COLORS.error} />
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>Last Sync Failed</Text>
              <Text style={styles.errorMessage}>{connection.lastSyncError}</Text>
            </View>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[100],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[100],
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  gstinLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gstin: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: COLORS.gray[900],
    marginTop: SPACING.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: SPACING.md,
  },
  settingText: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  settingLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  settingDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  intervalSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  intervalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  intervalLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[600],
    marginLeft: SPACING.sm,
  },
  intervalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  intervalOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  intervalOptionSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  intervalOptionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  intervalOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  infoCard: {
    gap: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  infoValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray[50],
    marginBottom: SPACING.sm,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonDanger: {
    backgroundColor: '#fef2f2',
  },
  actionButtonContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  actionButtonLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  actionButtonDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  errorTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.error,
  },
  errorMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginTop: SPACING.xs,
  },
  spacer: {
    height: SPACING.xl,
  },
});
