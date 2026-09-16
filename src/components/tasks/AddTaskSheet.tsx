/**
 * Create a task from anywhere that has a date but no notice (TC-MOB-048).
 *
 * The notice picker is what makes this different from the modal on the notice
 * screen: a task's `NoticeId` is a non-nullable foreign key, so a task added
 * from the calendar still has to be attached to something. Rather than invent a
 * device-only reminder that nobody else on the team can see, this asks which
 * notice the work belongs to.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Search, FileText, Check, ChevronLeft, Calendar } from 'lucide-react-native';
import { DatePickerSheet } from '../common/DatePickerSheet';
import { useNotices } from '../../hooks/useNotices';
import { useCreateTask } from '../../hooks/useTasks';
import { useUIStore } from '../../stores';
import { scheduleTaskReminders } from '../../services/taskReminders';
import { getApiErrorMessage } from '../../services/api/client';
import {
  TASK_PRIORITIES,
  priorityLabel,
  priorityColor,
  validateTaskTitle,
  isTaskTitleSubmittable,
  TASK_TITLE_MAX,
  formatDueDate,
} from '../../utils/taskDisplay';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';
import { useTranslation } from '../../hooks';

interface AddTaskSheetProps {
  visible: boolean;
  /**
   * Due date to start from — the day tapped on the calendar. Only a starting
   * value: the sheet is also opened from the task list with nothing selected,
   * so the date has to be editable here rather than fixed by the caller
   * (TC-MOB-044).
   */
  dueDate?: string;
  onClose: () => void;
  onCreated?: () => void;
}

interface PickedNotice {
  id: string;
  label: string;
}

