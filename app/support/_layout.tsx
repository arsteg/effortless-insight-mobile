/**
 * Support Stack Layout
 */

import { Stack } from 'expo-router';
import { COLORS } from '../../src/utils/constants';

export default function SupportLayout() {
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
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Support',
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: 'New Ticket',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Ticket',
        }}
      />
    </Stack>
  );
}
