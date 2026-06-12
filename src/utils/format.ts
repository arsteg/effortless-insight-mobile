/**
 * Formatting Utilities
 */

import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';

/**
 * Format currency in Indian Rupee
 */
export function formatCurrency(amount: number | undefined | null, options?: { compact?: boolean }): string {
  if (amount === undefined || amount === null) return '-';

  if (options?.compact) {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)}Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
  }

  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Format date to readable string
 */
export function formatDate(date: string | Date | undefined | null, formatStr: string = 'dd MMM yyyy'): string {
  if (!date) return '-';

  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

/**
 * Format date to relative time
 */
export function formatRelativeDate(date: string | Date | undefined | null): string {
  if (!date) return '-';

  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Get days remaining/overdue from deadline
 */
export function getDaysRemaining(deadline: string | Date | undefined | null): number | null {
  if (!deadline) return null;

  const deadlineDate = typeof deadline === 'string' ? parseISO(deadline) : deadline;
  return differenceInDays(deadlineDate, new Date());
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null) return '-';

  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | undefined | null, decimals: number = 0): string {
  if (value === undefined || value === null) return '-';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Get initials from name
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string | undefined | null): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Format status for display
 */
export function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