export function AddTaskSheet({ visible, dueDate, onClose, onCreated }: AddTaskSheetProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const showToast = useUIStore((state) => state.showToast);
  const createTask = useCreateTask();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [notice, setNotice] = useState<PickedNotice | null>(null);
  const [pickingNotice, setPickingNotice] = useState(false);
  const [due, setDue] = useState<string | undefined>(dueDate);
  const [showDuePicker, setShowDuePicker] = useState(false);

  // Follow the caller's date when the sheet is reopened on a different day.
  React.useEffect(() => {
    if (visible) setDue(dueDate);
  }, [visible, dueDate]);

  const titleError = validateTaskTitle(title);
  const canSubmit = isTaskTitleSubmittable(title) && !!notice && !createTask.isPending;

  const reset = () => {
    setTitle('');
    setPriority('medium');
    setNotice(null);
    setPickingNotice(false);
    setDue(dueDate);
    setShowDuePicker(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!canSubmit || !notice) return;

    try {
      const created = await createTask.mutateAsync({
        noticeId: notice.id,
        data: {
          title: title.trim(),
          priority: priority as never,
          dueDate: due,
          // Omitted so the server assigns the creator; [] fails validation.
        },
      });

      // A reminder that fails to schedule must not fail the task.
      const scheduled = await scheduleTaskReminders(
        created.id,
        created.title,
        due,
        priority
      );

      showToast(
        'success',
        scheduled > 0 ? 'Task created. Reminder set.' : 'Task created.'
      );
      reset();
      onCreated?.();
      onClose();
    } catch (error) {
      showToast('error', getApiErrorMessage(error));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {pickingNotice ? (
            <NoticePicker
              onPick={(picked) => {
                setNotice(picked);
                setPickingNotice(false);
              }}
              onBack={() => setPickingNotice(false)}
            />
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{t('components.newTask')}</Text>
                  {due && <Text style={styles.subtitle}>Due {formatDueDate(due)}</Text>}
                </View>
                <TouchableOpacity
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={22} color={COLORS.gray[500]} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>{t('components.title')}</Text>
                <TextInput
                  style={[styles.input, titleError && styles.inputError]}
                  placeholder={t('components.whatNeedsDoing')}
                  placeholderTextColor={COLORS.gray[400]}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={TASK_TITLE_MAX}
                />
                {titleError && <Text style={styles.errorText}>{titleError}</Text>}

                <Text style={styles.label}>{t('components.notice')}</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setPickingNotice(true)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    notice ? `Notice: ${notice.label}. Change` : 'Choose a notice'
                  }
                >
                  <FileText size={16} color={COLORS.gray[500]} />
                  <Text style={[styles.pickerText, !notice && styles.pickerPlaceholder]}>
                    {notice?.label ?? 'Choose a notice'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.label}>{t('components.dueDate')}</Text>
                <View style={styles.dueRow}>
                  <TouchableOpacity
                    style={[styles.picker, styles.duePicker]}
                    onPress={() => setShowDuePicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel={due ? `Due ${formatDueDate(due)}. Change` : 'Set a due date'}
                  >
                    <Calendar size={16} color={COLORS.gray[500]} />
                    <Text style={[styles.pickerText, !due && styles.pickerPlaceholder]}>
                      {due ? formatDueDate(due) : t('components.noDueDate')}
                    </Text>
                  </TouchableOpacity>
                  {due && (
                    <TouchableOpacity
                      onPress={() => setDue(undefined)}
                      style={styles.clearDue}
                      accessibilityRole="button"
                      accessibilityLabel="Clear due date"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={16} color={COLORS.gray[500]} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.label}>{t('components.priority')}</Text>
                <View style={styles.priorityRow}>
                  {TASK_PRIORITIES.map((value) => {
                    const active = priority === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        style={[
                          styles.priorityChip,
                          { borderColor: priorityColor(value) },
                          active && { backgroundColor: priorityColor(value) },
                        ]}
                        onPress={() => setPriority(value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[styles.priorityChipText, active && styles.priorityChipTextActive]}
                        >
                          {priorityLabel(value)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.hint}>
                  {priority === 'critical' || priority === 'high'
                    ? 'You will be reminded the day before and on the day.'
                    : 'You will be reminded on the morning it is due.'}
                </Text>
              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelButton} onPress={close}>
                  <Text style={styles.cancelText}>{t('components.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
                  onPress={submit}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                >
                  <Text style={styles.submitText}>
                    {createTask.isPending ? 'Creating...' : 'Create task'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
        {/*
          Nested INSIDE this modal on purpose. iOS presents one modal at a
          time, so a sibling <Modal> opened while this sheet is up never
          appears — the picker would silently do nothing and the due date stay
          unset. That exact bug already bit the notice-screen form (TC-MOB-044).
        */}
        <DatePickerSheet
          visible={showDuePicker}
          value={due}
          disablePast
          onClose={() => setShowDuePicker(false)}
          onSelect={setDue}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Searchable list of notices to attach the task to. */
function NoticePicker({
  onPick,
  onBack,
}: {
  onPick: (notice: PickedNotice) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useNotices({
    search: search.trim() || undefined,
    pageSize: 30,
  });

  const notices = useMemo(() => data?.notices ?? [], [data]);

  return (
    <View style={styles.pickerPanel}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={22} color={COLORS.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('components.chooseANotice')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchRow}>
        <Search size={16} color={COLORS.gray[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('components.searchNotices')}
          placeholderTextColor={COLORS.gray[400]}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View style={styles.pickerLoading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : notices.length === 0 ? (
        <Text style={styles.pickerEmpty}>{t('components.noNoticesFound')}</Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {notices.map((n) => {
            const label = n.noticeNumber || n.noticeType || `Notice ${n.id.slice(0, 8)}`;
            return (
              <TouchableOpacity
                key={n.id}
                style={styles.noticeRow}
                onPress={() => onPick({ id: n.id, label })}
                accessibilityRole="button"
              >
                <FileText size={16} color={COLORS.gray[400]} />
                <View style={styles.noticeBody}>
                  <Text style={styles.noticeLabel} numberOfLines={1}>
                    {label}
                  </Text>
                  {n.noticeType && n.noticeNumber && (
                    <Text style={styles.noticeType}>{n.noticeType}</Text>
                  )}
                </View>
                <Check size={16} color={COLORS.gray[300]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerText: {
    flex: 1,
  },
  headerSpacer: {
    width: 22,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[500],
    marginTop: 2,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  duePicker: {
    flex: 1,
  },

  clearDue: {
    padding: SPACING.xs,
  },

  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  pickerText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  pickerPlaceholder: {
    color: COLORS.gray[400],
  },
  priorityRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  priorityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  priorityChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  priorityChipTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  hint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
    marginTop: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
  },
  cancelText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  submitDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  submitText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  pickerPanel: {
    minHeight: 320,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.gray[100],
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  pickerLoading: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  pickerEmpty: {
    padding: SPACING.xl,
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray[400],
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  noticeBody: {
    flex: 1,
  },
  noticeLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  noticeType: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[500],
  },
});
