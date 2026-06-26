/**
 * Welcome Screen
 * First screen of onboarding - introduces the app and prompts org creation
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, FileCheck, Bell, Shield } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores';
import { Button } from '../../src/components';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const features = [
  {
    icon: FileCheck,
    title: 'Manage GST Notices',
    description: 'Upload, track, and respond to GST notices efficiently',
  },
  {
    icon: Bell,
    title: 'Never Miss Deadlines',
    description: 'Get timely reminders for all your notice deadlines',
  },
  {
    icon: Shield,
    title: 'AI-Powered Analysis',
    description: 'Understand complex notices with intelligent analysis',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const handleGetStarted = () => {
    router.push('/(onboarding)/organization');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Building2 size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.greeting}>
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </Text>
          <Text style={styles.title}>Let's set up your organization</Text>
          <Text style={styles.subtitle}>
            Create your organization to start managing GST notices efficiently
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <feature.icon size={24} color={COLORS.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Trial Info */}
        <View style={styles.trialInfo}>
          <Text style={styles.trialTitle}>Start your 14-day free trial</Text>
          <Text style={styles.trialDescription}>
            No credit card required. Full access to all features.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomContainer}>
        <Button
          title="Get Started"
          onPress={handleGetStarted}
          variant="primary"
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.gray[900],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },
  featuresContainer: {
    paddingVertical: SPACING.lg,
    gap: SPACING.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  featureDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    lineHeight: 20,
  },
  trialInfo: {
    backgroundColor: COLORS.gray[50],
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  trialTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  trialDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
  },
  bottomContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
});
