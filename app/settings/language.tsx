/**
 * Language Settings Screen
 * Allows users to change the app language
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Check, Globe } from 'lucide-react-native';
import { useTranslation } from '../../src/hooks';
import { useUIStore } from '../../src/stores';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

interface LanguageOption {
  code: 'en' | 'hi';
  name: string;
  nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
];

export default function LanguageScreen() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { showToast } = useUIStore();

  const handleSelectLanguage = async (language: LanguageOption) => {
    if (language.code === locale) return;

    await setLocale(language.code);
    showToast('success', t('settings.languageChanged', { language: language.nativeName }));
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('settings.selectLanguage') }} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Globe size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.headerTitle}>{t('settings.selectLanguage')}</Text>
          <Text style={styles.headerSubtitle}>
            {locale === 'hi'
              ? 'ऐप के लिए अपनी पसंदीदा भाषा चुनें'
              : 'Choose your preferred language for the app'}
          </Text>
        </View>

        {/* Language Options */}
        <View style={styles.languageList}>
          {LANGUAGES.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageOption,
                locale === language.code && styles.languageOptionSelected,
              ]}
              onPress={() => handleSelectLanguage(language)}
            >
              <View style={styles.languageInfo}>
                <Text
                  style={[
                    styles.languageName,
                    locale === language.code && styles.languageNameSelected,
                  ]}
                >
                  {language.nativeName}
                </Text>
                <Text style={styles.languageNameSecondary}>
                  {language.name}
                </Text>
              </View>
              {locale === language.code && (
                <View style={styles.checkIcon}>
                  <Check size={20} color={COLORS.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.infoText}>
            {locale === 'hi'
              ? 'भाषा बदलने से पूरे ऐप में सभी टेक्स्ट अपडेट हो जाएगा। उपलब्ध होने पर AI विश्लेषण सारांश आपकी चुनी हुई भाषा में दिखाई देगा।'
              : 'Changing the language will update all text throughout the app. AI analysis summaries will be shown in your selected language when available.'}
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
  languageList: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  languageOptionSelected: {
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
    color: COLORS.gray[900],
  },
  languageNameSelected: {
    color: COLORS.primary,
  },
  languageNameSecondary: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    padding: SPACING.lg,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    lineHeight: 20,
    textAlign: 'center',
  },
});
