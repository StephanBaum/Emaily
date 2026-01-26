import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

/**
 * Tab icon component
 *
 * Simple icon placeholder that displays emoji icons.
 * In a real app, this would use proper icon library like @expo/vector-icons.
 */
function TabIcon({
  icon,
  color,
  focused,
}: {
  icon: string;
  color: string;
  focused: boolean;
}): JSX.Element {
  return (
    <View style={[styles.iconContainer, focused && styles.iconFocused]}>
      <Text style={[styles.icon, { color }]}>{icon}</Text>
    </View>
  );
}

/**
 * Tabs layout for the main app
 *
 * Provides bottom tab navigation for:
 * - Inbox (main email list)
 * - Compose (new email)
 * - Settings (app settings)
 */
export default function TabsLayout(): JSX.Element {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0078d4',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        headerShown: true,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="📥" color={color} focused={focused} />
          ),
          headerTitle: 'Inbox',
        }}
      />
      <Tabs.Screen
        name="compose"
        options={{
          title: 'Compose',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="✏️" color={color} focused={focused} />
          ),
          headerTitle: 'New Email',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="⚙️" color={color} focused={focused} />
          ),
          headerTitle: 'Settings',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  iconFocused: {
    transform: [{ scale: 1.1 }],
  },
  icon: {
    fontSize: 22,
  },
});
