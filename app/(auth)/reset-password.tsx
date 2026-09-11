/**
 * Reset Password Screen
 * Handles deep links from password reset emails
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { KeyRound, CheckCircle, AlertCircle } from 'lucide-react-native';
import { authApi } from '../../src/services/api';
import { Button, PasswordInput, LoadingSpinner } from '../../src/components/common';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';

type ScreenState = 'form' | 'success' | 'error' | 'expired';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;

  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    if (!token) {
      setScreenState('error');
    }
  }, [token]);

  const passwordRequirements = [
    { text: 'At least 8 characters', met: newPassword.length >= 8 },
    { text: 'One uppercase letter', met: /[A-Z]/.test(newPassword) },
    { text: 'One lowercase letter', met: /[a-z]/.test(newPassword) },
    { text: 'One number', met: /\d/.test(newPassword) },
    { text: 'One special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
  ];

  const allRequirementsMet = passwordRequirements.every((req) => req.met);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (!allRequirementsMet) {
      newErrors.newPassword = 'Password does not meet requirements';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validate() || !token) return;

    setIsLoading(true);
    try {
      await authApi.resetPassword({
        token,
        password: newPassword,
        confirmPassword,
      });
      setScreenState('success');
    } catch (error: any) {
      const message = error.response?.data?.message || '';
      if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('invalid')) {
        setScreenState('expired');
      } else {
        Alert.alert('Error', message || 'Failed to reset password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    router.replace('/(auth)/login');
  };

  const handleRequestNewLink = () => {
    router.replace('/(auth)/forgot-password');
  };

  const isFormValid = newPassword && confirmPassword && allRequirementsMet && newPassword === confirmPassword;

  // Error state - no token
  if (screenState === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={[styles.iconContainer, styles.errorIcon]}>
            <AlertCircle size={48} color={COLORS.error} />
          </View>
          <Text style={styles.title}>{t('auth.invalidResetLink')}</Text>
          <Text style={styles.subtitle}>
            This password reset link is invalid or malformed. Please request a new one.
          </Text>
          <Button
            title={t('auth.requestNewLink')}
            onPress={handleRequestNewLink}
            variant="primary"
            fullWidth
            style={styles.actionButton}
          />
          <Button
            title={t('auth.backToLogin')}
            onPress={handleGoToLogin}
            variant="outline"
            fullWidth
          />
        </View>
      </View>
    );
  }

  // Expired token state
  if (screenState === 'expired') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={[styles.iconContainer, styles.warningIcon]}>
            <AlertCircle size={48} color={COLORS.warning} />
          </View>
          <Text style={styles.title}>{t('auth.linkExpired')}</Text>
          <Text style={styles.subtitle}>
            This password reset link has expired. Please request a new one.
          </Text>
          <Button
            title={t('auth.requestNewLink')}
            onPress={handleRequestNewLink}
            variant="primary"
            fullWidth
            style={styles.actionButton}
          />
          <Button
            title={t('auth.backToLogin')}
            onPress={handleGoToLogin}
            variant="outline"
            fullWidth
          />
        </View>
      </View>
    );
  }

  // Success state
  if (screenState === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={[styles.iconContainer, styles.successIcon]}>
            <CheckCircle size={48} color={COLORS.success} />
          </View>
          <Text style={styles.title}>{t('auth.passwordReset')}</Text>
          <Text style={styles.subtitle}>
            Your password has been successfully reset. You can now log in with your new password.
          </Text>
          <Button
            title={t('auth.goToLogin')}
            onPress={handleGoToLogin}
            variant="primary"
            fullWidth
            style={styles.actionButton}
          />
        </View>
      </View>
    );
  }

  // Form state
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <KeyRound size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{t('auth.createNewPassword')}</Text>
          <Text style={styles.subtitle}>
            Enter a strong password for your account
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <PasswordInput
            label={t('auth.newPassword')}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              if (errors.newPassword) {
                setErrors((prev) => ({ ...prev, newPassword: undefined }));
              }
            }}
            placeholder={t('auth.enterYourNewPassword')}
            error={errors.newPassword}
          />

          {/* Password Requirements */}
          {newPassword.length > 0 && (
            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>{t('auth.passwordRequirements')}</Text>
              {passwordRequirements.map((req, index) => (
                <View key={index} style={styles.requirementRow}>
                  <CheckCircle
                    size={16}
                    color={req.met ? COLORS.success : COLORS.gray[300]}
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      req.met && styles.requirementMet,
                    ]}
                  >
                    {req.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <PasswordInput
            label={t('auth.confirmPassword')}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            placeholder={t('auth.confirmYourNewPassword')}
            error={errors.confirmPassword}
          />

          <Button
            title={isLoading ? 'Resetting Password...' : 'Reset Password'}
            onPress={handleResetPassword}
            disabled={!isFormValid || isLoading}
            variant="primary"
            fullWidth
            style={styles.submitButton}
          />

          <Button
            title={t('auth.backToLogin')}
            onPress={handleGoToLogin}
            variant="ghost"
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  successIcon: {
    backgroundColor: '#dcfce7',
  },
  errorIcon: {
    backgroundColor: '#fef2f2',
  },
  warningIcon: {
    backgroundColor: '#fef3c7',
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: SPACING.lg,
  },
  requirements: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  requirementsTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  requirementText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  requirementMet: {
    color: COLORS.success,
  },
  submitButton: {
    marginTop: SPACING.md,
  },
  actionButton: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
});
