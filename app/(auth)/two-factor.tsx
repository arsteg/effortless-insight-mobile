/**
 * Two-Factor Authentication Screen
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores';
import { Button } from '../../src/components/common';
import { getApiErrorMessage, getApiErrorCode } from '../../src/services/api';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';
import { useTranslation } from '../../src/hooks';

const CODE_LENGTH = 6;

export default function TwoFactorScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();
  const [code, setCode] = useState<string[]>(new Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const { complete2fa, cancel2fa, isLoading, requires2fa } = useAuthStore();

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Redirect if not in 2FA flow
  React.useEffect(() => {
    if (!requires2fa) {
      router.replace('/(auth)/login');
    }
  }, [requires2fa]);

  // Android's hardware back would otherwise pop to login and be bounced
  // straight back here; route it through the same cancel path as the header.
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (index === CODE_LENGTH - 1 && digit) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        handleSubmit(fullCode);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Leaving 2FA must clear the pending state first. Navigating away with
   * `requires2fa` still true sends the user to the login screen, whose effect
   * immediately pushes them back here — an inescapable loop.
   */
  const handleCancel = () => {
    cancel2fa();
    router.replace('/(auth)/login');
  };

  /**
   * The partial token lives for 5 minutes. Once it's gone there is nothing to
   * retry, so drop the 2FA state and send the user back to sign in again
   * rather than leaving them on a screen that can never succeed.
   */
  const handleExpiredSession = () => {
    cancel2fa();
    router.replace({
      pathname: '/(auth)/login',
      params: { notice: 'Your sign-in session expired. Please sign in again.' },
    });
  };

  const handleSubmit = async (fullCode: string) => {
    try {
      setError(null);
      await complete2fa(fullCode);
      router.replace('/(tabs)');
    } catch (err) {
      if (getApiErrorCode(err) === 'INVALID_PARTIAL_TOKEN') {
        handleExpiredSession();
        return;
      }
      const message = getApiErrorMessage(err);
      setError(message);
      setCode(new Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  const handleVerify = () => {
    const fullCode = code.join('');
    if (fullCode.length === CODE_LENGTH) {
      handleSubmit(fullCode);
    } else {
      setError('Please enter all 6 digits');
    }
  };

  const handleBackupVerify = async () => {
    const trimmed = backupCode.trim();
    if (!trimmed) {
      setError('Please enter a backup code');
      return;
    }
    try {
      setError(null);
      await complete2fa(trimmed);
      router.replace('/(tabs)');
    } catch (err) {
      if (getApiErrorCode(err) === 'INVALID_PARTIAL_TOKEN') {
        handleExpiredSession();
        return;
      }
      setError(getApiErrorMessage(err));
      setBackupCode('');
    }
  };

  const toggleBackupMode = () => {
    setError(null);
    setBackupCode('');
    setCode(new Array(CODE_LENGTH).fill(''));
    setUseBackupCode((prev) => !prev);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel two-factor sign in"
        >
          <ArrowLeft size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Shield size={48} color={COLORS.primary} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.twoFactorAuthentication')}</Text>
          <Text style={styles.subtitle}>
            {useBackupCode
              ? 'Enter one of your backup codes to complete sign in.'
              : 'Enter the 6-digit code from your authenticator app to complete sign in.'}
          </Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {useBackupCode ? (
          <>
            {/* Backup Code Input */}
            <TextInput
              style={[styles.backupInput, error ? styles.codeInputError : undefined]}
              value={backupCode}
              onChangeText={(text) => {
                setBackupCode(text);
                setError(null);
              }}
              placeholder={t('auth.enterBackupCode')}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
            />

            <Button
              title={t('auth.verify')}
              onPress={handleBackupVerify}
              loading={isLoading}
              fullWidth
              size="lg"
              disabled={!backupCode.trim()}
            />
          </>
        ) : (
          <>
            {/* Code Input */}
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.codeInput,
                    digit ? styles.codeInputFilled : undefined,
                    error ? styles.codeInputError : undefined,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              ))}
            </View>

            <Button
              title={t('auth.verify')}
              onPress={handleVerify}
              loading={isLoading}
              fullWidth
              size="lg"
              disabled={code.some((d) => !d)}
            />
          </>
        )}

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            {useBackupCode ? 'Have your authenticator? ' : "Can't access your authenticator? "}
            <Text style={styles.helpLink} onPress={toggleBackupMode}>
              {useBackupCode ? 'Use authenticator code' : 'Use a backup code'}
            </Text>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
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
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    width: '100%',
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.gray[900],
  },
  codeInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  codeInputError: {
    borderColor: COLORS.error,
  },
  backupInput: {
    width: '100%',
    height: 56,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    fontSize: FONT_SIZES.lg,
    textAlign: 'center',
    color: COLORS.gray[900],
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  helpContainer: {
    marginTop: SPACING.xl,
  },
  helpText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
  helpLink: {
    color: COLORS.primary,
    fontWeight: '500',
  },
});
