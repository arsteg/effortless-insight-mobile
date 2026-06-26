/**
 * Onboarding Complete Screen
 * Success screen after organization creation
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle, Rocket, ArrowRight } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores';
import { Button } from '../../src/components';
import { COLORS, SPACING, FONT_SIZES } from '../../src/utils/constants';

export default function CompleteScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Animation values
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate check icon
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleContinue = () => {
    // Navigate to main app
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <CheckCircle size={80} color={COLORS.success} />
        </Animated.View>

        {/* Content */}
        <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
          <Text style={styles.title}>You're all set!</Text>
          <Text style={styles.subtitle}>
            {user?.organization?.name
              ? `${user.organization.name} has been created successfully.`
              : 'Your organization has been created successfully.'}
          </Text>

          {/* Next Steps */}
          <View style={styles.nextStepsContainer}>
            <Text style={styles.nextStepsTitle}>What's next?</Text>
            <View style={styles.stepsList}>
              <StepItem
                number={1}
                text="Upload your first GST notice"
              />
              <StepItem
                number={2}
                text="Our AI will analyze it automatically"
              />
              <StepItem
                number={3}
                text="Track deadlines and manage responses"
              />
            </View>
          </View>

          {/* Trial Info */}
          <View style={styles.trialBadge}>
            <Rocket size={16} color={COLORS.primary} />
            <Text style={styles.trialText}>
              14-day free trial started
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom CTA */}
      <Animated.View style={[styles.bottomContainer, { opacity: fadeAnim }]}>
        <Button
          title="Start Using App"
          onPress={handleContinue}
          variant="primary"
          fullWidth
          icon={<ArrowRight size={18} color={COLORS.white} />}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  iconContainer: {
    marginBottom: SPACING.xl,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  nextStepsContainer: {
    width: '100%',
    backgroundColor: COLORS.gray[50],
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  nextStepsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: SPACING.md,
  },
  stepsList: {
    gap: SPACING.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  stepText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[700],
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  trialText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.primary,
  },
  bottomContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
});
