/**
 * Change Password Screen
 * Allows authenticated users to change their password
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Shield, CheckCircle } from 'lucide-react-native';
import { useUIStore } from '../../src/stores';
import { authApi } from '../../src/services/api';
import { Button, PasswordInput } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { showToast } = useUIStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

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

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (!allRequirementsMet) {
      newErrors.newPassword = 'Password does not meet requirements';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      showToast('success', 'Password changed successfully');
      router.back();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to change password';
      if (message.toLowerCase().includes('current password')) {
        setErrors({ currentPassword: 'Current password is incorrect' });
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    currentPassword && newPassword && confirmPassword && allRequirementsMet && newPassword === confirmPassword;

  return (
    <>
      <Stack.Screen options={{ title: 'Change Password' }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              <Shield size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.headerTitle}>Update Your Password</Text>
            <Text style={styles.headerSubtitle}>
              Choose a strong password that you haven't used before
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <PasswordInput
              label="Current Password"
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                if (errors.currentPassword) {
                  setErrors((prev) => ({ ...prev, currentPassword: undefined }));
                }
              }}
              placeholder="Enter your current password"
              error={errors.currentPassword}
            />

            <PasswordInput
              label="New Password"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (errors.newPassword) {
                  setErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
              placeholder="Enter your new password"
              error={errors.newPassword}
            />

            {/* Password Requirements */}
            {newPassword.length > 0 && (
              <View style={styles.requirements}>
                <Text style={styles.requirementsTitle}>Password Requirements</Text>
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
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) {
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              placeholder="Confirm your new password"
              error={errors.confirmPassword}
            />
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomContainer}>
          <Button
            title={isLoading ? 'Changing Password...' : 'Change Password'}
            onPress={handleChangePassword}
            disabled={!isFormValid || isLoading}
            variant="primary"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
  form: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.md,
    padding: SPACING.lg,
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
  bottomContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
});
