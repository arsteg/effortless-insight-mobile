/**
 * Edit Profile Screen
 * Allows users to update their profile information
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { User, Phone, Camera, X } from 'lucide-react-native';
import { useAuthStore, useUIStore } from '../../src/stores';
import { authApi } from '../../src/services/api';
import { Button, Input, LoadingSpinner } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuthStore();
  const { showToast } = useUIStore();

  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setMobile(user.mobile || '');
    }
  }, [user]);

  const validate = (): boolean => {
    const newErrors: { name?: string; mobile?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (mobile && !/^[6-9]\d{9}$/.test(mobile.replace(/\D/g, ''))) {
      newErrors.mobile = 'Enter a valid 10-digit mobile number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      await authApi.updateProfile({
        name: name.trim(),
        mobile: mobile.replace(/\D/g, '') || undefined,
      });

      await refreshProfile();
      showToast('success', 'Profile updated successfully');
      router.back();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = name !== (user?.name || '') || mobile !== (user?.mobile || '');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerRight: () =>
            hasChanges ? (
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={() => Alert.alert('Coming Soon', 'Profile photo upload will be available soon.')}
            >
              <Camera size={16} color={COLORS.primary} />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <Input
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Enter your full name"
                error={errors.name}
                autoCapitalize="words"
                leftIcon={<User size={20} color={COLORS.gray[400]} />}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number</Text>
              <Input
                value={mobile}
                onChangeText={(text) => {
                  setMobile(text.replace(/\D/g, '').slice(0, 10));
                  if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: undefined }));
                }}
                placeholder="Enter 10-digit mobile number"
                error={errors.mobile}
                keyboardType="phone-pad"
                maxLength={10}
                leftIcon={<Phone size={20} color={COLORS.gray[400]} />}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{user?.email}</Text>
                <Text style={styles.readOnlyHint}>Email cannot be changed</Text>
              </View>
            </View>
          </View>

          {/* Security Section */}
          <View style={styles.securitySection}>
            <Text style={styles.sectionTitle}>Security</Text>
            <TouchableOpacity
              style={styles.securityItem}
              onPress={() => router.push('/settings/change-password')}
            >
              <Text style={styles.securityItemText}>Change Password</Text>
              <Text style={styles.securityItemChevron}>›</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomContainer}>
          <Button
            title={isLoading ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            disabled={!hasChanges || isLoading}
            variant="primary"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray[50],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  changePhotoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  form: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  readOnlyField: {
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  readOnlyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  readOnlyHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[400],
    marginTop: SPACING.xs,
  },
  securitySection: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  securityItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  securityItemChevron: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.gray[400],
  },
  bottomContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  saveButton: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
    marginRight: SPACING.sm,
  },
});
