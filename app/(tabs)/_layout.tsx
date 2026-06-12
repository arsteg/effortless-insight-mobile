/**
 * Tab Navigation Layout
 */

import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Home, FileText, Camera, CheckSquare, User } from 'lucide-react-native';
import { COLORS, SPACING } from '../../src/utils/constants';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray[400],
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.gray[200],
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: 'bold',
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

const styles = StyleSheet.create({
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
});
