/**
 * PaywallModal Component
 * Upgrade prompt when limit reached
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { AlertTriangle, X, ArrowUpRight } from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { PaywallState } from '../../types';
import { Button } from '../common';

interface PaywallModalProps {
  visible: boolean;
  paywall: PaywallState | null;
  onClose: () => void;
  onUpgrade: () => void;
}

export function PaywallModal({ visible, paywall, onClose, onUpgrade }: PaywallModalProps) {
  if (!paywall) return null;

  const getActionLabel = () => {
    switch (paywall.action) {
      case 'create_notice':
        return 'notices';
      case 'add_user':
        return 'team members';
      case 'upload_file':
        return 'storage';
      case 'ai_analysis':
        return 'AI analyses';
      default:
        return 'this feature';
    }
  };

  const getTitle = () => {
    switch (paywall.action) {
      case 'create_notice':
        return 'Notice Limit Reached';
      case 'add_user':
        return 'Team Member Limit Reached';
      case 'upload_file':
        return 'Storage Limit Reached';
      case 'ai_analysis':
        return 'AI Analysis Limit Reached';
      default:
        return 'Limit Reached';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              {/* Close Button */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={24} color={COLORS.gray[400]} />
              </TouchableOpacity>

              {/* Icon */}
              <View style={styles.iconContainer}>
                <AlertTriangle size={32} color={COLORS.warning} />
              </View>

              {/* Title */}
              <Text style={styles.title}>{getTitle()}</Text>

              {/* Message */}
              <Text style={styles.message}>{paywall.message}</Text>

              {/* Usage Info */}
              {paywall.limit !== null && (
                <View style={styles.usageContainer}>
                  <View style={styles.usageBar}>
                    <View style={[styles.usageProgress, { width: '100%' }]} />
                  </View>
                  <Text style={styles.usageText}>
                    {paywall.currentUsage} / {paywall.limit} {getActionLabel()} used
                  </Text>
                </View>
              )}

              {/* Upgrade Prompt */}
              <View style={styles.upgradeContainer}>
                <Text style={styles.upgradeTitle}>Upgrade to unlock more</Text>
                <Text style={styles.upgradeDescription}>
                  {paywall.suggestedPlan
                    ? `The ${paywall.suggestedPlan} plan includes higher limits for ${getActionLabel()}.`
                    : `Upgrade your plan to get more ${getActionLabel()}.`}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <Button
                  title="View Plans"
                  onPress={onUpgrade}
                  variant="primary"
                  fullWidth
                  icon={<ArrowUpRight size={18} color={COLORS.white} />}
                  iconPosition="right"
                />
                <TouchableOpacity style={styles.dismissButton} onPress={onClose}>
                  <Text style={styles.dismissButtonText}>Maybe Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    padding: SPACING.xs,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
    textAlign: 'center',
    lineHeight: 22,
  },
  usageContainer: {
    width: '100%',
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  usageBar: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  usageProgress: {
    height: '100%',
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.full,
  },
  usageText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: SPACING.sm,
  },
  upgradeContainer: {
    width: '100%',
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  upgradeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  upgradeDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primaryDark,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  dismissButton: {
    padding: SPACING.sm,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
});
