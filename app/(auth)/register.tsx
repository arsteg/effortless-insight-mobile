/**
 * Register Screen
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { Mail, Lock, User, Phone, ShieldCheck } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores';
import { authApi, getApiErrorMessage, getApiErrorCode } from '../../src/services/api';
import { Button, Input } from '../../src/components/common';
import { OAuthButtons } from '../../src/components/auth';
import { UserDto } from '../../src/types';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    mobile: z
      .string()
      .min(1, 'Mobile number is required')
      .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
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
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Mobile OTP verification state — the backend rejects signups without a
  // verification token; editing the mobile number resets the flow.
  const [otpState, setOtpState] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [otpValue, setOtpValue] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const otpMobileRef = useRef<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    setError: setFieldError,
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

  const watchedMobile = watch('mobile');

  // Reset verification when the mobile number changes after send/verify
  useEffect(() => {
    if (otpState !== 'idle' && watchedMobile !== otpMobileRef.current) {
      setOtpState('idle');
      setOtpValue('');
      setOtpError(null);
      setOtpInfo(null);
      setResendIn(0);
      setVerificationToken(null);
      otpMobileRef.current = null;
    }
  }, [watchedMobile, otpState]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleSendOtp = async () => {
    setOtpError(null);
    setOtpInfo(null);
    const mobile = getValues('mobile');
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setFieldError('mobile', {
        type: 'manual',
        message: 'Please enter a valid 10-digit Indian mobile number',
      });
      return;
    }

    setOtpSending(true);
    try {
      const result = await authApi.requestSignupOtp(mobile);
      otpMobileRef.current = mobile;
      setOtpState('sent');
      setOtpValue('');
      setResendIn(result.retryAfter || 60);
      setOtpInfo(`OTP sent to ${result.maskedMobile}`);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'MOBILE_EXISTS') {
        setFieldError('mobile', {
          type: 'manual',
          message: 'This mobile number is already registered. Try signing in instead.',
        });
      } else {
        setOtpError(getApiErrorMessage(err));
      }
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length < 4) {
      setOtpError('Please enter the OTP sent to your mobile');
      return;
    }
    setOtpError(null);
    setOtpVerifying(true);
    try {
      const result = await authApi.verifySignupOtp(otpMobileRef.current ?? '', otpValue, {
        name: getValues('name'),
        email: getValues('email'),
      });
      setVerificationToken(result.verificationToken);
      setOtpState('verified');
      setOtpInfo(null);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'MAX_ATTEMPTS_EXCEEDED') {
        setOtpError('Too many incorrect attempts. Please request a new OTP.');
        setOtpValue('');
      } else {
        setOtpError('Incorrect OTP. Please check and try again.');
      }
    } finally {
      setOtpVerifying(false);
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    if (otpState !== 'verified' || !verificationToken) {
      setFieldError('mobile', {
        type: 'manual',
        message: 'Please verify your mobile number with OTP first',
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        mobile: data.mobile,
        acceptTerms: data.acceptTerms,
        mobileVerificationToken: verificationToken,
      });

      setSuccess(true);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'MOBILE_NOT_VERIFIED' || code === 'MOBILE_REQUIRED') {
        // Verification token expired or was consumed — restart the OTP flow
        setOtpState('idle');
        setOtpValue('');
        setResendIn(0);
        setVerificationToken(null);
        otpMobileRef.current = null;
        setFieldError('mobile', {
          type: 'manual',
          message: 'Mobile verification expired. Please verify your number again.',
        });
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OAuth success (also works for registration via OAuth)
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
        useAuthStore.setState({
          requires2fa: true,
          partialToken: response.partialToken,
        });
        router.push('/(auth)/two-factor');
        return;
      }

      // The store owns token persistence, profile mapping and session state.
      await useAuthStore.getState().completeOAuthLogin({
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

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.successTitle}>{t('auth.registrationSuccessful')}</Text>
        <Text style={styles.successMessage}>
          We've sent a verification email to your address. Please check your inbox and click the
          link to activate your account.
        </Text>
        <Button
          title={t('auth.goToLogin')}
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.createAccount')}</Text>
          <Text style={styles.subtitle}>{t('auth.joinEffortlessinsightToManageYourComplia')}</Text>
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
                label={t('auth.fullName')}
                placeholder={t('auth.enterYourFullName')}
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
            name="mobile"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Mobile Number"
                placeholder={t('auth.enterYourMobileNumber')}
                keyboardType="phone-pad"
                maxLength={10}
                leftIcon={
                  <View style={styles.mobilePrefix}>
                    <Phone size={20} color={COLORS.gray[500]} />
                    <Text style={styles.mobilePrefixText}>+91</Text>
                  </View>
                }
                value={value}
                onChangeText={(text) => {
                  // Keep only the 10-digit subscriber number. Strip non-digits
                  // and a country-code prefix users often add (91 / 0) so
                  // "+91 93113…" or "091…" normalise to the bare 10 digits the
                  // backend expects (the +91 is shown, never typed).
                  let digits = text.replace(/\D/g, '');
                  if (digits.length > 10 && digits.startsWith('91')) {
                    digits = digits.slice(2);
                  }
                  if (digits.length > 10 && digits.startsWith('0')) {
                    digits = digits.slice(1);
                  }
                  onChange(digits.slice(0, 10));
                }}
                onBlur={onBlur}
                error={errors.mobile?.message}
              />
            )}
          />

          {/* Mobile OTP verification */}
          {otpState === 'verified' ? (
            <View style={styles.otpVerifiedRow}>
              <ShieldCheck size={16} color={COLORS.success} />
              <Text style={styles.otpVerifiedText}>Mobile number verified</Text>
            </View>
          ) : (
            <View style={styles.otpContainer}>
              <Button
                title={
                  resendIn > 0
                    ? `Resend OTP in ${resendIn}s`
                    : otpState === 'sent'
                      ? 'Resend OTP'
                      : 'Send OTP'
                }
                onPress={handleSendOtp}
                loading={otpSending}
                disabled={isLoading || otpSending || resendIn > 0}
                variant="outline"
                fullWidth
              />
              {otpState === 'sent' && (
                <View style={styles.otpVerifyBlock}>
                  {otpInfo && <Text style={styles.otpInfoText}>{otpInfo}</Text>}
                  <Input
                    label="OTP"
                    placeholder="Enter the 6-digit OTP"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpValue}
                    onChangeText={(text) => setOtpValue(text.replace(/\D/g, ''))}
                  />
                  <Button
                    title="Verify OTP"
                    onPress={handleVerifyOtp}
                    loading={otpVerifying}
                    disabled={isLoading || otpVerifying || otpValue.length < 4}
                    fullWidth
                  />
                </View>
              )}
              {otpError && <Text style={styles.otpErrorText}>{otpError}</Text>}
            </View>
          )}

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.password')}
                placeholder={t('auth.createAPassword')}
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
                label={t('auth.confirmPassword')}
                placeholder={t('auth.confirmYourPassword')}
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
                      onPress={() => Linking.openURL('https://effortlessinsight.in/terms')}
                    >
                      Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text
                      style={styles.termsLink}
                      onPress={() => Linking.openURL('https://effortlessinsight.in/privacy')}
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
            title={otpState !== 'verified' ? 'Verify mobile to continue' : t('auth.createAccount')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            disabled={otpState !== 'verified'}
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
            <Text style={styles.loginText}>{t('auth.alreadyHaveAnAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>{t('auth.signIn')}</Text>
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
  mobilePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  mobilePrefixText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[700],
    fontWeight: '500',
  },
  otpContainer: {
    marginBottom: SPACING.md,
  },
  otpVerifyBlock: {
    marginTop: SPACING.sm,
  },
  otpInfoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.xs,
  },
  otpErrorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  otpVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  otpVerifiedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: '600',
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
