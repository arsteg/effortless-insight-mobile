/**
 * Home-screen quick actions (TC-MOB-073).
 *
 * Long-pressing the app icon shows up to four shortcuts. iOS does not generate
 * these — the app declares them, and they exist even before it has ever been
 * opened.
 *
 * Deliberately STATIC rather than dynamic. A dynamic list ("Continue:
 * GST-2024-0891") reads better, but it has to be cleared on logout or the
 * previous user's notice number sits on the home screen of a shared device —
 * a poor trade for a convenience shortcut on a product handling confidential
 * tax data.
 */

/** Payload carried by an action, used to decide where to go. */
export interface QuickActionPayload {
  route?: string;
}

/** The route an action should open, or undefined when it carries none. */
export function routeForQuickAction(
  params: QuickActionPayload | null | undefined
): string | undefined {
  const route = params?.route;
  if (typeof route !== 'string') return undefined;

  // Allow-listed, exactly like the notification deep-link handling: a payload
  // is data from outside the app and must not be able to open anywhere.
  return (QUICK_ACTION_ROUTES as readonly string[]).includes(route) ? route : undefined;
}

/** Every route a quick action may open. */
export const QUICK_ACTION_ROUTES = ['/upload', '/notices', '/tasks'] as const;

export interface QuickActionDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  params: { route: string };
}

/**
 * The actions to register.
 *
 * Three, not four: each one has to earn its place, and a shorter list is
 * quicker to read under a thumb.
 */
export function quickActionDefinitions(
  t: (key: string) => string
): QuickActionDefinition[] {
  return [
    {
      id: 'scan',
      title: t('quickActions.scanTitle'),
      subtitle: t('quickActions.scanSubtitle'),
      icon: 'camera',
      params: { route: '/upload' },
    },
    {
      id: 'notices',
      title: t('quickActions.noticesTitle'),
      subtitle: t('quickActions.noticesSubtitle'),
      icon: 'compose',
      params: { route: '/notices' },
    },
    {
      id: 'tasks',
      title: t('quickActions.tasksTitle'),
      subtitle: t('quickActions.tasksSubtitle'),
      icon: 'task',
      params: { route: '/tasks' },
    },
  ];
}
