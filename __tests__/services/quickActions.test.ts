/**
 * TC-MOB-073 — home-screen quick actions.
 */

import {
  routeForQuickAction,
  quickActionDefinitions,
  QUICK_ACTION_ROUTES,
} from '../../src/utils/quickActions';

const t = (key: string) => key;

describe('routeForQuickAction', () => {
  it('returns the route for each declared action', () => {
    expect(routeForQuickAction({ route: '/upload' })).toBe('/upload');
    expect(routeForQuickAction({ route: '/notices' })).toBe('/notices');
    expect(routeForQuickAction({ route: '/tasks' })).toBe('/tasks');
  });

  it('ignores a route that is not on the allow-list', () => {
    // The payload comes from outside the app; it must not be able to open an
    // arbitrary screen. Same rule as the notification deep-link handling.
    expect(routeForQuickAction({ route: '/settings/change-password' })).toBeUndefined();
    expect(routeForQuickAction({ route: 'https://evil.example' })).toBeUndefined();
  });

  it('handles a missing or malformed payload', () => {
    expect(routeForQuickAction(null)).toBeUndefined();
    expect(routeForQuickAction(undefined)).toBeUndefined();
    expect(routeForQuickAction({})).toBeUndefined();
    expect(routeForQuickAction({ route: undefined })).toBeUndefined();
  });

  it('rejects a non-string route', () => {
    expect(routeForQuickAction({ route: 42 } as never)).toBeUndefined();
  });
});

describe('quickActionDefinitions', () => {
  it('stays within the four iOS allows', () => {
    expect(quickActionDefinitions(t).length).toBeLessThanOrEqual(4);
  });

  it('offers scan, notices and tasks', () => {
    expect(quickActionDefinitions(t).map((a) => a.id)).toEqual(['scan', 'notices', 'tasks']);
  });

  it('routes every action somewhere allowed', () => {
    quickActionDefinitions(t).forEach((action) => {
      expect(routeForQuickAction(action.params)).toBe(action.params.route);
    });
  });

  it('gives each action a distinct id, or the OS would collapse them', () => {
    const ids = quickActionDefinitions(t).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('takes its titles from the dictionary, so they follow the language', () => {
    const actions = quickActionDefinitions((key) => `translated:${key}`);
    actions.forEach((action) => {
      expect(action.title).toMatch(/^translated:quickActions\./);
      expect(action.subtitle).toMatch(/^translated:quickActions\./);
    });
  });

  it('declares no route outside the allow-list', () => {
    quickActionDefinitions(t).forEach((action) => {
      expect(QUICK_ACTION_ROUTES).toContain(action.params.route);
    });
  });
});
