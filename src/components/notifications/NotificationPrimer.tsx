/**
 * Explains what notifications are for, before the OS prompt (TC-MOB-050).
 *
 * Deliberately shown ahead of the system dialog rather than instead of it: the
 * OS prompt still decides, but the user meets it knowing what they are being
 * asked. "Not now" leaves the permission untouched and askable, which the bare
 * system dialog does not — a refusal there is permanent.
 */

import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Bell, Clock, FileText, MessageSquare } from 'lucide-react-native';
import { PRIMER_REASONS } from '../../utils/notificationPriming';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';
import { useTranslation } from '../../hooks';

interface NotificationPrimerProps {
  visible: boolean;
  /** Proceed to the OS prompt. */
  onEnable: () => void;
  /** Dismiss without asking, leaving the permission askable later. */
  onDismiss: () => void;
  busy?: boolean;
}

const REASON_ICONS = [Clock, FileText, MessageSquare];

export function NotificationPrimer({
  visible,
  onEnable,
  onDismiss,
  busy = false,
}: NotificationPrimerProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconCircle}>
            <Bell size={26} color={COLORS.primary} />
          </View>

          <Text style={styles.title}>{t('components.stayAheadOfDeadlines')}</Text>
          <Text style={styles.subtitle}>
            GST deadlines are unforgiving. Turn on notifications and we will tell you
            what needs attention, before it is late.
          </Text>

          <View style={styles.reasons}>
            {PRIMER_REASONS.map((reason, index) => {
              const Icon = REASON_ICONS[index] ?? Clock;
              return (
                <View key={reason.title} style={styles.reason}>
                  <Icon size={18} color={COLORS.primary} />
                  <View style={styles.reasonText}>
                    <Text style={styles.reasonTitle}>{reason.title}</Text>
                    <Text style={styles.reasonDetail}>{reason.detail}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.enableButton, busy && styles.enableButtonBusy]}
            onPress={onEnable}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.enableText}>
              {busy ? 'Setting up...' : 'Turn on notifications'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>{t('components.notNow')}</Text>
          </TouchableOpacity>

          <Text style={styles.footnote}>
            You can change this any time in Notification Settings.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
    textAlign: 'center',
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  reasons: {
    gap: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  reasonText: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  reasonDetail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  enableButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  enableButtonBusy: {
    opacity: 0.7,
  },
  enableText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.white,
  },
  dismissButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  footnote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    textAlign: 'center',
  },
});
