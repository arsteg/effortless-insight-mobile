/**
 * Root Layout
 * Handles auth state, providers, and navigation structure
 */

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore, useUIStore } from '../src/stores';
import { ErrorBoundary, LoadingSpinner, OfflineBanner } from '../src/components/common';
import { COLORS } from '../src/utils/constants';

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

  const { isAuthenticated, isInitialized, initialize } = useAuthStore();
  const { initializeNetInfo } = useUIStore();

  // Initialize auth and network state
  useEffect(() => {
    initialize();
    const unsubscribe = initializeNetInfo();
    return unsubscribe;
  }, []);

  // Hide splash screen when initialized
  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  // Handle auth-based navigation
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main app if authenticated
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isInitialized, segments]);

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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="notices/[id]"
          options={{
            title: 'Notice Details',
            presentation: 'card',
          }}
        />
      </Stack>
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
