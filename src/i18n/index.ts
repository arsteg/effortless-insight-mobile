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

// External-store subscription so EVERY useTranslation consumer re-renders when
// the locale changes — previously each hook held its own state and only the
// screen that triggered the change updated (audit B9).
type LocaleListener = () => void;
const localeListeners = new Set<LocaleListener>();
let initialized = false;

export function subscribeLocale(listener: LocaleListener): () => void {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

function notifyLocaleChanged(): void {
  localeListeners.forEach((listener) => listener());
}

// Initialize locale from saved preference or system locale (runs once).
export async function initializeLocale(): Promise<string> {
  if (initialized) {
    return i18n.locale;
  }
  initialized = true;
  try {
    const savedLocale = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'hi')) {
      i18n.locale = savedLocale;
    } else {
      const locales = getLocales();
      const systemLocale = locales[0]?.languageCode || 'en';
      i18n.locale = systemLocale === 'hi' ? 'hi' : 'en';
    }
  } catch (error) {
    console.error('Failed to initialize locale:', error);
    i18n.locale = 'en';
  }
  notifyLocaleChanged();
  return i18n.locale;
}

// Change locale and save preference, notifying all subscribers.
export async function setLocale(locale: 'en' | 'hi'): Promise<void> {
  i18n.locale = locale;
  notifyLocaleChanged();
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
