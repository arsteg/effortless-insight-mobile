/**
 * Notice status transition rules.
 *
 * A deliberate mirror of the server's `NoticeWorkflowService` map. The client
 * previously offered every status, so any second change attempted an illegal
 * move and the API returned 400 INVALID_TRANSITION (TC-MOB-040).
 *
 * Keep in step with:
 *   effortless-insight-api/src/EffortlessInsight.Api/Services/Notices/NoticeWorkflowService.cs
 * The server remains the authority — this only avoids offering moves that are
 * certain to be rejected.
 */

import type { NoticeStatus } from '../types/api';

/** Where each status may legally move to. */
const ALLOWED_TRANSITIONS: Record<NoticeStatus, NoticeStatus[]> = {
  uploaded: ['processing', 'failed'],
  processing: ['analyzed', 'failed'],
  analyzed: ['in_progress', 'archived', 'closed'],
  in_progress: ['responded', 'analyzed'],
  responded: ['closed', 'in_progress'],
  closed: ['archived'],
  failed: ['processing', 'archived'],
  archived: ['analyzed'],
};

/** Transitions the server rejects unless a reason is supplied. */
const REQUIRES_REASON: [NoticeStatus, NoticeStatus][] = [
  ['analyzed', 'closed'], // closing without a response
  ['in_progress', 'analyzed'], // going back
  ['responded', 'in_progress'], // reopening
  ['failed', 'archived'], // abandoning
  ['archived', 'analyzed'], // restoring
];

export const STATUS_LABELS: Record<NoticeStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  analyzed: 'Analyzed',
  in_progress: 'In Progress',
  responded: 'Responded',
  closed: 'Closed',
  archived: 'Archived',
  failed: 'Failed',
};

export function getAllowedTransitions(current?: string | null): NoticeStatus[] {
  if (!current) return [];
  return ALLOWED_TRANSITIONS[current.toLowerCase() as NoticeStatus] ?? [];
}

export function isTransitionAllowed(from?: string | null, to?: string | null): boolean {
  if (!from || !to) return false;
  return getAllowedTransitions(from).includes(to.toLowerCase() as NoticeStatus);
}

export function transitionRequiresReason(from?: string | null, to?: string | null): boolean {
  if (!from || !to) return false;
  const a = from.toLowerCase();
  const b = to.toLowerCase();
  return REQUIRES_REASON.some(([f, t]) => f === a && t === b);
}

export function statusLabel(status?: string | null): string {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status.toLowerCase() as NoticeStatus] ?? status.replace(/_/g, ' ');
}
