/**
 * Billing Stack Layout
 */

import { Stack } from 'expo-router';
import { COLORS } from '../../src/utils/constants';

export default function BillingLayout() {
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
          title: 'Subscription',
        }}
      />
      <Stack.Screen
        name="plans"
        options={{
          title: 'Choose Plan',
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{
          title: 'Checkout',
        }}
      />
    </Stack>
  );
}
