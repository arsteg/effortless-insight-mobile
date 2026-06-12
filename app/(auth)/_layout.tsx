/**
 * Auth Stack Layout
 */

import { Stack } from 'expo-router';
import { COLORS } from '../../src/utils/constants';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.white },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="two-factor" />
    </Stack>
  );
}
