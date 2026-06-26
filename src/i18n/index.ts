/**
 * i18n Configuration
 * Internationalization setup for Hindi and English support
 */

import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en';
import hi from './locales/hi';

const LANGUAGE_KEY = '@app_language';

// Create i18n instance
const i18n = new I18n({
  en,
  hi,
});

// Set default locale
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

// Initialize locale from saved preference or system locale
export async function initializeLocale(): Promise<string> {
  try {
    // Check saved preference first
    const savedLocale = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'hi')) {
      i18n.locale = savedLocale;
      return savedLocale;
    }

    // Fall back to system locale
    const locales = getLocales();
    const systemLocale = locales[0]?.languageCode || 'en';

    // Only support en and hi
    const locale = systemLocale === 'hi' ? 'hi' : 'en';
    i18n.locale = locale;

    return locale;
  } catch (error) {
    console.error('Failed to initialize locale:', error);
    i18n.locale = 'en';
    return 'en';
  }
}

// Change locale and save preference
export async function setLocale(locale: 'en' | 'hi'): Promise<void> {
  i18n.locale = locale;
  await AsyncStorage.setItem(LANGUAGE_KEY, locale);
}

// Get current locale
export function getLocale(): string {
  return i18n.locale;
}

// Translation function
export function t(key: string, options?: object): string {
  return i18n.t(key, options);
}

// Export i18n instance
export { i18n };
export default i18n;
