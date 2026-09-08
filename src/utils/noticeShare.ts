/**
 * Builds the text shared from a notice (TC-MOB-042).
 *
 * Sharing sends confidential tax data outside the app, where it cannot be
 * revoked. Two rules follow from that, and both are enforced here rather than
 * in the UI so they are testable:
 *
 *  1. Only roles that can already act on a notice may share it. A `viewer` can
 *     read a notice in-app but cannot re-distribute it.
 *  2. The summary carries identifiers and dates — never the demand amount, the
 *     AI analysis or any attachment content. Those stay in the app, behind
 *     authentication.
 */

import type { UserRole } from '../types/api';

/** Roles permitted to share a notice outside the app. */
const SHARING_ROLES: readonly UserRole[] = ['owner', 'admin', 'manager', 'ca'] as const;

export interface ShareableNotice {
  id: string;
  noticeNumber?: string;
  noticeType?: string;
  gstin?: string;
  status: string;
  responseDeadline?: string;
  issuingAuthority?: string;
}

export function canShareNotice(role?: string | null): boolean {
  if (!role) return false;
  return SHARING_ROLES.includes(role as UserRole);
}

/** Formats an ISO date as a readable day, or undefined when absent/invalid. */
function formatDeadline(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The message body. Every field is optional on the DTO, so each line is
 * included only when it has a value — a summary full of "undefined" is worse
 * than a short one.
 */
export function buildNoticeShareMessage(
  notice: ShareableNotice,
  deepLink?: string
): string {
  const lines: string[] = ['GST Notice'];

  if (notice.noticeNumber) lines.push(`Notice: ${notice.noticeNumber}`);
  if (notice.noticeType) lines.push(`Type: ${notice.noticeType}`);
  if (notice.gstin) lines.push(`GSTIN: ${notice.gstin}`);
  if (notice.issuingAuthority) lines.push(`Issued by: ${notice.issuingAuthority}`);

  lines.push(`Status: ${notice.status.replace(/_/g, ' ')}`);

  const deadline = formatDeadline(notice.responseDeadline);
  if (deadline) lines.push(`Response deadline: ${deadline}`);

  if (deepLink) {
    lines.push('', `Open in EffortlessInsight: ${deepLink}`);
  }

  lines.push('', 'Shared from EffortlessInsight');

  return lines.join('\n');
}

/** Title shown by share targets that support one (email subject, etc.). */
export function buildNoticeShareTitle(notice: ShareableNotice): string {
  return notice.noticeNumber ? `GST Notice ${notice.noticeNumber}` : 'GST Notice';
}
