/**
 * When to explain notifications before asking for them (TC-MOB-050).
 *
 * The OS prompt used to fire straight after login, cold, with no context — and
 * on iOS the system offers it exactly once, ever. A refusal there is permanent
 * until the user finds the app's page in device settings, so the single prompt
 * is worth spending well: ask after the user has seen what the app is for, and
 * say what the notifications are actually about first.
 */

import type { NotificationPermissionStatus } from '../services/pushNotifications';

/** What the primer offers to turn on. Shown to the user, so keep it concrete. */
export const PRIMER_REASONS: ReadonlyArray<{ title: string; detail: string }> = [
  {
    title: 'Deadline alerts',
    detail: 'Know before a notice response is due, not after.',
  },
  {
    title: 'Notice assignments',
    detail: 'When a notice is assigned to you or its status changes.',
  },
  {
    title: 'Task updates',
    detail: 'Comments, mentions, and tasks coming due.',
  },
] as const;

/**
 * Whether to show the explanation sheet.
 *
 * Only when the OS prompt is still available and the user has not already been
 * asked. `granted` needs no persuasion; `denied` cannot be re-prompted, so the
 * sheet would be a dead end — settings handles that case instead;
 * `unavailable` means a simulator or Expo Go, where none of it applies.
 */
export function shouldShowPrimer(
  status: NotificationPermissionStatus,
  alreadyPrompted: boolean
): boolean {
  if (alreadyPrompted) return false;
  return status === 'undetermined';
}

/**
 * What the settings screen should show for the push row.
 *
 * The row previously rendered a plain toggle whose stored value defaulted to
 * true, so it read "on" while the OS was refusing every notification. These
 * states let it tell the truth instead.
 */
export type PushRowState =
  /** Working, or askable — a toggle is meaningful. */
  | 'toggle'
  /** Refused at OS level: offer a route to device settings, not a toggle. */
  | 'blocked'
  /** Simulator / Expo Go: explain rather than offer a control that cannot work. */
  | 'unsupported';

export function pushRowState(status: NotificationPermissionStatus): PushRowState {
  switch (status) {
    case 'denied':
      return 'blocked';
    case 'unavailable':
      return 'unsupported';
    default:
      return 'toggle';
  }
}

/** Message for a registration that did not succeed, or undefined on success. */
export function registrationMessage(
  result: 'registered' | 'permission-denied' | 'unavailable' | 'failed'
): string | undefined {
  switch (result) {
    case 'registered':
      return undefined;
    case 'permission-denied':
      return 'Notifications are turned off for this app. Open device settings to allow them.';
    case 'unavailable':
      return 'Push notifications need a physical device.';
    case 'failed':
      return 'Could not set up notifications. Check your connection and try again.';
  }
}
