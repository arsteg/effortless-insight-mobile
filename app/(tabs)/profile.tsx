/**
 * Profile/Settings Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Bell,
  Shield,
  Fingerprint,
  Database,
  LogOut,
  ChevronRight,
  Moon,
  Globe,
  HelpCircle,
  Info,
  Trash2,
  ExternalLink,
  CreditCard,
  Link2,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuthStore, useOfflineStore } from '../../src/stores';
import { useTranslation } from '../../src/hooks';
import { Button, LoadingSpinner } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { Languages } from 'lucide-react-native';

export default function ProfileScreen() {
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
    Alert.alert(
      'Logout',
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
        Alert.alert('Error', 'Failed to enable biometric authentication');
      }
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. You will need to reload data when you go online.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllCache();
            await clearAllQueue();
            Alert.alert('Success', 'Cache cleared successfully');
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
    Alert.alert(
      'Organization',
      `You are currently logged in to: ${user?.organization?.name || 'Unknown Organization'}\n\nOrganization settings are available on the web app.`,
      [
        { text: 'OK' },
        {
          text: 'Open Web App',
          onPress: () => {
            Linking.openURL('https://app.effortlessinsight.com/settings/organization');
          },
        },
      ]
    );
  };

  const handleHelpCenter = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://help.effortlessinsight.com');
    } catch (error) {
      Alert.alert('Error', 'Could not open help center');
    }
  };

  const handleAbout = () => {
    Alert.alert(
      'About EffortlessInsight',
      `Version: 1.0.0\nBuild: Mobile App\n\nEffortlessInsight helps you manage GST notices efficiently with AI-powered analysis and collaborative workflows.\n\n© 2024 EffortlessInsight. All rights reserved.`,
      [
        { text: 'OK' },
        {
          text: 'Visit Website',
          onPress: () => Linking.openURL('https://effortlessinsight.com'),
        },
      ]
    );
  };

  const handlePrivacyPolicy = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://effortlessinsight.com/privacy');
    } catch (error) {
      Linking.openURL('https://effortlessinsight.com/privacy');
    }
  };

  const handleTermsOfService = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://effortlessinsight.com/terms');
    } catch (error) {
      Linking.openURL('https://effortlessinsight.com/terms');
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
        <Text style={styles.sectionTitle}>Account</Text>

        <SettingItem
          icon={<User size={20} color={COLORS.gray[500]} />}
          label="Edit Profile"
          onPress={handleEditProfile}
        />
        <SettingItem
          icon={<CreditCard size={20} color={COLORS.gray[500]} />}
          label="Subscription"
          onPress={() => router.push('/billing')}
        />
        <SettingItem
          icon={<Shield size={20} color={COLORS.gray[500]} />}
          label="Security"
          onPress={handleSecurity}
        />
        <SettingItem
          icon={<Globe size={20} color={COLORS.gray[500]} />}
          label="Organization"
          value={user?.organization?.name}
          onPress={handleOrganization}
        />
        <SettingItem
          icon={<Link2 size={20} color={COLORS.gray[500]} />}
          label="GST Portal Integration"
          onPress={() => router.push('/settings/integrations')}
        />
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{isHindi ? 'प्राथमिकताएं' : 'Preferences'}</Text>

        <SettingItem
          icon={<Languages size={20} color={COLORS.gray[500]} />}
          label={t('profile.language')}
          value={isHindi ? 'हिन्दी' : 'English'}
          onPress={handleLanguage}
        />

        {/* Route to the real notification preferences instead of a decorative,
            do-nothing local toggle (audit B6). */}
        <SettingItem
          icon={<Bell size={20} color={COLORS.gray[500]} />}
          label={isHindi ? 'सूचना सेटिंग्स' : 'Notification Settings'}
          onPress={() => router.push('/settings/notifications')}
        />

        {biometricAvailable && (
          <SettingToggle
            icon={<Fingerprint size={20} color={COLORS.gray[500]} />}
            label="Biometric Login"
            value={biometricEnabled}
            onToggle={handleBiometricToggle}
          />
        )}
      </View>

      {/* Storage Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage</Text>

        <View style={styles.storageInfo}>
          <Database size={20} color={COLORS.gray[500]} />
          <View style={styles.storageText}>
            <Text style={styles.storageLabel}>Offline Queue</Text>
            <Text style={styles.storageValue}>
              {queueTotal} pending {queueTotal === 1 ? 'action' : 'actions'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.clearCacheButton} onPress={handleClearCache}>
          <Trash2 size={18} color={COLORS.error} />
          <Text style={styles.clearCacheText}>Clear Cache & Queue</Text>
        </TouchableOpacity>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>

        <SettingItem
          icon={<HelpCircle size={20} color={COLORS.gray[500]} />}
          label="Help Center"
          onPress={handleHelpCenter}
        />
        <SettingItem
          icon={<Info size={20} color={COLORS.gray[500]} />}
          label="About"
          value="v1.0.0"
          onPress={handleAbout}
        />
      </View>

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <Button
          title="Logout"
          variant="danger"
          fullWidth
          onPress={handleLogout}
          icon={<LogOut size={18} color={COLORS.white} />}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>EffortlessInsight v1.0.0</Text>
        <TouchableOpacity onPress={handlePrivacyPolicy}>
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>•</Text>
        <TouchableOpacity onPress={handleTermsOfService}>
          <Text style={styles.footerLink}>Terms of Service</Text>
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

const styles = StyleSheet.create({
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
