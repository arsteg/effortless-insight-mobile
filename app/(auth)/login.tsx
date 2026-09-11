/**
 * Login Screen
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Fingerprint, RefreshCw } from 'lucide-react-native';
import { useAuthStore, useUIStore } from '../../src/stores';
import { Button, Input } from '../../src/components/common';
import { OAuthButtons } from '../../src/components/auth';
import { getApiErrorMessage } from '../../src/services/api';
import { isNetworkError, NO_INTERNET_MESSAGE } from '../../src/services/api/client';
import { UserDto } from '../../src/types';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  // Server is the source of truth for password rules; on login we only
  // require a value (legacy accounts may predate current policy).
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  // Screens that bounce the user back here (e.g. an expired 2FA session) pass
  // the reason along so it isn't lost in the navigation.
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [error, setError] = useState<string | null>(notice ?? null);
  // Only connectivity failures get a Retry action — a wrong password is not
  // something to retry unchanged.
  const [canRetry, setCanRetry] = useState(false);

  const {
    login,
    isLoading,
    requires2fa,
    biometricEnabled,
    biometricAvailable,
    hasStoredSession,
    biometricPromptedAtLaunch,
    unlockWithBiometric,
    cancelBiometricPrompt,
    completeOAuthLogin,
    sessionNotice,
    clearSessionNotice,
  } = useAuthStore();

  // Set once the user has backed out of biometric on this screen, so the
  // control flips from "skip it" to "try it again".
  const [biometricDismissed, setBiometricDismissed] = useState(false);

  // Biometric unlocks a stored session; it is not a credential. Offering it
  // without one (e.g. after a logout, which the server revokes) produced a
  // prompt that succeeded and then left the user sitting on this screen.
  const canUseBiometric = biometricEnabled && biometricAvailable && hasStoredSession;

  // The auto-prompt must fire once per mount. Without this, dismissing it
  // re-ran the effect and immediately re-prompted, trapping the user.
  const autoPromptedRef = useRef(false);

  // `initialize()` already prompted during this launch; prompting again here
  // would land a second dialog on top of the user's cancel (TC-MOB-004).
  const shouldAutoPrompt = canUseBiometric && !biometricPromptedAtLaunch;

  const {
    control,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // An expired or revoked session lands here; say so instead of presenting a
  // blank sign-in form, then clear it so it doesn't reappear later.
  useEffect(() => {
    if (sessionNotice) {
      setError(sessionNotice);
      clearSessionNotice();
    }
  }, [sessionNotice]);

  // Attempt biometric auth on mount
  useEffect(() => {
    if (shouldAutoPrompt && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      handleBiometricAuth();
    }
  }, [shouldAutoPrompt]);

  // Handle 2FA redirect
  useEffect(() => {
    if (requires2fa) {
      router.push('/(auth)/two-factor');
    }
  }, [requires2fa]);

  const handleBiometricAuth = async () => {
    // Unlock actually restores the session from stored tokens (audit B4).
    // If there is no stored session (e.g. after a real logout), biometric can't
    // help — the user signs in with a password instead.
    setError(null);
    const outcome = await unlockWithBiometric();

    if (outcome === 'success') {
      router.replace('/(tabs)');
      return;
    }

    // Any non-success lands the user on the password form.
    setBiometricDismissed(true);

    // A deliberate cancel is not an error — show nothing and let them type.
    if (outcome === 'cancelled' || outcome === 'unavailable') return;

    setError(
      outcome === 'no-session'
        ? 'Your session has expired. Please sign in with your password to re-enable biometric login.'
        : 'Biometric authentication failed. Please sign in with your password.'
    );
  };

  // "Use Password Instead": dismiss the prompt (Android) and stop re-offering it.
  const handleUsePassword = async () => {
    autoPromptedRef.current = true;
    setBiometricDismissed(true);
    setError(null);
    await cancelBiometricPrompt();
  };

  const onSubmit = async (data: LoginFormData) => {
    // Fail fast instead of making the user wait out the 30s request timeout.
    if (!useUIStore.getState().isOnline) {
      setError(NO_INTERNET_MESSAGE);
      setCanRetry(true);
      return;
    }

    try {
      setError(null);
      setCanRetry(false);
      await login(data.email, data.password, data.rememberMe);

      // `requires2fa` from the render closure is stale here — read the store's
      // post-login state, or this navigates to the tabs even when a 2FA step
      // is pending (the 2FA effect then races it).
      if (!useAuthStore.getState().requires2fa) {
        router.replace('/(tabs)');
      }
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);

      // A request that never reached the server says nothing about the
      // credentials, so keep them and offer a retry. Clearing the password
      // here would force a retype for every dropped connection.
      if (isNetworkError(err)) {
        setCanRetry(true);
        return;
      }

      // The server rejected the credentials: never leave a rejected password
      // sitting in the field. `resetField` (not setValue) also clears its
      // dirty/touched/error state, so the next attempt starts from a clean
      // field. Email is left intact so the user only has to retype the
      // password.
      setCanRetry(false);
      resetField('password');
      setFocus('password');
    }
  };

  // Handle OAuth success
  const handleOAuthSuccess = async (response: {
    accessToken: string;
    refreshToken: string;
    user?: UserDto;
    requires2fa?: boolean;
    partialToken?: string;
  }) => {
    try {
      setError(null);

      // Check if 2FA is required
      if (response.requires2fa && response.partialToken) {
        // Store partial token and navigate to 2FA screen
        useAuthStore.setState({
          requires2fa: true,
          partialToken: response.partialToken,
        });
        router.push('/(auth)/two-factor');
        return;
      }

      // The store owns token persistence, profile mapping and session state.
      await completeOAuthLogin({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
      });

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
    }
  };

  // Handle OAuth error
  const handleOAuthError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo/Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.effortlessinsight')}</Text>
          <Text style={styles.subtitle}>{t('auth.welcomeBackPleaseSignInToContinue')}</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            {canRetry && (
              <TouchableOpacity style={styles.retryButton} onPress={handleSubmit(onSubmit)}>
                <RefreshCw size={16} color={COLORS.error} />
                <Text style={styles.retryText}>{t('auth.retry')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Login Form */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.email')}
                placeholder={t('auth.enterYourEmail')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Mail size={20} color={COLORS.gray[500]} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <Input
                // Wiring the field ref is what makes `setFocus('password')`
                // work after a failed sign-in; without it RHF has no element
                // to focus and silently does nothing.
                ref={ref}
                label={t('auth.password')}
                placeholder={t('auth.enterYourPassword')}
                secureTextEntry
                leftIcon={<Lock size={20} color={COLORS.gray[500]} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />

          {/* Remember Me & Forgot Password */}
          <View style={styles.options}>
            <Controller
              control={control}
              name="rememberMe"
              render={({ field: { onChange, value } }) => (
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => onChange(!value)}
                >
                  <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                    {value && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>{t('auth.rememberMe')}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotPassword}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <Button
            title={t('auth.signIn')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            fullWidth
            size="lg"
          />

          {/* Biometric Login */}
          {canUseBiometric && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={biometricDismissed ? handleBiometricAuth : handleUsePassword}
            >
              {biometricDismissed ? (
                <>
                  <Fingerprint size={24} color={COLORS.primary} />
                  <Text style={styles.biometricText}>{t('auth.useBiometrics')}</Text>
                </>
              ) : (
                <Text style={styles.biometricText}>{t('auth.usePasswordInstead')}</Text>
              )}
            </TouchableOpacity>
          )}

          {/* OAuth Buttons */}
          <OAuthButtons
            mode="login"
            disabled={isLoading}
            onSuccess={handleOAuthSuccess}
            onError={handleOAuthError}
          />

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>{t('auth.donTHaveAnAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLink}>{t('auth.signUp')}</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  header: {
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  retryText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  form: {
    flex: 1,
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: 4,
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
  },
  forgotPassword: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  biometricText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  registerText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  registerLink: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
