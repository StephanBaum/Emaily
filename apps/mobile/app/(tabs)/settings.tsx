import { useRouter, router } from 'expo-router';
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
import { useEffect, useState } from 'react';
import * as NotificationService from '../../src/services/notifications';
import { useAuth } from '@/hooks/useAuth';

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
  const { user, accessToken, isAuthenticated } = useAuth();
  const [pushNotifications, setPushNotifications] = useState(false);
  const [isProcessingNotifications, setIsProcessingNotifications] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  /**
   * Load initial notification permission status
   */
  useEffect(() => {
    const loadNotificationStatus = async (): Promise<void> => {
      try {
        // Check if notifications are supported
        if (!NotificationService.isPushNotificationSupported()) {
          return;
        }

        // Get current permission status
        const status = await NotificationService.getNotificationPermissionStatus();
        setPushNotifications(status === 'granted');
      } catch (error) {
        // Silently fail - will default to false
      }
    };

    loadNotificationStatus();
  }, []);

  /**
   * Handle push notification toggle
   */
  const handlePushNotificationsChange = async (value: boolean): Promise<void> => {
    // Prevent multiple simultaneous operations
    if (isProcessingNotifications) {
      return;
    }

    // Check if user is authenticated
    if (!isAuthenticated || !accessToken) {
      Alert.alert(
        'Authentication Required',
        'Please sign in to enable push notifications.',
        [
          {
            text: 'Sign In',
            onPress: () => {
              // Navigate to sign-in screen
              // Adjust based on your navigation structure
              router.push('/(auth)/sign-in');
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      setPushNotifications(false);
      return;
    }

    // Check if notifications are supported
    if (!NotificationService.isPushNotificationSupported()) {
      Alert.alert(
        'Not Supported',
        'Push notifications are only available on physical devices.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsProcessingNotifications(true);

    try {
      if (value) {
        // Enabling notifications
        // Step 1: Request permissions
        const { status, canAskAgain } = await NotificationService.requestPermissions();

        if (status !== 'granted') {
          // Permission denied
          Alert.alert(
            'Permission Denied',
            canAskAgain
              ? 'Please enable notifications in your device settings to receive updates.'
              : 'Notification permissions were denied. Please enable them in your device settings.',
            [{ text: 'OK' }]
          );
          setPushNotifications(false);
          setIsProcessingNotifications(false);
          return;
        }

        // Step 2: Register device with backend using real access token
        try {
          const { success, error } = await NotificationService.registerForPushNotifications(
            accessToken  // Use real token from auth context
          );

          if (success) {
            setPushNotifications(true);
            Alert.alert(
              'Notifications Enabled',
              'You will now receive push notifications for important emails.',
              [{ text: 'OK' }]
            );
          } else {
            // Registration failed
            Alert.alert(
              'Registration Failed',
              error || 'Failed to register device for push notifications. Please try again.',
              [{ text: 'OK' }]
            );
            setPushNotifications(false);
          }
        } catch (error) {
          // Backend registration error
          Alert.alert(
            'Error',
            'Failed to communicate with notification service. Please check your internet connection and try again.',
            [{ text: 'OK' }]
          );
          setPushNotifications(false);
        }
      } else {
        // Disabling notifications
        try {
          const { success } = await NotificationService.unregisterFromPushNotifications(
            accessToken  // Use real token from auth context
          );

          if (success) {
            setPushNotifications(false);
            Alert.alert(
              'Notifications Disabled',
              'Push notifications have been disabled. You can re-enable them at any time.',
              [{ text: 'OK' }]
            );
          } else {
            // Unregistration failed
            Alert.alert(
              'Unregistration Failed',
              'Failed to unregister device. Please try again.',
              [{ text: 'OK' }]
            );
            // Keep current state
          }
        } catch (error) {
          Alert.alert(
            'Error',
            'Failed to communicate with notification service.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      // Unexpected error
      Alert.alert(
        'Unexpected Error',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
        [{ text: 'OK' }]
      );
      setPushNotifications(false);
    } finally {
      setIsProcessingNotifications(false);
    }
  };

  const handleSignOut = (): void => {
    // TODO: Implement sign out
    router.replace('/(auth)/login');
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
            onSwitchChange={handlePushNotificationsChange}
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
