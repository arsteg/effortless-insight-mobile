/**
 * Translation Hook
 * React hook for using translations
 */

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { initializeLocale, setLocale, getLocale, subscribeLocale, t } from '../i18n';

export interface UseTranslationResult {
  t: (key: string, options?: object) => string;
  locale: string;
  setLocale: (locale: 'en' | 'hi') => Promise<void>;
  isRTL: boolean;
  isHindi: boolean;
}

export function useTranslation(): UseTranslationResult {
  // Shared external store: any locale change re-renders ALL consumers (B9).
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);

  // Initialize once (guarded inside initializeLocale).
  useEffect(() => {
    initializeLocale();
  }, []);

  const handleSetLocale = useCallback(async (newLocale: 'en' | 'hi') => {
    await setLocale(newLocale);
  }, []);

  return {
    t,
    locale,
    setLocale: handleSetLocale,
    isRTL: false, // Hindi is LTR
    isHindi: locale === 'hi',
  };
}

/**
 * Hook to get the preferred language for AI content
 * Returns 'hi' for Hindi locale, 'en' otherwise
 */
export function useAILanguage(): 'en' | 'hi' {
  const { locale } = useTranslation();
  return locale === 'hi' ? 'hi' : 'en';
}

export default useTranslation;
