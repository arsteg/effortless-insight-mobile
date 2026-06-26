/**
 * PasswordInput Component
 * Text input with visibility toggle for passwords
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  TextInputProps,
} from 'react-native';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  showIcon?: boolean;
}

export function PasswordInput({
  label,
  error,
  showIcon = true,
  style,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        {showIcon && <Lock size={20} color={COLORS.gray[400]} />}
        <TextInput
          style={[styles.input, style]}
          secureTextEntry={!isVisible}
          placeholderTextColor={COLORS.gray[400]}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        <TouchableOpacity
          onPress={() => setIsVisible(!isVisible)}
          style={styles.toggleButton}
          accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
          accessibilityRole="button"
        >
          {isVisible ? (
            <EyeOff size={20} color={COLORS.gray[400]} />
          ) : (
            <Eye size={20} color={COLORS.gray[400]} />
          )}
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    paddingVertical: SPACING.md,
  },
  toggleButton: {
    padding: SPACING.xs,
  },
  errorText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
  },
});
