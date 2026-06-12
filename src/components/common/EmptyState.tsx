/**
 * Empty State Component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FileX, Search, AlertCircle, CheckSquare } from 'lucide-react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

interface EmptyStateProps {
  type?: 'notices' | 'tasks' | 'search' | 'error' | 'custom';
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

const defaultContent = {
  notices: {
    title: 'No Notices Found',
    message: 'You don\'t have any notices yet. Upload your first notice to get started.',
    icon: FileX,
  },
  tasks: {
    title: 'No Tasks',
    message: 'You\'re all caught up! No tasks assigned to you.',
    icon: CheckSquare,
  },
  search: {
    title: 'No Results',
    message: 'We couldn\'t find anything matching your search.',
    icon: Search,
  },
  error: {
    title: 'Something Went Wrong',
    message: 'We encountered an error. Please try again.',
    icon: AlertCircle,
  },
  custom: {
    title: 'Nothing Here',
    message: 'No items to display.',
    icon: FileX,
  },
};

export function EmptyState({
  type = 'custom',
  title,
  message,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const content = defaultContent[type];
  const IconComponent = content.icon;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {icon || <IconComponent size={48} color={COLORS.gray[400]} />}
      </View>
      <Text style={styles.title}>{title || content.title}</Text>
      <Text style={styles.message}>{message || content.message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    minHeight: 300,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
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
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
