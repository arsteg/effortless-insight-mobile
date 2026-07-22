/**
 * Register Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, Phone } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores';
import { authApi, getApiErrorMessage } from '../../src/services/api';
import { Button, Input } from '../../src/components/common';
import { OAuthButtons } from '../../src/components/auth';
import { setTokens, setUser } from '../../src/services/storage/secure';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    mobile: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      // Match the change/reset-password policy so a registered password is
      // always valid to re-use later (audit B13).
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
    acceptTerms: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.acceptTerms === true, {
    message: 'You must accept the terms and conditions',
    path: ['acceptTerms'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        mobile: data.mobile || undefined,
        acceptTerms: data.acceptTerms,
      });

      setSuccess(true);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OAuth success (also works for registration via OAuth)
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

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Registration Successful!</Text>
        <Text style={styles.successMessage}>
          We've sent a verification email to your address. Please check your inbox and click the
          link to activate your account.
        </Text>
        <Button
          title="Go to Login"
          onPress={() => router.replace('/(auth)/login')}
          fullWidth
          size="lg"
        />
      </View>
    );
  }

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join EffortlessInsight to manage your compliance</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Register Form */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                autoCapitalize="words"
                leftIcon={<User size={20} color={COLORS.gray[500]} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
              />
            )}
          />

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
            name="mobile"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Mobile Number (Optional)"
                placeholder="Enter your mobile number"
                keyboardType="phone-pad"
                leftIcon={<Phone size={20} color={COLORS.gray[500]} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.mobile?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Password"
                placeholder="Create a password"
                secureTextEntry
                leftIcon={<Lock size={20} color={COLORS.gray[500]} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                helperText="Min 8 characters with uppercase, lowercase, and number"
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Confirm Password"
                placeholder="Confirm your password"
                secureTextEntry
                leftIcon={<Lock size={20} color={COLORS.gray[500]} />}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          {/* Terms Checkbox */}
          <Controller
            control={control}
            name="acceptTerms"
            render={({ field: { onChange, value } }) => (
              <View style={styles.termsContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => onChange(!value)}
                >
                  <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                    {value && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the{' '}
                    <Text
                      style={styles.termsLink}
                      onPress={() => Linking.openURL('https://effortlessinsight.com/terms')}
                    >
                      Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text
                      style={styles.termsLink}
                      onPress={() => Linking.openURL('https://effortlessinsight.com/privacy')}
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>
                {errors.acceptTerms && (
                  <Text style={styles.termsError}>{errors.acceptTerms.message}</Text>
                )}
              </View>
            )}
          />

          {/* Register Button */}
          <Button
            title="Create Account"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            fullWidth
            size="lg"
          />

          {/* OAuth Buttons */}
          <OAuthButtons
            mode="register"
            disabled={isLoading}
            onSuccess={handleOAuthSuccess}
            onError={handleOAuthError}
          />

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
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
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
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
  termsContainer: {
    marginBottom: SPACING.lg,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
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
  termsText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    lineHeight: 20,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  termsError: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
    marginLeft: 28,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  loginText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  loginLink: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  successIconText: {
    color: COLORS.white,
    fontSize: 40,
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
});
