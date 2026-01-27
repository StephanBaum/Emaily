import React, { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAISettings } from '../../src/hooks/useAISettings';

/**
 * AI Provider Settings Screen
 *
 * Allows users to configure their OpenAI API key for AI features.
 * Provides secure input for the API key and instructions for obtaining one.
 *
 * @example
 * ```tsx
 * // Navigation from settings
 * router.push('/settings/ai-provider')
 * ```
 */
export default function AIProviderScreen(): JSX.Element {
  const router = useRouter();
  const { settings, isLoading, isUpdating, updateSettings } = useAISettings();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Load existing API key when settings load
  useEffect(() => {
    if (settings?.openAiApiKey) {
      setApiKey(settings.openAiApiKey); // Will be masked like "sk-...xyz1"
    }
  }, [settings]);

  /**
   * Handle save API key
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    // Basic validation for OpenAI API key format (starts with 'sk-')
    if (!apiKey.startsWith('sk-')) {
      Alert.alert(
        'Invalid API Key',
        'OpenAI API keys typically start with "sk-". Please verify your key.'
      );
      return;
    }

    try {
      await updateSettings({ openAiApiKey: apiKey });
      Alert.alert('Success', 'API key saved successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to save API key'
      );
    }
  }, [apiKey, updateSettings, router]);

  /**
   * Handle cancel and go back
   */
  const handleCancel = useCallback((): void => {
    if (apiKey.trim() && apiKey !== settings?.openAiApiKey) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [apiKey, settings, router]);

  // Show loading state while fetching settings
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading AI settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>OpenAI Configuration</Text>
          <Text style={styles.headerDescription}>
            Configure your OpenAI API key to enable AI-powered features in the app.
          </Text>
        </View>

        {/* API Key Input Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Key</Text>
          <View style={styles.sectionContent}>
            <Text style={styles.inputLabel}>OpenAI API Key</Text>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isUpdating}
            />
            <Pressable
              style={styles.showKeyButton}
              onPress={() => setShowApiKey(!showApiKey)}
            >
              <Text style={styles.showKeyText}>
                {showApiKey ? 'Hide' : 'Show'} API Key
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Instructions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Get Your API Key</Text>
          <View style={styles.instructionsContent}>
            <Text style={styles.instructionStep}>
              1. Visit{' '}
              <Text style={styles.link}>platform.openai.com</Text>
            </Text>
            <Text style={styles.instructionStep}>
              2. Sign in or create an account
            </Text>
            <Text style={styles.instructionStep}>
              3. Navigate to API Keys section
            </Text>
            <Text style={styles.instructionStep}>
              4. Create a new secret key
            </Text>
            <Text style={styles.instructionStep}>
              5. Copy and paste the key above
            </Text>
          </View>
        </View>

        {/* Security Notice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Notice</Text>
          <View style={styles.noticeContent}>
            <Text style={styles.noticeText}>
              Your API key is stored securely on your device and is never shared
              with our servers. It will only be used to make direct requests to
              OpenAI on your behalf.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isUpdating}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={isUpdating}
          >
            <Text style={styles.saveButtonText}>
              {isUpdating ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
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
  scrollContent: {
    paddingBottom: 32,
  },
  // Header
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
  },
  // Section
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  // Input
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  showKeyButton: {
    alignSelf: 'flex-start',
  },
  showKeyText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  // Instructions
  instructionsContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  instructionStep: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 8,
  },
  link: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  // Notice
  noticeContent: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#bfdbfe',
  },
  noticeText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  // Actions
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 32,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
});
