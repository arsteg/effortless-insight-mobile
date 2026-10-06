/**
 * Billing Stack Layout
 */

import { Redirect, Stack } from 'expo-router';
import { COLORS } from '../../src/utils/constants';
import { canPurchaseInApp } from '../../src/utils/inAppPurchases';

export default function BillingLayout() {
  // The entry points are hidden on iOS; this also catches deep links and
  // notification taps that would otherwise land on plans or checkout.
  if (!canPurchaseInApp) {
    return <Redirect href="/" />;
  }

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
