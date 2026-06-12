/**
 * Input Component
 */

import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      containerStyle,
      secureTextEntry,
      ...props
    },
    ref
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isPassword = secureTextEntry !== undefined;

    const togglePasswordVisibility = () => {
      setIsPasswordVisible(!isPasswordVisible);
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View
          style={[
            styles.inputContainer,
            error ? styles.inputError : undefined,
            props.editable === false ? styles.inputDisabled : undefined,
          ]}
        >
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon ? styles.inputWithLeftIcon : undefined,
              (rightIcon || isPassword) ? styles.inputWithRightIcon : undefined,
            ]}
            placeholderTextColor={COLORS.gray[400]}
            secureTextEntry={isPassword ? !isPasswordVisible : false}
            {...props}
          />
          {isPassword && (
            <TouchableOpacity style={styles.iconRight} onPress={togglePasswordVisibility}>
              {isPasswordVisible ? (
                <EyeOff size={20} color={COLORS.gray[500]} />
              ) : (
                <Eye size={20} color={COLORS.gray[500]} />
              )}
            </TouchableOpacity>
          )}
          {!isPassword && rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    minHeight: 48,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    backgroundColor: COLORS.gray[100],
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  iconLeft: {
    paddingLeft: SPACING.md,
  },
  iconRight: {
    paddingRight: SPACING.md,
  },
  error: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  helperText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: SPACING.xs,
  },
});
