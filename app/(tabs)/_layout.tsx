/**
 * Tab Navigation Layout
 */

import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Home, FileText, Camera, CheckSquare, Bell, User, CalendarDays } from 'lucide-react-native';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/utils/constants';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { useColors, useThemedStyles } from '../../src/theme/useTheme';
import type { Palette } from '../../src/theme/palettes';

function NotificationTabIcon({ color, size }: { color: string; size: number }) {
  const styles = useThemedStyles(createStyles);
  const { data } = useUnreadCount();
  const count = data?.unreadCount ?? 0;

  return (
    <View style={styles.notificationIconContainer}>
      <Bell color={color} size={size} />
      {count > 0 && (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>
            {count > 9 ? '9+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}

function CalendarHeaderButton() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push('/calendar')}
      style={styles.headerButton}
      accessibilityRole="button"
      accessibilityLabel="Open deadline calendar"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <CalendarDays color={COLORS.primary} size={22} />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const styles = useThemedStyles(createStyles);
  const COLORS = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray[400],
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.gray[200],
          paddingBottom: 6,
          paddingTop: 6,
          height: 62,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: COLORS.white,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.gray[200],
        },
        headerShadowVisible: false,
        headerTintColor: COLORS.gray[900],
        headerTitleStyle: {
          fontWeight: '800',
          color: COLORS.gray[900],
          letterSpacing: -0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          headerTitle: 'EffortlessInsight',
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: 'Notices',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
          headerTitle: 'Notices',
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.scanButton, focused && styles.scanButtonActive]}>
              <Camera color={COLORS.white} size={24} />
            </View>
          ),
          headerTitle: 'Scan Notice',
          tabBarLabel: () => null, // Hide label for center button
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
          headerTitle: 'My Tasks',
          // The calendar lives here rather than as a seventh tab: it shows the
          // deadlines of these tasks (and of notices), and seven tabs does not
          // fit a phone's bottom bar (TC-MOB-047).
          headerRight: () => <CalendarHeaderButton />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <NotificationTabIcon color={color as string} size={size} />
          ),
          headerTitle: 'Notifications',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          headerTitle: 'Profile',
        }}
      />
    </Tabs>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
  headerButton: {
    marginRight: SPACING.md,
  },
  scanButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scanButtonActive: {
    backgroundColor: COLORS.primaryDark,
  },
  notificationIconContainer: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
});
