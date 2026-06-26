/**
 * Organization Creation Screen
 * Form to create organization during onboarding
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  FileText,
  MapPin,
  ChevronDown,
  Check,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { useAuthStore, useUIStore } from '../../src/stores';
import { organizationsApi } from '../../src/services/api';
import { Button } from '../../src/components';
import {
  COLORS,
  SPACING,
  FONT_SIZES,
  BORDER_RADIUS,
} from '../../src/utils/constants';
import {
  INDIAN_STATES,
  INDUSTRY_OPTIONS,
  TURNOVER_OPTIONS,
  ValidateGstinResponse,
} from '../../src/types';

// Validation schema
const organizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(255, 'Organization name is too long'),
  gstin: z
    .string()
    .length(15, 'GSTIN must be exactly 15 characters')
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      'Invalid GSTIN format'
    ),
  state: z.string().min(1, 'Please select a state'),
  city: z.string().optional(),
  industry: z.string().optional(),
  annualTurnoverRange: z.string().optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

export default function OrganizationScreen() {
  const router = useRouter();
  const { completeOnboarding, isLoading } = useAuthStore();
  const { showToast } = useUIStore();

  const [gstinValidation, setGstinValidation] = useState<{
    isValidating: boolean;
    result: ValidateGstinResponse | null;
  }>({
    isValidating: false,
    result: null,
  });

  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showIndustryPicker, setShowIndustryPicker] = useState(false);
  const [showTurnoverPicker, setShowTurnoverPicker] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      gstin: '',
      state: '',
      city: '',
      industry: '',
      annualTurnoverRange: '',
    },
  });

  const gstinValue = watch('gstin');

  // Validate GSTIN when it changes
  useEffect(() => {
    const validateGstin = async () => {
      if (!gstinValue || gstinValue.length !== 15) {
        setGstinValidation({ isValidating: false, result: null });
        return;
      }

      setGstinValidation({ isValidating: true, result: null });

      try {
        const result = await organizationsApi.validateGstin(gstinValue);
        setGstinValidation({ isValidating: false, result });

        // Auto-fill state if valid
        if (result.isValid && result.stateName) {
          const stateOption = INDIAN_STATES.find(
            (s) => s.label.toLowerCase() === result.stateName?.toLowerCase()
          );
          if (stateOption) {
            setValue('state', stateOption.value);
          }
        }
      } catch (error) {
        setGstinValidation({ isValidating: false, result: null });
      }
    };

    const debounce = setTimeout(validateGstin, 500);
    return () => clearTimeout(debounce);
  }, [gstinValue, setValue]);

  const onSubmit = async (data: OrganizationFormData) => {
    // Check GSTIN validation
    if (gstinValidation.result && !gstinValidation.result.isValid) {
      Alert.alert('Invalid GSTIN', gstinValidation.result.errorMessage || 'Please enter a valid GSTIN');
      return;
    }

    try {
      await completeOnboarding({
        name: data.name,
        gstin: data.gstin.toUpperCase(),
        state: INDIAN_STATES.find((s) => s.value === data.state)?.label || data.state,
        city: data.city || undefined,
        industry: data.industry || undefined,
        annualTurnoverRange: data.annualTurnoverRange || undefined,
      });

      router.replace('/(onboarding)/complete');
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to create organization';

      // Handle specific errors
      if (message.includes('GSTIN_EXISTS')) {
        Alert.alert('GSTIN Already Registered', 'This GSTIN is already registered with another organization.');
      } else if (message.includes('ORG_NAME_EXISTS')) {
        Alert.alert('Name Already Taken', 'An organization with this name already exists.');
      } else {
        showToast('error', message);
      }
    }
  };

  const getStateLabel = (value: string) => {
    return INDIAN_STATES.find((s) => s.value === value)?.label || 'Select State';
  };

  const getIndustryLabel = (value: string) => {
    return INDUSTRY_OPTIONS.find((i) => i.value === value)?.label || 'Select Industry (Optional)';
  };

  const getTurnoverLabel = (value: string) => {
    return TURNOVER_OPTIONS.find((t) => t.value === value)?.label || 'Select Turnover Range (Optional)';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Organization Details</Text>
          <Text style={styles.subtitle}>
            Enter your business information to get started
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Organization Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Organization Name *</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={[styles.inputContainer, errors.name && styles.inputError]}>
                  <Building2 size={20} color={COLORS.gray[400]} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your Company Name"
                    placeholderTextColor={COLORS.gray[400]}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                  />
                </View>
              )}
            />
            {errors.name && (
              <Text style={styles.errorText}>{errors.name.message}</Text>
            )}
          </View>

          {/* GSTIN */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>GSTIN *</Text>
            <Controller
              control={control}
              name="gstin"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  style={[
                    styles.inputContainer,
                    errors.gstin && styles.inputError,
                    gstinValidation.result?.isValid && styles.inputSuccess,
                    gstinValidation.result?.isValid === false && styles.inputError,
                  ]}
                >
                  <FileText size={20} color={COLORS.gray[400]} />
                  <TextInput
                    style={styles.input}
                    placeholder="22AAAAA0000A1Z5"
                    placeholderTextColor={COLORS.gray[400]}
                    value={value}
                    onChangeText={(text) => onChange(text.toUpperCase())}
                    onBlur={onBlur}
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                  {gstinValidation.isValidating && (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  )}
                  {!gstinValidation.isValidating && gstinValidation.result?.isValid && (
                    <Check size={20} color={COLORS.success} />
                  )}
                  {!gstinValidation.isValidating &&
                    gstinValidation.result?.isValid === false && (
                      <AlertCircle size={20} color={COLORS.error} />
                    )}
                </View>
              )}
            />
            {errors.gstin && (
              <Text style={styles.errorText}>{errors.gstin.message}</Text>
            )}
            {gstinValidation.result?.isValid === false && (
              <Text style={styles.errorText}>
                {gstinValidation.result.errorMessage}
              </Text>
            )}
            {gstinValidation.result?.isValid && gstinValidation.result.stateName && (
              <Text style={styles.helperText}>
                State: {gstinValidation.result.stateName}
              </Text>
            )}
          </View>

          {/* State */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>State *</Text>
            <Controller
              control={control}
              name="state"
              render={({ field: { value } }) => (
                <TouchableOpacity
                  style={[styles.inputContainer, errors.state && styles.inputError]}
                  onPress={() => setShowStatePicker(true)}
                >
                  <MapPin size={20} color={COLORS.gray[400]} />
                  <Text
                    style={[styles.pickerText, !value && styles.pickerPlaceholder]}
                  >
                    {getStateLabel(value)}
                  </Text>
                  <ChevronDown size={20} color={COLORS.gray[400]} />
                </TouchableOpacity>
              )}
            />
            {errors.state && (
              <Text style={styles.errorText}>{errors.state.message}</Text>
            )}
          </View>

          {/* City */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <Controller
              control={control}
              name="city"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <MapPin size={20} color={COLORS.gray[400]} />
                  <TextInput
                    style={styles.input}
                    placeholder="City (Optional)"
                    placeholderTextColor={COLORS.gray[400]}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                  />
                </View>
              )}
            />
          </View>

          {/* Industry */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Industry</Text>
            <Controller
              control={control}
              name="industry"
              render={({ field: { value } }) => (
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => setShowIndustryPicker(true)}
                >
                  <Building2 size={20} color={COLORS.gray[400]} />
                  <Text
                    style={[styles.pickerText, !value && styles.pickerPlaceholder]}
                  >
                    {getIndustryLabel(value || '')}
                  </Text>
                  <ChevronDown size={20} color={COLORS.gray[400]} />
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Annual Turnover */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Annual Turnover</Text>
            <Controller
              control={control}
              name="annualTurnoverRange"
              render={({ field: { value } }) => (
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => setShowTurnoverPicker(true)}
                >
                  <FileText size={20} color={COLORS.gray[400]} />
                  <Text
                    style={[styles.pickerText, !value && styles.pickerPlaceholder]}
                  >
                    {getTurnoverLabel(value || '')}
                  </Text>
                  <ChevronDown size={20} color={COLORS.gray[400]} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            title={isLoading ? 'Creating...' : 'Create Organization'}
            onPress={handleSubmit(onSubmit)}
            variant="primary"
            fullWidth
            disabled={isLoading}
            loading={isLoading}
          />
        </View>
      </ScrollView>

      {/* State Picker Modal */}
      {showStatePicker && (
        <PickerModal
          title="Select State"
          options={INDIAN_STATES}
          value={watch('state')}
          onSelect={(value) => {
            setValue('state', value);
            setShowStatePicker(false);
          }}
          onClose={() => setShowStatePicker(false)}
        />
      )}

      {/* Industry Picker Modal */}
      {showIndustryPicker && (
        <PickerModal
          title="Select Industry"
          options={INDUSTRY_OPTIONS as any}
          value={watch('industry') || ''}
          onSelect={(value) => {
            setValue('industry', value);
            setShowIndustryPicker(false);
          }}
          onClose={() => setShowIndustryPicker(false)}
        />
      )}

      {/* Turnover Picker Modal */}
      {showTurnoverPicker && (
        <PickerModal
          title="Select Annual Turnover"
          options={TURNOVER_OPTIONS as any}
          value={watch('annualTurnoverRange') || ''}
          onSelect={(value) => {
            setValue('annualTurnoverRange', value);
            setShowTurnoverPicker(false);
          }}
          onClose={() => setShowTurnoverPicker(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// Simple Picker Modal Component
function PickerModal({
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <View style={pickerStyles.overlay}>
      <TouchableOpacity style={pickerStyles.backdrop} onPress={onClose} />
      <View style={pickerStyles.container}>
        <View style={pickerStyles.header}>
          <Text style={pickerStyles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={pickerStyles.closeButton}>
            <X size={24} color={COLORS.gray[500]} />
          </TouchableOpacity>
        </View>
        <ScrollView style={pickerStyles.optionsList}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                pickerStyles.option,
                value === option.value && pickerStyles.optionSelected,
              ]}
              onPress={() => onSelect(option.value)}
            >
              <Text
                style={[
                  pickerStyles.optionText,
                  value === option.value && pickerStyles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
              {value === option.value && (
                <Check size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
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
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
  form: {
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputSuccess: {
    borderColor: COLORS.success,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
    paddingVertical: 0,
  },
  pickerText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  pickerPlaceholder: {
    color: COLORS.gray[400],
  },
  errorText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  helperText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    marginTop: SPACING.xs,
  },
  submitContainer: {
    marginTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  closeButton: {
    padding: SPACING.xs,
  },
  optionsList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[50],
  },
  optionSelected: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.md,
    borderBottomColor: 'transparent',
  },
  optionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[700],
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: '500',
  },
});
