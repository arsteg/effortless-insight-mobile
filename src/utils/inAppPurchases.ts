/**
 * Whether this build may show plans, checkout or any "upgrade" call to action.
 *
 * App Store guideline 3.1.1: on iOS a digital subscription must be sold through
 * Apple's In-App Purchase. Plans are paid through Razorpay, so the iOS app hides
 * every route into billing — no plan list, no checkout, no "View Plans" button —
 * and users subscribe on the website. Android (Google Play) keeps Razorpay.
 *
 * The rule also forbids buttons or links that send iOS users to an outside
 * purchase, so do not replace the hidden entry points with a link to the website.
 */

import { Platform } from 'react-native';

export const canPurchaseInApp = Platform.OS !== 'ios';
