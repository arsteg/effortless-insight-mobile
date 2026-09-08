/**
 * About screen (TC-MOB-069).
 *
 * Replaces an Alert. The alert could show text but not links, which is why
 * Terms and Privacy ended up as small footer text at the bottom of the Profile
 * screen instead — findable only by scrolling past everything else.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Info,
  Shield,
  FileText,
  Mail,
  Globe,
  ChevronRight,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/stores';
import { useTranslation } from '../../src/hooks';
import {
  getAppInfo,
  buildSupportEmailBody,
  copyrightLine,
  SUPPORT_EMAIL,
} from '../../src/utils/appInfo';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';

const WEBSITE_URL = 'https://effortlessinsight.in';
const PRIVACY_URL = 'https://effortlessinsight.in/privacy';
const TERMS_URL = 'https://effortlessinsight.in/terms';

export default function AboutScreen() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  const info = getAppInfo();

  const openUrl = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      // The in-app browser can fail on some devices; the system one still works.
      await Linking.openURL(url).catch(() => {
        Alert.alert(t('about.couldNotOpen'), url);
      });
    }
  };

  /**
   * Compose a support email with the diagnostics already in the body, so a
   * report arrives with the version and platform attached rather than needing
   * a round trip to ask.
   */
  const contactSupport = async () => {
    const subject = `EffortlessInsight support — v${info.version} (${info.build})`;
    const body = buildSupportEmailBody(info, user?.email);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    const opened = await Linking.openURL(url).then(
      () => true,
      () => false
    );

    if (!opened) {
      // No mail app configured — give them the address rather than nothing.
      Alert.alert(t('about.contactSupport'), SUPPORT_EMAIL);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('about.title') }} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Info size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>EffortlessInsight</Text>
          <Text style={styles.tagline}>{t('about.tagline')}</Text>
        </View>

        {/* Version and build, read from the config rather than hardcoded. */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('about.version')}</Text>
            <Text style={styles.infoValue}>{info.version}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('about.build')}</Text>
            <Text style={styles.infoValue}>{info.build}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <LinkRow
            icon={<Mail size={20} color={COLORS.primary} />}
            label={t('about.contactSupport')}
            detail={SUPPORT_EMAIL}
            onPress={contactSupport}
            styles={styles}
            colors={COLORS}
          />
          <View style={styles.divider} />
          <LinkRow
            icon={<Shield size={20} color={COLORS.gray[500]} />}
            label={t('about.privacyPolicy')}
            onPress={() => openUrl(PRIVACY_URL)}
            styles={styles}
            colors={COLORS}
          />
          <View style={styles.divider} />
          <LinkRow
            icon={<FileText size={20} color={COLORS.gray[500]} />}
            label={t('about.termsOfService')}
            onPress={() => openUrl(TERMS_URL)}
            styles={styles}
            colors={COLORS}
          />
          <View style={styles.divider} />
          <LinkRow
            icon={<Globe size={20} color={COLORS.gray[500]} />}
            label={t('about.website')}
            onPress={() => openUrl(WEBSITE_URL)}
            styles={styles}
            colors={COLORS}
          />
        </View>

        <Text style={styles.copyright}>{copyrightLine()}</Text>
      </ScrollView>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  detail,
  onPress,
  styles,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: Palette;
}) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress} accessibilityRole="button">
      {icon}
      <View style={styles.linkText}>
        <Text style={styles.linkLabel}>{label}</Text>
        {detail && <Text style={styles.linkDetail}>{detail}</Text>}
      </View>
      <ChevronRight size={18} color={colors.gray[300]} />
    </TouchableOpacity>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.gray[50],
    },
    scroll: {
      padding: SPACING.md,
      paddingBottom: SPACING.xxl,
    },
    header: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: COLORS.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    appName: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '700',
      color: COLORS.gray[900],
    },
    tagline: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[500],
      textAlign: 'center',
      marginTop: SPACING.xs,
      paddingHorizontal: SPACING.lg,
    },
    card: {
      backgroundColor: COLORS.white,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.md,
      paddingHorizontal: SPACING.md,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
    },
    infoLabel: {
      fontSize: FONT_SIZES.md,
      color: COLORS.gray[600],
    },
    infoValue: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: COLORS.gray[900],
    },
    divider: {
      height: 1,
      backgroundColor: COLORS.gray[100],
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
    },
    linkText: {
      flex: 1,
    },
    linkLabel: {
      fontSize: FONT_SIZES.md,
      color: COLORS.gray[900],
    },
    linkDetail: {
      fontSize: FONT_SIZES.sm,
      color: COLORS.gray[500],
      marginTop: 2,
    },
    copyright: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.gray[400],
      textAlign: 'center',
      marginTop: SPACING.md,
    },
  });
