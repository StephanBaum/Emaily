import { useRouter } from 'expo-router';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuthContext } from '../../src/contexts/AuthContext';

/**
 * Settings item props
 */
interface SettingsItemProps {
  label: string;
  value?: string;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  onPress?: () => void;
}

/**
 * Settings item component
 */
function SettingsItem({
  label,
  value,
  hasSwitch,
  switchValue,
  onSwitchChange,
  onPress,
}: SettingsItemProps): JSX.Element {
  const content = (
    <View style={styles.settingsItem}>
      <Text style={styles.settingsLabel}>{label}</Text>
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#ddd', true: '#0078d4' }}
          thumbColor="#fff"
        />
      ) : value ? (
        <Text style={styles.settingsValue}>{value}</Text>
      ) : (
        <Text style={styles.settingsArrow}>›</Text>
      )}
    </View>
  );

  if (onPress && !hasSwitch) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

/**
 * Settings section component
 */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

/**
 * Settings screen
 *
 * Provides app configuration options including:
 * - Account management
 * - Notification settings
 * - AI preferences
 * - Theme settings
 * - About/version info
 */
export default function SettingsScreen(): JSX.Element {
  const router = useRouter();
  const { signOut } = useAuthContext();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleSignOut = (): void => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(auth)/login');
            } catch {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        <SettingsSection title="Account">
          <SettingsItem
            label="Email Account"
            value="user@example.com"
            onPress={() => {
              // TODO: Navigate to account details
            }}
          />
          <SettingsItem
            label="Connected Accounts"
            onPress={() => {
              // TODO: Navigate to connected accounts
            }}
          />
        </SettingsSection>

        {/* Notifications Section */}
        <SettingsSection title="Notifications">
          <SettingsItem
            label="Push Notifications"
            hasSwitch
            switchValue={pushNotifications}
            onSwitchChange={setPushNotifications}
          />
        </SettingsSection>

        {/* AI Settings Section */}
        <SettingsSection title="AI Features">
          <SettingsItem
            label="Smart Suggestions"
            hasSwitch
            switchValue={aiSuggestions}
            onSwitchChange={setAiSuggestions}
          />
          <SettingsItem
            label="AI Provider"
            value="OpenAI"
            onPress={() => {
              // TODO: Navigate to AI provider settings
            }}
          />
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection title="Appearance">
          <SettingsItem
            label="Dark Mode"
            hasSwitch
            switchValue={darkMode}
            onSwitchChange={setDarkMode}
          />
        </SettingsSection>

        {/* About Section */}
        <SettingsSection title="About">
          <SettingsItem label="Version" value="1.0.0" />
          <SettingsItem
            label="Privacy Policy"
            onPress={() => {
              // TODO: Open privacy policy
            }}
          />
          <SettingsItem
            label="Terms of Service"
            onPress={() => {
              // TODO: Open terms of service
            }}
          />
        </SettingsSection>

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  settingsLabel: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  settingsValue: {
    fontSize: 16,
    color: '#666',
  },
  settingsArrow: {
    fontSize: 20,
    color: '#999',
  },
  signOutContainer: {
    marginTop: 32,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  signOutButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#dc2626',
  },
});
