/**
 * Login Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Fingerprint } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores';
import { Button, Input } from '../../src/components/common';
import { OAuthButtons } from '../../src/components/auth';
import { getApiErrorMessage } from '../../src/services/api';
import { setTokens, setUser } from '../../src/services/storage/secure';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    login,
    isLoading,
    requires2fa,
    biometricEnabled,
    biometricAvailable,
    authenticateWithBiometric,
  } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // Attempt biometric auth on mount
  useEffect(() => {
    if (biometricEnabled && biometricAvailable) {
      handleBiometricAuth();
    }
  }, [biometricEnabled, biometricAvailable]);

  // Handle 2FA redirect
  useEffect(() => {
    if (requires2fa) {
      router.push('/(auth)/two-factor');
    }
  }, [requires2fa]);

  const handleBiometricAuth = async () => {
    const success = await authenticateWithBiometric();
    if (success) {
      // Biometric auth successful, tokens already stored
      router.replace('/(tabs)');
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      await login(data.email, data.password, data.rememberMe);

      if (!requires2fa) {
        router.replace('/(tabs)');
      }
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
    }
  };

  // Handle OAuth success
  const handleOAuthSuccess = async (response: {
    accessToken: string;
    refreshToken: string;
    user: any;
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

      // Store tokens and user
      await setTokens(response.accessToken, response.refreshToken);
      await setUser(response.user);

      // Update auth store
      useAuthStore.setState({
        isAuthenticated: true,
        user: response.user,
        requires2fa: false,
        partialToken: null,
        needsOnboarding: !response.user?.organization?.id,
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo/Header */}
        <View style={styles.header}>
          <Text style={styles.title}>EffortlessInsight</Text>
          <Text style={styles.subtitle}>Welcome back! Please sign in to continue.</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Login Form */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                placeholder="Enter your email"
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
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Password"
                placeholder="Enter your password"
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
                  <Text style={styles.checkboxLabel}>Remember me</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotPassword}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <Button
            title="Sign In"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            fullWidth
            size="lg"
          />

          {/* Biometric Login */}
          {biometricAvailable && biometricEnabled && (
            <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricAuth}>
              <Fingerprint size={24} color={COLORS.primary} />
              <Text style={styles.biometricText}>Use Biometrics</Text>
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
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray[200],
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    color: COLORS.gray[400],
    fontSize: FONT_SIZES.sm,
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
