/**
 * Settings Stack Layout
 */

import { Stack } from 'expo-router';
import { COLORS } from '../../src/utils/constants';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        // Chevron only: iOS otherwise labels it with the previous route's
        // title, or its route name when there is none.
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );
}
