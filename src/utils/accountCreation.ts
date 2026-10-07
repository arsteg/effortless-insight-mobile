/**
 * Whether this build lets people create an account.
 *
 * App Store guideline 5.1.1(v): an app that supports account creation must also
 * offer account deletion in the app. Accounts are deleted by an admin on the
 * website, so the iOS app does not create accounts at all — no Sign up link, no
 * Register screen, and no Google/Microsoft sign-in (the API creates a new account
 * the first time an unknown email signs in that way). New businesses sign up on
 * the website and use the app to log in. Dropping third-party sign-in also means
 * guideline 4.8 (Sign in with Apple) does not apply. Android keeps all three.
 *
 * This is a build-time platform check on purpose: guideline 2.3.1 forbids
 * features that are hidden for review and switched on remotely afterwards. Do not
 * re-enable any of this on iOS without shipping in-app account deletion (and Sign
 * in with Apple, if third-party sign-in comes back).
 */

import { Platform } from 'react-native';

export const canCreateAccountInApp = Platform.OS !== 'ios';
