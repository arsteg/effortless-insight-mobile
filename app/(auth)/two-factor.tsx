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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores';
import { Button } from '../../src/components/common';
import { getApiErrorMessage } from '../../src/services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const CODE_LENGTH = 6;

export default function TwoFactorScreen() {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(new Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const { complete2fa, isLoading, requires2fa } = useAuthStore();

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Redirect if not in 2FA flow
  React.useEffect(() => {
    if (!requires2fa) {
      router.replace('/(auth)/login');
    }
  }, [requires2fa]);

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

  const handleSubmit = async (fullCode: string) => {
    try {
      setError(null);
      await complete2fa(fullCode);
      router.replace('/(tabs)');
    } catch (err) {
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

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Shield size={48} color={COLORS.primary} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Two-Factor Authentication</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code from your authenticator app to complete sign in.
          </Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

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

        {/* Verify Button */}
        <Button
          title="Verify"
          onPress={handleVerify}
          loading={isLoading}
          fullWidth
          size="lg"
          disabled={code.some((d) => !d)}
        />

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            Can't access your authenticator?{' '}
            <Text style={styles.helpLink}>Use a backup code</Text>
          </Text>
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
