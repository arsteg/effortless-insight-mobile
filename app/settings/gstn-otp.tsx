/**
 * GSTN OTP Verification Screen
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { KeyRound, RefreshCw, CheckCircle, Clock } from 'lucide-react-native';

import { useVerifyOtp, useResendOtp } from '../../src/hooks/useGstn';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

// OTP expires in 5 minutes (300 seconds)
const OTP_EXPIRY_SECONDS = 300;

/**
 * Format seconds to MM:SS display
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function GstnOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gstinId: string;
    gstin: string;
    destination: string;
  }>();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(OTP_EXPIRY_SECONDS);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isVerifyingRef = useRef(false);

  const verifyOtp = useVerifyOtp();
  const resendOtp = useResendOtp();

  // Focus input on mount and reset state
  useEffect(() => {
    setOtp('');
    setError(null);
    setRemainingAttempts(null);
    setResendCooldown(0);
    setOtpExpiry(OTP_EXPIRY_SECONDS);
    setIsSuccess(false);
    isVerifyingRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // OTP expiry countdown timer
  useEffect(() => {
    if (otpExpiry <= 0 || isSuccess) return;

    const timer = setTimeout(() => {
      setOtpExpiry((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [otpExpiry, isSuccess]);

  // Resend cooldown timer with proper cleanup
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const isOtpExpired = otpExpiry <= 0;

  const handleOtpChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);
    setError(null);
  };

  const handleVerify = async () => {
    // Prevent race condition from multiple taps
    if (isVerifyingRef.current) return;
    if (!params.gstinId || otp.length !== 6 || isOtpExpired) return;

    isVerifyingRef.current = true;
    setError(null);
    try {
      const result = await verifyOtp.mutateAsync({
        gstinId: params.gstinId,
        otp,
      });

      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        setError(result.errorMessage || 'Verification failed');
        if (result.remainingAttempts !== undefined) {
          setRemainingAttempts(result.remainingAttempts);
        }
      }
    } catch {
      // Error handled by hook
    } finally {
      isVerifyingRef.current = false;
    }
  };

  const handleResend = async () => {
    if (!params.gstinId || resendCooldown > 0) return;

    try {
      await resendOtp.mutateAsync(params.gstinId);
      setResendCooldown(60);
      setOtpExpiry(OTP_EXPIRY_SECONDS); // Reset OTP expiry
      setOtp('');
      setError(null);
    } catch {
      // Error handled by hook
    }
  };

  if (isSuccess) {
    return (
      <>
        <Stack.Screen options={{ title: 'Verification', headerBackVisible: false }} />
        <View style={styles.successContainer}>
          <CheckCircle size={80} color={COLORS.success} />
          <Text style={styles.successTitle}>Connected!</Text>
          <Text style={styles.successText}>
            Your GSTIN is now connected to the GST Portal
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Verify OTP' }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <KeyRound size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              A 6-digit code has been sent to{'\n'}
              <Text style={styles.destination}>
                {params.destination || 'your registered contact'}
              </Text>
            </Text>
          </View>

          {/* OTP Expiry Countdown */}
          {isOtpExpired ? (
            <View style={styles.expiryWarning}>
              <Clock size={16} color={COLORS.error} />
              <Text style={styles.expiryWarningText}>
                OTP has expired. Please request a new code.
              </Text>
            </View>
          ) : (
            <View style={styles.expiryInfo}>
              <Clock size={16} color={COLORS.gray[500]} />
              <Text style={styles.expiryInfoText}>
                Code expires in {formatTime(otpExpiry)}
              </Text>
            </View>
          )}

          {/* OTP Input */}
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={[styles.otpInput, isOtpExpired && styles.otpInputDisabled]}
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={COLORS.gray[400]}
              editable={!verifyOtp.isPending && !isOtpExpired}
              accessibilityLabel="6-digit verification code"
              accessibilityHint="Enter the OTP sent to your registered contact"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <Text style={styles.attemptsText}>
                  {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                </Text>
              )}
            </View>
          )}

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (otp.length !== 6 || verifyOtp.isPending || isOtpExpired) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            disabled={otp.length !== 6 || verifyOtp.isPending || isOtpExpired}
          >
            {verifyOtp.isPending ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.verifyButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resendCooldown > 0 || resendOtp.isPending}
          >
            {resendOtp.isPending ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <RefreshCw size={16} color={COLORS.primary} />
                <Text style={styles.resendButtonText}>
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Didn't receive code? Resend"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* GSTIN Info */}
          <View style={styles.gstinInfo}>
            <Text style={styles.gstinLabel}>Connecting GSTIN</Text>
            <Text style={styles.gstinValue}>{params.gstin}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
    textAlign: 'center',
    lineHeight: 22,
  },
  destination: {
    fontWeight: '600',
    color: COLORS.gray[800],
  },
  expiryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  expiryInfoText: {
    marginLeft: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  expiryWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: '#fef2f2',
    borderRadius: BORDER_RADIUS.md,
  },
  expiryWarningText: {
    marginLeft: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
  },
  inputContainer: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  otpInput: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 16,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.gray[50],
    fontFamily: 'monospace',
  },
  otpInputDisabled: {
    backgroundColor: COLORS.gray[200],
    borderColor: COLORS.gray[400],
  },
  errorContainer: {
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    textAlign: 'center',
  },
  attemptsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  verifyButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  verifyButtonDisabled: {
    backgroundColor: COLORS.gray[400],
  },
  verifyButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  resendButtonText: {
    marginLeft: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  gstinInfo: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.md,
  },
  gstinLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
  gstinValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: COLORS.gray[800],
    marginTop: SPACING.xs,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
  },
  successTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.success,
    marginTop: SPACING.lg,
  },
  successText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
