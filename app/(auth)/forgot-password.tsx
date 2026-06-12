/**
 * Forgot Password Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft } from 'lucide-react-native';
import { authApi, getApiErrorMessage } from '../../src/services/api';
import { Button, Input } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      await authApi.forgotPassword(data.email);
      setEmail(data.email);
      setSuccess(true);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Mail size={40} color={COLORS.white} />
        </View>
        <Text style={styles.successTitle}>Check Your Email</Text>
        <Text style={styles.successMessage}>
          We've sent a password reset link to{' '}
          <Text style={styles.emailHighlight}>{email}</Text>. Please check your inbox and follow
          the instructions to reset your password.
        </Text>
        <Button
          title="Back to Login"
          onPress={() => router.replace('/(auth)/login')}
          fullWidth
          size="lg"
        />
        <TouchableOpacity style={styles.resendLink} onPress={handleSubmit(onSubmit)}>
          <Text style={styles.resendText}>Didn't receive the email? Resend</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            No worries! Enter your email address and we'll send you a link to reset your password.
          </Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form */}
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

          <Button
            title="Send Reset Link"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            fullWidth
            size="lg"
          />
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Remember your password? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  backButton: {
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    lineHeight: 22,
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: SPACING.xl,
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
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
  emailHighlight: {
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  resendLink: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  resendText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
