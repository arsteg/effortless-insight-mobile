/**
 * Email Sync Settings Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Settings, Mail, Check } from 'lucide-react-native';

import { useEmailAccount, useUpdateEmailSettings } from '../../src/hooks/useEmailSync';
import { getProviderLabel } from '../../src/types/emailSync';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';

export default function EmailSyncSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const { accountId, email } = useLocalSearchParams<{
    accountId: string;
    email: string;
  }>();

  const { data: account, isLoading } = useEmailAccount(accountId);
  const updateSettings = useUpdateEmailSettings();

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  // Initialize state from account data
  useEffect(() => {
    if (account) {
      setAutoSyncEnabled(account.autoSyncEnabled);
    }
  }, [account]);

  const hasChanges = account && autoSyncEnabled !== account.autoSyncEnabled;

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      accountId,
      settings: {
        autoSyncEnabled,
      },
    });
    router.back();
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Sync Settings' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Sync Settings',
          headerRight: () =>
            hasChanges ? (
              <TouchableOpacity
                onPress={handleSave}
                disabled={updateSettings.isPending}
                style={styles.headerButton}
              >
                {updateSettings.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Check size={20} color={COLORS.white} />
                )}
              </TouchableOpacity>
            ) : null,
        }}
      />

      <ScrollView style={styles.container}>
        {/* Account Info */}
        <View style={styles.accountCard}>
          <View style={styles.accountIcon}>
            <Mail size={24} color={COLORS.primary} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountEmail}>{email}</Text>
            {account && (
              <Text style={styles.accountProvider}>
                {getProviderLabel(account.provider)}
              </Text>
            )}
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Settings</Text>

          {/* Auto Sync Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Automatic Sync</Text>
              <Text style={styles.settingDescription}>
                Automatically scan for GST notices daily
              </Text>
            </View>
            <Switch
              value={autoSyncEnabled}
              onValueChange={setAutoSyncEnabled}
              trackColor={{ false: COLORS.gray[300], true: `${COLORS.primary}60` }}
              thumbColor={autoSyncEnabled ? COLORS.primary : COLORS.gray[100]}
              disabled={updateSettings.isPending}
            />
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            When enabled, we scan your inbox daily for emails from GST authorities
            and automatically import any notices found. Only emails from verified
            GST authority addresses are scanned.
          </Text>
        </View>

        {/* Save Button (for accessibility when header button not visible) */}
        {hasChanges && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.gray[100],
    },
    headerButton: {
      padding: SPACING.sm,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: COLORS.gray[100],
    },
    loadingText: {
      marginTop: SPACING.md,
      color: COLORS.gray[600],
    },
    accountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.white,
      padding: SPACING.md,
      marginTop: SPACING.md,
      marginHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      shadowColor: COLORS.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    accountIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: `${COLORS.primary}10`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    accountInfo: {
      marginLeft: SPACING.md,
      flex: 1,
    },
    accountEmail: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '600',
      color: COLORS.gray[900],
    },
    accountProvider: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[500],
      marginTop: 2,
    },
    section: {
      marginTop: SPACING.lg,
      marginHorizontal: SPACING.md,
      backgroundColor: COLORS.white,
      borderRadius: BORDER_RADIUS.lg,
      shadowColor: COLORS.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: COLORS.gray[500],
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.gray[200],
    },
    settingInfo: {
      flex: 1,
      marginRight: SPACING.md,
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
    infoSection: {
      marginTop: SPACING.lg,
      marginHorizontal: SPACING.md,
      padding: SPACING.md,
      backgroundColor: COLORS.gray[200],
      borderRadius: BORDER_RADIUS.lg,
    },
    infoText: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[600],
      lineHeight: 20,
    },
    saveButton: {
      marginTop: SPACING.lg,
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.xl,
      backgroundColor: COLORS.primary,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
    saveButtonText: {
      color: COLORS.white,
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
    },
  });
