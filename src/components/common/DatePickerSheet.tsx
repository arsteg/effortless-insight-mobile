/**
 * Date picker (TC-MOB-043).
 *
 * Written in plain React Native rather than pulling in a native date picker:
 * a native module needs a rebuild of both apps, and the platform pickers look
 * and behave differently enough on iOS and Android to need separate handling.
 * This renders identically on both, and the grid maths is tested in
 * `utils/calendar.ts`.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import {
  WEEKDAY_LABELS,
  MONTH_LABELS,
  buildMonthGrid,
  shiftMonth,
  isSameDay,
  isPastDay,
  toDueDateIso,
  addDays,
} from '../../utils/calendar';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { useColors, useThemedStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/palettes';
import { useTranslation } from '../../hooks';

interface DatePickerSheetProps {
  visible: boolean;
  /** Currently selected date as an ISO string, if any. */
  value?: string;
  title?: string;
  /**
   * Block days before today. The API's `CreateTaskValidator` requires
   * "Due date must be in the future", so offering a past date on a create form
   * produces a 400 the user cannot act on (TC-MOB-044).
   */
  disablePast?: boolean;
  onClose: () => void;
  /** Receives an ISO instant, or undefined when the date is cleared. */
  onSelect: (iso: string | undefined) => void;
}

/** Offsets offered as one-tap shortcuts, since most due dates are near. */
const QUICK_PICKS: ReadonlyArray<{ label: string; days: number }> = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
];

export function DatePickerSheet({
  visible,
  value,
  title = 'Due date',
  disablePast = false,
  onClose,
  onSelect,
}: DatePickerSheetProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const today = useMemo(() => new Date(), []);

  const selected = useMemo(() => {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [value]);

  // The month on screen. Opens on the selected date's month so an existing
  // due date is visible rather than needing to be navigated back to.
  const [cursor, setCursor] = useState(() => {
    const anchor = selected ?? today;
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const pick = (day: number) => {
    onSelect(toDueDateIso(cursor.year, cursor.month, day));
    onClose();
  };

  const pickOffset = (days: number) => {
    const date = addDays(today, days);
    onSelect(toDueDateIso(date.getFullYear(), date.getMonth(), date.getDate()));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={22} color={COLORS.gray[500]} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
          >
            {QUICK_PICKS.map((quick) => (
              <TouchableOpacity
                key={quick.label}
                style={styles.quickChip}
                onPress={() => pickOffset(quick.days)}
                accessibilityRole="button"
              >
                <Text style={styles.quickChipText}>{quick.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={22} color={COLORS.gray[600]} />
            </TouchableOpacity>

            <Text style={styles.monthLabel}>
              {MONTH_LABELS[cursor.month]} {cursor.year}
            </Text>

            <TouchableOpacity
              onPress={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronRight size={22} color={COLORS.gray[600]} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={index} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (day === null) {
                return <View key={`blank-${index}`} style={styles.cell} />;
              }

              const date = new Date(cursor.year, cursor.month, day);
              const isSelected = selected ? isSameDay(date, selected) : false;
              const isToday = isSameDay(date, today);
              const isPast = isPastDay(date, today);
              const isDisabled = disablePast && isPast;

              return (
                <TouchableOpacity
                  key={day}
                  style={styles.cell}
                  onPress={() => pick(day)}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={`${day} ${MONTH_LABELS[cursor.month]} ${cursor.year}`}
                  accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                >
                  <Text
                    style={[
                      styles.cellText,
                      isPast && styles.cellTextPast,
                      isDisabled && styles.cellTextDisabled,
                      isToday && styles.cellTextToday,
                      isSelected && styles.cellTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {value && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                onSelect(undefined);
                onClose();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.clearButtonText}>{t('components.clearDueDate')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
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
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  quickRow: {
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  quickChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray[100],
  },
  quickChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  monthLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gray[400],
    paddingVertical: SPACING.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    width: 34,
    height: 34,
    lineHeight: 34,
    textAlign: 'center',
    borderRadius: 17,
    overflow: 'hidden',
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[900],
  },
  cellTextPast: {
    color: COLORS.gray[400],
  },
  cellTextDisabled: {
    color: COLORS.gray[300],
  },
  cellTextToday: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  cellTextSelected: {
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontWeight: '600',
  },
  clearButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.error,
  },
});
