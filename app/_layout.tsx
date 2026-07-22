/**
 * Root Layout
 * Handles auth state, providers, and navigation structure
 */

import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Platform, AppState } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { useAuthStore, useUIStore } from '../src/stores';
import { ErrorBoundary, LoadingSpinner, OfflineBanner, ToastContainer } from '../src/components/common';
import { COLORS } from '../src/utils/constants';
import {
  setupNotificationChannels,
  registerPushToken,
  registerPushTokenWithRetry,
  addPushTokenRotationListener,
  handleNotificationTap,
  addNotificationResponseReceivedListener,
} from '../src/services/pushNotifications';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

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

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const coldStartHandledRef = useRef(false);

  const { isAuthenticated, isInitialized, needsOnboarding, initialize } = useAuthStore();
  const { initializeNetInfo } = useUIStore();

  // Initialize auth and network state
  useEffect(() => {
    initialize();
    const unsubscribe = initializeNetInfo();
    return unsubscribe;
  }, [initialize, initializeNetInfo]);

  // Setup push notifications when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Setup Android notification channels
    setupNotificationChannels();

    // Register push token (with retry/backoff on transient failures — MO-06)
    registerPushTokenWithRetry();

    // Listen for notification taps while the app is running
    const responseSub = addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(response.notification);
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
      rotationSub.remove();
      appStateSub.remove();
    };
  }, [isAuthenticated]);

  // Handle a notification tap that cold-started the app. The response listener
  // above is only attached after launch, so it never sees the launching tap;
  // read it explicitly and route once auth is ready (audit MO-04).
  useEffect(() => {
    if (!isAuthenticated || !isInitialized || coldStartHandledRef.current) return;

    let cancelled = false;
    (async () => {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
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
      <View style={{ flex: 1, backgroundColor: COLORS.white }}>
        <LoadingSpinner fullScreen message="Loading..." />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.primary,
          },
          headerTintColor: COLORS.white,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
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
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
