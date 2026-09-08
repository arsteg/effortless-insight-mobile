/**
 * New Support Ticket Screen
 */

import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useCreateSupportTicket } from '../../src/hooks/useSupport';
import { SupportTicketCategory } from '../../src/services/api/support';
import { Button, Input } from '../../src/components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';

const CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: 'question', label: 'Question' },
  { value: 'problem', label: 'Problem / bug' },
  { value: 'billing', label: 'Billing' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'other', label: 'Other' },
];

export default function NewSupportTicketScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('question');
  const [message, setMessage] = useState('');

  const createMutation = useCreateSupportTicket();

  const canSubmit =
    subject.trim().length > 0 && message.trim().length > 0 && !createMutation.isPending;

  const handleSubmit = () => {
    createMutation.mutate(
      { subject: subject.trim(), category, message: message.trim() },
      {
        onSuccess: (ticket) => {
          router.replace(`/support/${ticket.id}`);
        },
        onError: () => {
          Alert.alert('Could not create ticket', 'Please try again in a moment.');
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Describe the issue and we&apos;ll get back to you — usually within one
          business day. You&apos;ll see our reply right here in the app.
        </Text>

        <Input
          label="Subject"
          value={subject}
          maxLength={200}
          placeholder="Short summary of the issue"
          onChangeText={setSubject}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categories}>
          {CATEGORIES.map((option) => {
            const selected = option.value === category;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                onPress={() => setCategory(option.value)}
              >
                <Text
                  style={[styles.categoryText, selected && styles.categoryTextSelected]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Message"
          value={message}
          placeholder="What happened? Include the notice or screen involved if relevant."
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          style={styles.messageInput}
        />

        <Button
          title="Create ticket"
          fullWidth
          loading={createMutation.isPending}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={styles.submitButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    padding: SPACING.md,
  },
  intro: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[600],
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: SPACING.xs,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  categoryChip: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.white,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[700],
  },
  categoryTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  messageInput: {
    minHeight: 120,
  },
  submitButton: {
    marginTop: SPACING.md,
  },
});
