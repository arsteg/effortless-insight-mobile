/**
 * Root Layout
 * Handles auth state, providers, and navigation structure
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Platform, AppState, BackHandler } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useAuthStore, useUIStore } from '../src/stores';
import { ErrorBoundary, LoadingSpinner, OfflineBanner, ToastContainer } from '../src/components/common';
import { useColors, useIsDark } from '../src/theme/useTheme';
import {
  setupNotificationChannels,
  registerPushToken,
  registerPushTokenWithRetry,
  addPushTokenRotationListener,
  handleNotificationTap,
  addNotificationResponseReceivedListener,
  addNotificationReceivedListener,
  getLastNotificationResponse,
  getNotificationPermissionStatus,
} from '../src/services/pushNotifications';
import { NotificationPrimer } from '../src/components/notifications/NotificationPrimer';
import { shouldShowPrimer, registrationMessage } from '../src/utils/notificationPriming';
import { loadOfflinePreferences } from '../src/services/offlinePreferences';
import { loadScreenProtection } from '../src/services/screenSecurity';
import * as QuickActions from 'expo-quick-actions';
import { quickActionDefinitions, routeForQuickAction } from '../src/utils/quickActions';
import { shouldExitOnBack, EXIT_WINDOW_MS, EXIT_HINT_KEY } from '../src/utils/backExit';
import { useTranslation } from '../src/hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationKeys } from '../src/hooks/useNotifications';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

/**
 * Tell React Query when the app is actually in front of the user.
 *
 * React Query has no notion of foreground on React Native — it only knows
 * about a browser window. Without this, `useUnreadCount`'s 30-second
 * `refetchInterval` kept polling the server after the user left the app, which
 * is exactly the background drain TC-MOB-085 tests for, and burns cellular
 * data for TC-MOB-086. Registered at module scope so it is active before the
 * first query mounts.
 */
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

/** Remembers that the primer has been offered, so it is shown once. */
const PRIMER_SEEN_KEY = '@notification_primer_seen';

