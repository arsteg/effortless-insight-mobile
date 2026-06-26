/**
 * Verify Email Screen
 * Handles deep links from email verification emails
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, AlertCircle, Mail } from 'lucide-react-native';
import { authApi } from '../../src/services/api';
import { Button, LoadingSpinner } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES } from '../../src/utils/constants';

type ScreenState = 'loading' | 'success' | 'error' | 'expired';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setScreenState('error');
      setErrorMessage('Invalid verification link');
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    if (!token) return;

    try {
      await authApi.verifyEmail(token);
      setScreenState('success');
    } catch (error: any) {
      const message = error.response?.data?.message || '';
      if (message.toLowerCase().includes('expired')) {
        setScreenState('expired');
      } else if (message.toLowerCase().includes('already verified')) {
        setScreenState('success');
      } else {
        setScreenState('error');
        setErrorMessage(message || 'Failed to verify email');
      }
    }
  };

  const handleGoToLogin = () => {
    router.replace('/(auth)/login');
  };

  const handleResendVerification = async () => {
    setScreenState('loading');
    try {
      await authApi.resendVerificationEmail();
      setScreenState('success');
      setErrorMessage('A new verification email has been sent');
    } catch (error: any) {
      setScreenState('error');
      setErrorMessage(error.response?.data?.message || 'Failed to resend verification email');
    }
  };

  // Loading state
  if (screenState === 'loading') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <LoadingSpinner message="Verifying your email..." />
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
          <Text style={styles.title}>Email Verified!</Text>
          <Text style={styles.subtitle}>
            Your email has been successfully verified. You can now access all features of your account.
          </Text>
          <Button
            title="Continue to Login"
            onPress={handleGoToLogin}
            variant="primary"
            fullWidth
            style={styles.actionButton}
          />
        </View>
      </View>
    );
  }

  // Expired state
  if (screenState === 'expired') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={[styles.iconContainer, styles.warningIcon]}>
            <Mail size={48} color={COLORS.warning} />
          </View>
          <Text style={styles.title}>Link Expired</Text>
          <Text style={styles.subtitle}>
            This verification link has expired. Please request a new verification email.
          </Text>
          <Button
            title="Resend Verification Email"
            onPress={handleResendVerification}
            variant="primary"
            fullWidth
            style={styles.actionButton}
          />
          <Button
            title="Back to Login"
            onPress={handleGoToLogin}
            variant="outline"
            fullWidth
          />
        </View>
      </View>
    );
  }

  // Error state
  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <View style={[styles.iconContainer, styles.errorIcon]}>
          <AlertCircle size={48} color={COLORS.error} />
        </View>
        <Text style={styles.title}>Verification Failed</Text>
        <Text style={styles.subtitle}>
          {errorMessage || 'We could not verify your email. Please try again or request a new verification link.'}
        </Text>
        <Button
          title="Resend Verification Email"
          onPress={handleResendVerification}
          variant="primary"
          fullWidth
          style={styles.actionButton}
        />
        <Button
          title="Back to Login"
          onPress={handleGoToLogin}
          variant="outline"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
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
    paddingHorizontal: SPACING.md,
  },
  actionButton: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
});
