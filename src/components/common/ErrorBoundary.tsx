/**
 * Error Boundary Component
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';
import { useTranslation } from '../../hooks';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * The fallback UI, extracted so it can be themed.
 *
 * A class component cannot use hooks, and the error screen is exactly where a
 * hardcoded light palette would be most jarring — it appears over whatever the
 * user was doing (TC-MOB-065).
 */
function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <AlertTriangle size={48} color={COLORS.error} />
      </View>
      <Text style={styles.title}>{t('components.oopsSomethingWentWrong')}</Text>
      <Text style={styles.message}>
        We encountered an unexpected error. Please try again or contact support if the problem
        persists.
      </Text>
      {__DEV__ && error && (
        <View style={styles.errorDetails}>
          <Text style={styles.errorText}>{error.toString()}</Text>
        </View>
      )}
      <TouchableOpacity style={styles.button} onPress={onRetry}>
        <RefreshCw size={18} color={COLORS.white} />
        <Text style={styles.buttonText}>{t('components.tryAgain')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.white,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  errorDetails: {
    backgroundColor: COLORS.gray[100],
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    maxWidth: '100%',
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    fontFamily: 'monospace',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
