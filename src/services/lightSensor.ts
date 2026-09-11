/**
 * Ambient light readings for the scanner's low-light warning (TC-MOB-026).
 *
 * Android phones expose a hardware ambient-light sensor that reports lux.
 * iOS does not expose one to apps at all, so on iOS this is a no-op and the
 * live warning simply does not appear — the post-capture brightness check in
 * `utils/imageBrightness` covers that platform instead.
 *
 * Every failure degrades to "no readings" rather than throwing: a scanner that
 * cannot measure light must still take photographs.
 */

import { Platform } from 'react-native';

/** Unsubscribe handle. Always safe to call. */
export type LightSubscription = () => void;

/**
 * Whether live low-light detection can work here at all.
 *
 * Used by the UI to decide between showing a live warning and saying nothing —
 * never to show a warning it cannot substantiate.
 */
export const supportsAmbientLight = Platform.OS === 'android';

/**
 * Subscribe to lux readings. Returns a no-op unsubscribe when unavailable —
 * on iOS, in Expo Go, or on a device with no such sensor.
 *
 * `expo-sensors` is required lazily: the native module only exists in builds
 * made after it was added, and never in Expo Go.
 */
export function subscribeToLightLevel(
  onReading: (lux: number) => void,
  intervalMs = 1000
): LightSubscription {
  if (!supportsAmbientLight) return () => {};

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LightSensor } = require('expo-sensors');
    if (!LightSensor) return () => {};

    LightSensor.setUpdateInterval(intervalMs);
    const subscription = LightSensor.addListener((data: { illuminance?: number }) => {
      if (typeof data?.illuminance === 'number') onReading(data.illuminance);
    });

    return () => {
      try {
        subscription?.remove();
      } catch {
        // Already gone.
      }
    };
  } catch {
    // Module missing (Expo Go) or no sensor on this device.
    return () => {};
  }
}