function RootLayoutNav() {
  const COLORS = useColors();
  const isDark = useIsDark();
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const coldStartHandledRef = useRef(false);
  const quickActionHandledRef = useRef(false);
  const lastBackPressRef = useRef<number | null>(null);
  const [primerVisible, setPrimerVisible] = useState(false);
  const [primerBusy, setPrimerBusy] = useState(false);
  const showToast = useUIStore((state) => state.showToast);
  const initializeTheme = useUIStore((state) => state.initializeTheme);

  const markPrimerSeen = useCallback(async () => {
    await AsyncStorage.setItem(PRIMER_SEEN_KEY, 'true').catch(() => {
      // Losing the flag only means the primer may be offered again later.
    });
  }, []);

  /** "Turn on notifications" — now raise the real OS prompt. */
  const handlePrimerEnable = useCallback(async () => {
    setPrimerBusy(true);
    try {
      const result = await registerPushTokenWithRetry();
      await markPrimerSeen();
      setPrimerVisible(false);

      const message = registrationMessage(result);
      if (message) showToast('info', message);
    } finally {
      setPrimerBusy(false);
    }
  }, [markPrimerSeen, showToast]);

  /** "Not now" — the OS permission is left untouched and still askable. */
  const handlePrimerDismiss = useCallback(async () => {
    await markPrimerSeen();
    setPrimerVisible(false);
  }, [markPrimerSeen]);

  const { isAuthenticated, isInitialized, needsOnboarding, initialize, checkSession } =
    useAuthStore();
  const backgroundedAtRef = useRef<number | null>(null);
  const { initializeNetInfo } = useUIStore();

  // Load the saved theme and follow OS appearance changes (TC-MOB-065).
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void initializeTheme().then((cleanup) => {
      unsubscribe = cleanup;
    });
    return () => unsubscribe?.();
  }, [initializeTheme]);

  // Initialize auth and network state
  useEffect(() => {
    initialize();
    const unsubscribe = initializeNetInfo();
    return unsubscribe;
  }, [initialize, initializeNetInfo]);

  // Session expiry is otherwise only noticed on the next request, so a resumed
  // app shows stale data while silently signed out. Revalidate on foreground —
  // but only after a real absence, so tab-switching doesn't spam /auth/me.
  useEffect(() => {
    const REVALIDATE_AFTER_MS = 60_000;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const since = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (since !== null && Date.now() - since >= REVALIDATE_AFTER_MS) {
          checkSession();
        }
      } else if (state === 'background' && backgroundedAtRef.current === null) {
        backgroundedAtRef.current = Date.now();
      }
    });
    return () => subscription.remove();
  }, [checkSession]);

  // Setup push notifications when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Setup Android notification channels
    setupNotificationChannels();

    // Load the offline storage preferences before anything can consult them
    // (TC-MOB-061). The defaults are permissive, so the brief window before
    // this resolves blocks nothing.
    void loadOfflinePreferences();

    // Blank the recents thumbnail and block screenshots before anything
    // sensitive can be rendered (TC-MOB-076).
    void loadScreenProtection();

    // Register only when permission already exists. Asking cold, seconds after
    // login, spends the one prompt iOS ever gives on a user who has not yet
    // seen what the app does — the primer below asks properly (TC-MOB-050).
    void (async () => {
      const status = await getNotificationPermissionStatus();
      if (status === 'granted') {
        void registerPushTokenWithRetry();
        return;
      }

      const alreadyPrompted =
        (await AsyncStorage.getItem(PRIMER_SEEN_KEY).catch(() => null)) === 'true';
      if (shouldShowPrimer(status, alreadyPrompted)) {
        setPrimerVisible(true);
      }
    })();

    // Listen for notification taps while the app is running
    const responseSub = addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(response.notification);
    });

    // A push arriving while the app is open used to update nothing — the
    // banner showed, but the Alerts list and its unread badge stayed stale
    // until the screen was navigated away from and back (TC-MOB-049).
    const receivedSub = addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    });

    // Re-register when the OS rotates the token (MO-05)
    const rotationSub = addPushTokenRotationListener();

    // Re-attempt registration when the app returns to the foreground, covering
    // an initial registration that failed while offline (idempotent — MO-06)
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        registerPushToken();
      }
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
      rotationSub.remove();
      appStateSub.remove();
    };
  }, [isAuthenticated]);

  /**
   * Double-back-to-exit at a navigation root (TC-MOB-075).
   *
   * Registered globally and last-resort by design: React Native calls the most
   * recently added handler first, so the scanner's discard confirmation and the
   * two-factor cancel still take precedence. This only runs when nothing else
   * claimed the press and there is no screen left to pop.
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !isAuthenticated) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Somewhere to go back to — let the router handle it normally.
      if (router.canGoBack()) return false;

      if (shouldExitOnBack(lastBackPressRef.current, Date.now())) {
        return false; // second press inside the window: let Android close the app
      }

      lastBackPressRef.current = Date.now();
      showToast('info', t(EXIT_HINT_KEY), EXIT_WINDOW_MS);
      return true;
    });

    return () => subscription.remove();
  }, [isAuthenticated, router, showToast, t]);

  /**
   * Home-screen quick actions (TC-MOB-073).
   *
   * Registered once the user is signed in, and routed only when auth and
   * navigation are both ready — a quick action can launch the app from cold,
   * so acting on it immediately would push a route the navigator has not
   * mounted yet. Same deferred handling as the notification cold-start below.
   */
  useEffect(() => {
    if (!isAuthenticated || !isInitialized) return;

    void QuickActions.setItems(quickActionDefinitions(t));

    // The action that launched the app, if any.
    const initial = QuickActions.initial;
    if (initial && !quickActionHandledRef.current) {
      quickActionHandledRef.current = true;
      const route = routeForQuickAction(initial.params as { route?: string });
      if (route) router.push(route as never);
    }

    // And any chosen while the app was already running in the background.
    const subscription = QuickActions.addListener((action) => {
      const route = routeForQuickAction(action.params as { route?: string });
      if (route) router.push(route as never);
    });

    return () => subscription.remove();
  }, [isAuthenticated, isInitialized, router, t]);

  // Handle a notification tap that cold-started the app. The response listener
  // above is only attached after launch, so it never sees the launching tap;
  // read it explicitly and route once auth is ready (audit MO-04).
  useEffect(() => {
    if (!isAuthenticated || !isInitialized || coldStartHandledRef.current) return;

    let cancelled = false;
    (async () => {
      const lastResponse = await getLastNotificationResponse();
      if (!cancelled && lastResponse) {
        coldStartHandledRef.current = true;
        handleNotificationTap(lastResponse.notification);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isInitialized]);

  // Hide splash screen when initialized
  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  // Handle deep links for password reset and email verification
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      if (!url) return;

      try {
        const parsed = Linking.parse(url);
        const path = parsed.path;

        if (path?.includes('reset-password')) {
          const token = parsed.queryParams?.token as string;
          if (token) {
            router.push({ pathname: '/(auth)/reset-password', params: { token } });
          }
        } else if (path?.includes('verify-email')) {
          const token = parsed.queryParams?.token as string;
          if (token) {
            router.push({ pathname: '/(auth)/verify-email', params: { token } });
          }
        }
      } catch (error) {
        console.error('Failed to parse deep link:', error);
      }
    };

    // Handle initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for incoming deep links while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [router]);

  // Handle auth-based navigation
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Check if user needs onboarding (no organization)
      if (needsOnboarding) {
        router.replace('/(onboarding)/welcome');
      } else {
        // Redirect to main app if authenticated and has organization
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && needsOnboarding && !inOnboardingGroup) {
      // If authenticated but needs onboarding, redirect to onboarding
      router.replace('/(onboarding)/welcome');
    } else if (isAuthenticated && !needsOnboarding && inOnboardingGroup) {
      // If onboarding complete, redirect to main app
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isInitialized, needsOnboarding, segments]);

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.gray[50] }}>
        <LoadingSpinner fullScreen message="Loading..." />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.primary,
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          // iOS labels the back button with the PREVIOUS route's title, and
          // falls back to its route name when it has none. The tab group has
          // `headerShown: false` and no title, so every screen pushed from it
          // read "< (tabs)". Show the chevron alone.
          headerBackButtonDisplayMode: 'minimal',
          // The screen behind a header, and behind a push transition.
          contentStyle: { backgroundColor: COLORS.gray[50] },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="notices/[id]"
          options={{
            title: 'Notice Details',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="billing"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack>
      <ToastContainer />

      <NotificationPrimer
        visible={primerVisible}
        busy={primerBusy}
        onEnable={handlePrimerEnable}
        onDismiss={handlePrimerDismiss}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RootLayoutNav />
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
