/**
 * Profile/Settings Screen
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  User,
  Bell,
  Shield,
  Fingerprint,
  Database,
  HardDrive,
  CloudOff,
  RefreshCw,
  WifiOff,
  Wifi,
  EyeOff,
  LogOut,
  ChevronRight,
  Moon,
  Globe,
  HelpCircle,
  Info,
  LifeBuoy,
  Trash2,
  ExternalLink,
  CreditCard,
  Link2,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuthStore, useOfflineStore, useUIStore } from '../../src/stores';
import {
  getCacheSize,
  getCachedCount,
  clearAll as clearDocumentCache,
} from '../../src/services/documentCache';
import {
  listPendingUploads,
  getPendingUploadBytes,
  resetPendingUpload,
  syncPendingUploads,
  clearPendingUploads,
} from '../../src/services/pendingUploads';
import { formatBytes } from '../../src/utils/documentCachePolicy';
import {
  loadScreenProtection,
  setScreenProtection as setScreenProtectionPref,
  DEFAULT_PROTECTION_ENABLED,
} from '../../src/services/screenSecurity';
import { getAppInfo, formatVersion } from '../../src/utils/appInfo';
import { THEME_MODES } from '../../src/theme/palettes';
import {
  loadOfflinePreferences,
  setOfflinePreference,
} from '../../src/services/offlinePreferences';
import {
  DEFAULT_OFFLINE_PREFERENCES,
} from '../../src/utils/offlinePreferences';
import type { OfflinePreferences } from '../../src/utils/offlinePreferences';
import { pendingSummary, countByStatus } from '../../src/utils/pendingUploadPolicy';
import type { PendingUpload } from '../../src/utils/pendingUploadPolicy';
import { useTranslation } from '../../src/hooks';
import { Button, LoadingSpinner } from '../../src/components/common';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { Languages } from 'lucide-react-native';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';

export default function ProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const {
    user,
    logout,
    isLoading,
    biometricEnabled,
    biometricAvailable,
    enableBiometric,
    disableBiometric,
  } = useAuthStore();

  const { queueTotal, clearAllCache, clearAllQueue, loadCacheStatus, loadQueueStatus } =
    useOfflineStore();
  const { t, locale, isHindi } = useTranslation();

  const handleLanguage = () => {
    router.push('/settings/language');
  };

  React.useEffect(() => {
    loadCacheStatus();
    loadQueueStatus();
  }, []);

  const handleLogout = () => {
    Alert.alert(t('profile.logout'),
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleBiometricToggle = async () => {
    if (biometricEnabled) {
      await disableBiometric();
    } else {
      const success = await enableBiometric();
      if (!success) {
        Alert.alert(t('profile.error'), t('profile.failedToEnableBiometricAuthentication'));
      }
    }
  };

  // Size of the downloaded-document store, refreshed when the screen regains
  // focus so it reflects documents saved since it was last seen.
  const [documentBytes, setDocumentBytes] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);

  const themeMode = useUIStore((state) => state.themeMode);
  const setThemeMode = useUIStore((state) => state.setThemeMode);
  const forcedOffline = useUIStore((state) => state.forcedOffline);
  const setForcedOffline = useUIStore((state) => state.setForcedOffline);

  const [offlinePrefs, setOfflinePrefs] = useState<OfflinePreferences>(
    DEFAULT_OFFLINE_PREFERENCES
  );

  const handleOfflinePref = useCallback(
    async (key: keyof OfflinePreferences, value: boolean) => {
      setOfflinePrefs(await setOfflinePreference(key, value));
    },
    []
  );

  const [screenProtection, setScreenProtection] = useState(DEFAULT_PROTECTION_ENABLED);

  const handleScreenProtection = useCallback(async (enabled: boolean) => {
    setScreenProtection(await setScreenProtectionPref(enabled));
  }, []);

  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [pendingUploadBytes, setPendingUploadBytes] = useState(0);

  const refreshDocumentStats = useCallback(async () => {
    const [bytes, count, uploads, uploadBytes] = await Promise.all([
      getCacheSize(),
      getCachedCount(),
      listPendingUploads(),
      getPendingUploadBytes(),
    ]);
    setDocumentBytes(bytes);
    setDocumentCount(count);
    setPendingUploads(uploads);
    setPendingUploadBytes(uploadBytes);
    setOfflinePrefs(await loadOfflinePreferences());
    setScreenProtection(await loadScreenProtection());
  }, []);

  /** Put failed uploads back in the queue and run a sync now. */
  const handleRetryUploads = async () => {
    const blocked = pendingUploads.filter((upload) => upload.status === 'blocked');
    await Promise.all(blocked.map((upload) => resetPendingUpload(upload.id)));
    await syncPendingUploads();
    await refreshDocumentStats();
  };

  const handleDiscardUploads = () => {
    Alert.alert(t('profile.discardPendingUploads'),
      `${pendingUploads.length} scanned ${
        pendingUploads.length === 1 ? 'document has' : 'documents have'
      } not been uploaded yet. Discarding removes them permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await clearPendingUploads();
            await refreshDocumentStats();
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      void refreshDocumentStats();
    }, [refreshDocumentStats])
  );

  const handleClearDocuments = () => {
    Alert.alert(t('profile.clearDownloads'),
      `This removes ${documentCount} downloaded ${
        documentCount === 1 ? 'document' : 'documents'
      } (${formatBytes(documentBytes)}). They will need re-downloading to view offline.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearDocumentCache();
            await refreshDocumentStats();
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(t('profile.clearCache'),
      'This will clear all cached data. You will need to reload data when you go online.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllCache();
            await clearAllQueue();
            Alert.alert(t('profile.success'), t('profile.cacheClearedSuccessfully'));
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    router.push('/settings/edit-profile');
  };

  const handleSecurity = () => {
    router.push('/settings/change-password');
  };

  const handleOrganization = () => {
    Alert.alert(t('profile.organization'),
      `You are currently logged in to: ${user?.organization?.name || 'Unknown Organization'}\n\nOrganization settings are available on the web app.`,
      [
        { text: 'OK' },
        {
          text: 'Open Web App',
          onPress: () => {
            Linking.openURL('https://app.effortlessinsight.in/settings/organization');
          },
        },
      ]
    );
  };

  const handleHelpCenter = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://help.effortlessinsight.in');
    } catch (error) {
      Alert.alert(t('profile.error'), t('profile.couldNotOpenHelpCenter'));
    }
  };

  const handlePrivacyPolicy = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://effortlessinsight.in/privacy');
    } catch (error) {
      Linking.openURL('https://effortlessinsight.in/privacy');
    }
  };

  const handleTermsOfService = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://effortlessinsight.in/terms');
    } catch (error) {
      Linking.openURL('https://effortlessinsight.in/terms');
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {user?.role?.charAt(0).toUpperCase()}
            {user?.role?.slice(1) || 'Member'}
          </Text>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.account')}</Text>

        <SettingItem
          icon={<User size={20} color={COLORS.gray[500]} />}
          label={t('profile.editProfile')}
          onPress={handleEditProfile}
        />
        <SettingItem
          icon={<CreditCard size={20} color={COLORS.gray[500]} />}
          label={t('profile.subscription')}
          onPress={() => router.push('/billing')}
        />
        <SettingItem
          icon={<Shield size={20} color={COLORS.gray[500]} />}
          label={t('profile.security')}
          onPress={handleSecurity}
        />
        <SettingItem
          icon={<Globe size={20} color={COLORS.gray[500]} />}
          label={t('profile.organization')}
          value={user?.organization?.name}
          onPress={handleOrganization}
        />
        <SettingItem
          icon={<Link2 size={20} color={COLORS.gray[500]} />}
          label={t('profile.gstPortalIntegration')}
          onPress={() => router.push('/settings/integrations')}
        />
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.preferences')}</Text>

        <SettingItem
          icon={<Languages size={20} color={COLORS.gray[500]} />}
          label={t('profile.language')}
          value={isHindi ? t('profile.hindi') : t('profile.english')}
          onPress={handleLanguage}
        />

        {/* Route to the real notification preferences instead of a decorative,
            do-nothing local toggle (audit B6). */}
        <SettingItem
          icon={<Bell size={20} color={COLORS.gray[500]} />}
          label={t('profile.notificationSettings')}
          onPress={() => router.push('/settings/notifications')}
        />

        {/* Theme (TC-MOB-065). Three-way rather than a switch, so "follow the
            system" is a real choice and not the absence of one. The control
            sits on its own row: beside the label, three options ran past the
            right edge and clipped the last one. */}
        <View style={styles.themeBlock}>
          <View style={styles.themeHeader}>
            <Moon size={20} color={COLORS.gray[500]} />
            <Text style={styles.themeLabel}>{t('profile.appearance')}</Text>
          </View>

          <View style={styles.themeOptions}>
            {THEME_MODES.map((option) => {
              const active = themeMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.themeOption, active && styles.themeOptionActive]}
                  onPress={() => setThemeMode(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.themeOptionText, active && styles.themeOptionTextActive]}
                  >
                    {t(`profile.theme${option.value.charAt(0).toUpperCase()}${option.value.slice(1)}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {biometricAvailable && (
          <SettingToggle
            icon={<Fingerprint size={20} color={COLORS.gray[500]} />}
            label={t('profile.biometricLogin')}
            value={biometricEnabled}
            onToggle={handleBiometricToggle}
          />
        )}
      </View>

      {/* Privacy (TC-MOB-076). Default on: this app holds other people's tax
          filings, so the safe default is the private one — but blocking
          screenshots outright stops sharing a notice with a colleague, so it
          stays a choice. */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.privacy')}</Text>

        <SettingToggle
          icon={<EyeOff size={20} color={COLORS.gray[500]} />}
          label={t('profile.hideFromRecents')}
          value={screenProtection}
          onToggle={handleScreenProtection}
        />
        <Text style={styles.prefHint}>{t('profile.hideFromRecentsHint')}</Text>
      </View>

      {/* Storage Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.storage')}</Text>

        <View style={styles.storageInfo}>
          <Database size={20} color={COLORS.gray[500]} />
          <View style={styles.storageText}>
            <Text style={styles.storageLabel}>{t('profile.offlineQueue')}</Text>
            <Text style={styles.storageValue}>
              {queueTotal} pending {queueTotal === 1 ? 'action' : 'actions'}
            </Text>
          </View>
        </View>

        {/* Scans captured offline. Shown before downloads because unsent user
            work matters more than a re-downloadable copy (TC-MOB-058). */}
        {pendingUploads.length > 0 && (
          <>
            <View style={styles.storageInfo}>
              <CloudOff size={20} color={COLORS.warning} />
              <View style={styles.storageText}>
                <Text style={styles.storageLabel}>{t('profile.pendingUploads')}</Text>
                <Text style={styles.storageValue}>
                  {pendingSummary(pendingUploads)} · {formatBytes(pendingUploadBytes)}
                </Text>
              </View>
            </View>

            {countByStatus(pendingUploads).blocked > 0 && (
              <TouchableOpacity style={styles.clearCacheButton} onPress={handleRetryUploads}>
                <RefreshCw size={18} color={COLORS.primary} />
                <Text style={[styles.clearCacheText, { color: COLORS.primary }]}>
                  Retry Failed Uploads
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.clearCacheButton} onPress={handleDiscardUploads}>
              <Trash2 size={18} color={COLORS.error} />
              <Text style={styles.clearCacheText}>{t('profile.discardPendingUploads')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Downloaded documents are the only thing here that can grow without
            bound — notice PDFs are large, so show the real figure (TC-MOB-057). */}
        <View style={styles.storageInfo}>
          <HardDrive size={20} color={COLORS.gray[500]} />
          <View style={styles.storageText}>
            <Text style={styles.storageLabel}>{t('profile.offlineDocuments')}</Text>
            <Text style={styles.storageValue}>
              {documentCount} {documentCount === 1 ? 'file' : 'files'} ·{' '}
              {formatBytes(documentBytes)}
            </Text>
          </View>
        </View>

        {documentCount > 0 && (
          <TouchableOpacity
            style={styles.clearCacheButton}
            onPress={handleClearDocuments}
          >
            <Trash2 size={18} color={COLORS.error} />
            <Text style={styles.clearCacheText}>{t('profile.clearDownloads')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.clearCacheButton} onPress={handleClearCache}>
          <Trash2 size={18} color={COLORS.error} />
          <Text style={styles.clearCacheText}>{t('profile.clearCacheQueue')}</Text>
        </TouchableOpacity>

      </View>

      {/* Storage Section (continued) */}
      <View style={styles.section}>
        {/* What the app may store and sync without asking (TC-MOB-061). Both
            are honoured by the code that does the work, not just recorded. */}
        <SettingToggle
          icon={<HardDrive size={20} color={COLORS.gray[500]} />}
          label={t('profile.saveDocumentsOffline')}
          value={offlinePrefs.autoSaveDocuments}
          onToggle={(value) => handleOfflinePref('autoSaveDocuments', value)}
        />
        <Text style={styles.prefHint}>
          Keeps a copy of every document you open. Documents you save with the
          cloud icon are always kept.
        </Text>

        <SettingToggle
          icon={<Wifi size={20} color={COLORS.gray[500]} />}
          label={t('profile.syncOnWiFiOnly')}
          value={offlinePrefs.syncOnWifiOnly}
          onToggle={(value) => handleOfflinePref('syncOnWifiOnly', value)}
        />
        <Text style={styles.prefHint}>
          Holds queued uploads until you are on Wi-Fi.
        </Text>

        {/* Development builds only. The iOS Simulator has no airplane mode and
            dropping the host's Wi-Fi is not possible over a remote session, so
            without this the offline paths cannot be exercised at all. */}
        {__DEV__ && (
          <SettingToggle
            icon={<WifiOff size={20} color={COLORS.warning} />}
            label={t('profile.simulateOffline')}
            value={forcedOffline}
            onToggle={setForcedOffline}
          />
        )}
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.support')}</Text>

        <SettingItem
          icon={<LifeBuoy size={20} color={COLORS.gray[500]} />}
          label="Support Tickets"
          onPress={() => router.push('/support')}
        />
        <SettingItem
          icon={<HelpCircle size={20} color={COLORS.gray[500]} />}
          label={t('profile.helpCenter')}
          onPress={handleHelpCenter}
        />
        <SettingItem
          icon={<Info size={20} color={COLORS.gray[500]} />}
          label={t('profile.about')}
          value={formatVersion(getAppInfo())}
          onPress={() => router.push('/settings/about')}
        />
      </View>

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <Button
          title={t('profile.logout')}
          variant="danger"
          fullWidth
          onPress={handleLogout}
          icon={<LogOut size={18} color={COLORS.white} />}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>EffortlessInsight {formatVersion(getAppInfo())}</Text>
        <TouchableOpacity onPress={handlePrivacyPolicy}>
          <Text style={styles.footerLink}>{t('profile.privacyPolicy')}</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>•</Text>
        <TouchableOpacity onPress={handleTermsOfService}>
          <Text style={styles.footerLink}>{t('profile.termsOfService')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function SettingItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  return (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      {icon}
      <Text style={styles.settingLabel}>{label}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      <ChevronRight size={20} color={COLORS.gray[300]} />
    </TouchableOpacity>
  );
}

function SettingToggle({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  return (
    <View style={styles.settingItem}>
      {icon}
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.gray[300], true: COLORS.primaryLight }}
        thumbColor={value ? COLORS.primary : COLORS.gray[100]}
      />
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  userName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  userEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: SPACING.xs,
  },
  roleBadge: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  roleText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.primary,
  },
  section: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  settingValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginRight: SPACING.xs,
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  storageText: {
    flex: 1,
  },
  storageLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  storageValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  themeBlock: {
    // Matches `settingItem` so the icon lines up with every other row in the
    // section; without the horizontal padding it sat flush to the edge.
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  themeLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  themeOptions: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    padding: 3,
    gap: 3,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  themeOptionActive: {
    backgroundColor: COLORS.white,
  },
  themeOptionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  themeOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  prefHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    marginTop: -SPACING.xs,
  },
  clearCacheButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#fef2f2',
  },
  clearCacheText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.error,
  },
  logoutContainer: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.sm,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[400],
    width: '100%',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  footerLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  footerDot: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[300],
  },
});
