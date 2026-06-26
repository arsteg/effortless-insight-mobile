/**
 * Translation Hook
 * React hook for using translations
 */

import { useState, useEffect, useCallback } from 'react';
import { i18n, initializeLocale, setLocale, getLocale, t } from '../i18n';

export interface UseTranslationResult {
  t: (key: string, options?: object) => string;
  locale: string;
  setLocale: (locale: 'en' | 'hi') => Promise<void>;
  isRTL: boolean;
  isHindi: boolean;
}

export function useTranslation(): UseTranslationResult {
  const [locale, setLocaleState] = useState(getLocale());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize locale on mount
  useEffect(() => {
    const init = async () => {
      const initialLocale = await initializeLocale();
      setLocaleState(initialLocale);
      setIsInitialized(true);
    };
    init();
  }, []);

  // Change locale handler
  const handleSetLocale = useCallback(async (newLocale: 'en' | 'hi') => {
    await setLocale(newLocale);
    setLocaleState(newLocale);
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
