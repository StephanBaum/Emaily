import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
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
import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { useAuthContext } from '../../src/contexts/AuthContext';

/**
 * API URL from app configuration
 */
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

/**
 * Compose mode - new email, reply, or forward
 */
type ComposeMode = 'new' | 'reply' | 'forward';

/**
 * URL parameters passed to compose screen
 */
interface ComposeParams {
  mode?: ComposeMode;
  replyToId?: string;
  forwardId?: string;
  to?: string;
  subject?: string;
  body?: string;
}

/**
 * Generate reply subject from original
 */
function getReplySubject(subject: string): string {
  if (subject.toLowerCase().startsWith('re:')) {
    return subject;
  }
  return `Re: ${subject}`;
}

/**
 * Generate forward subject from original
 */
function getForwardSubject(subject: string): string {
  if (subject.toLowerCase().startsWith('fwd:')) {
    return subject;
  }
  return `Fwd: ${subject}`;
}

/**
 * Compose screen - create new email
 *
 * Provides a form for composing new emails with:
 * - To, CC, BCC fields
 * - Subject field
 * - Body editor
 * - AI assist button (placeholder)
 * - Reply/Forward support via URL params
 */
export default function ComposeScreen(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<ComposeParams>();
  const { tokens, isAuthenticated } = useAuthContext();

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  /**
   * Initialize form fields from URL params (for reply/forward)
   */
  useEffect(() => {
    const mode = params.mode;

    if (mode === 'reply') {
      // Pre-fill fields for reply
      if (params.to) {
        setTo(params.to);
      }
      if (params.subject) {
        setSubject(getReplySubject(params.subject));
      }
      if (params.body) {
        setBody(params.body);
      }
    } else if (mode === 'forward') {
      // Pre-fill subject for forward (leave To empty)
      if (params.subject) {
        setSubject(getForwardSubject(params.subject));
      }
      // Forward body would be set here if passed
      if (params.body) {
        setBody(params.body);
      }
    } else {
      // New email mode - check for any pre-filled values
      if (params.to) {
        setTo(params.to);
      }
      if (params.subject) {
        setSubject(params.subject);
      }
      if (params.body) {
        setBody(params.body);
      }
    }
  }, [params]);

  const handleSend = async (): Promise<void> => {
    if (!isAuthenticated || !tokens?.accessToken) {
      Alert.alert('Error', 'You must be logged in to send emails');
      return;
    }

    if (!canSend) {
      return;
    }

    setIsSending(true);

    try {
      // Parse recipients (comma-separated emails)
      const toRecipients = to
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);

      const ccRecipients = cc
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);

      // Build request payload
      const payload = {
        to: toRecipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        subject: subject.trim(),
        body: body.trim() || ' ', // Ensure non-empty body
      };

      // Send email via API
      const response = await fetch(`${API_URL}/api/emails/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error || `Failed to send email (${response.status})`;
        throw new Error(errorMessage);
      }

      // Success - navigate back
      router.back();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send email';
      Alert.alert('Send Failed', message);
    } finally {
      setIsSending(false);
    }
  };

  const handleAiAssist = async (): Promise<void> => {
    if (!isAuthenticated || !tokens?.accessToken) {
      Alert.alert('Error', 'You must be logged in to use AI assistance');
      return;
    }

    if (!body.trim()) {
      Alert.alert('AI Assist', 'Please write some content first before using AI assistance');
      return;
    }

    setIsAiLoading(true);

    try {
      // Call AI enhance API
      const response = await fetch(`${API_URL}/api/ai/compose`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'enhance',
          draft: body,
          subject: subject || undefined,
          recipient: to || undefined,
          fixGrammar: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.message || `Failed to enhance (${response.status})`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.enhancedContent) {
        setBody(data.enhancedContent);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to enhance draft';
      Alert.alert('AI Assist Failed', message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const canSend = to.trim().length > 0 && subject.trim().length > 0 && !isSending && !isAiLoading;
  const canUseAi = body.trim().length > 0 && !isAiLoading && !isSending;

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
            style={[styles.aiButton, !canUseAi && styles.aiButtonDisabled]}
            onPress={handleAiAssist}
            disabled={!canUseAi}
          >
            {isAiLoading ? (
              <ActivityIndicator color="#333" size="small" />
            ) : (
              <Text style={styles.aiButtonText}>✨ AI Assist</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
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
  aiButtonDisabled: {
    backgroundColor: '#e8e8e8',
    opacity: 0.5,
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
