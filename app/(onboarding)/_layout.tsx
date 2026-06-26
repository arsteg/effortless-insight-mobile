/**
 * Onboarding Stack Layout
 */

import { Stack } from 'expo-router';
import { COLORS } from '../../src/utils/constants';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTintColor: COLORS.gray[900],
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: COLORS.white,
        },
      }}
    >
      <Stack.Screen
        name="welcome"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="organization"
        options={{
          title: 'Create Organization',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="complete"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
