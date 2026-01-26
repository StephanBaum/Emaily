import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

/**
 * Compose screen - create new email
 *
 * Provides a form for composing new emails with:
 * - To, CC, BCC fields
 * - Subject field
 * - Body editor
 * - AI assist button (placeholder)
 */
export default function ComposeScreen(): JSX.Element {
  const router = useRouter();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);

  const handleSend = (): void => {
    // TODO: Implement send functionality
    router.back();
  };

  const handleAiAssist = (): void => {
    // TODO: Implement AI assistance
  };

  const canSend = to.trim().length > 0 && subject.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* To field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>To:</Text>
            <TextInput
              style={styles.fieldInput}
              value={to}
              onChangeText={setTo}
              placeholder="recipient@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!showCc && (
              <TouchableOpacity
                style={styles.ccToggle}
                onPress={() => setShowCc(true)}
              >
                <Text style={styles.ccToggleText}>Cc/Bcc</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* CC field (optional) */}
          {showCc && (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Cc:</Text>
              <TextInput
                style={styles.fieldInput}
                value={cc}
                onChangeText={setCc}
                placeholder="cc@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {/* Subject field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Subject:</Text>
            <TextInput
              style={styles.fieldInput}
              value={subject}
              onChangeText={setSubject}
              placeholder="Email subject"
              placeholderTextColor="#999"
            />
          </View>

          {/* Body editor */}
          <View style={styles.bodyContainer}>
            <TextInput
              style={styles.bodyInput}
              value={body}
              onChangeText={setBody}
              placeholder="Write your message..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={handleAiAssist}
          >
            <Text style={styles.aiButtonText}>✨ AI Assist</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!canSend}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  fieldLabel: {
    width: 60,
    fontSize: 15,
    color: '#666',
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    paddingVertical: 0,
  },
  ccToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ccToggleText: {
    fontSize: 14,
    color: '#0078d4',
  },
  bodyContainer: {
    flex: 1,
    padding: 16,
    minHeight: 200,
  },
  bodyInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  aiButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  sendButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0078d4',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
