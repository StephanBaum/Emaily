import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Email detail screen
 *
 * Displays the full content of an email with actions:
 * - Reply
 * - Forward
 * - Archive
 * - Delete
 */
export default function EmailDetailScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // TODO: Fetch email data from API based on id
  const email = {
    id,
    from: 'team@company.com',
    to: 'user@example.com',
    subject: 'Welcome to Email AI',
    date: 'January 26, 2026 at 10:30 AM',
    body: `Hello,

Welcome to Email AI, your AI-powered email client!

We're excited to have you on board. With Email AI, you can:

• Automatically categorize your emails
• Get smart reply suggestions
• Use AI to help draft responses
• Stay organized with intelligent filters

If you have any questions, feel free to reach out to our support team.

Best regards,
The Email AI Team`,
    isStarred: true,
  };

  const handleReply = (): void => {
    // TODO: Navigate to compose with reply data
    router.push('/(tabs)/compose');
  };

  const handleForward = (): void => {
    // TODO: Navigate to compose with forward data
    router.push('/(tabs)/compose');
  };

  const handleArchive = (): void => {
    // TODO: Implement archive
    router.back();
  };

  const handleDelete = (): void => {
    // TODO: Implement delete
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Email Header */}
        <View style={styles.header}>
          <Text style={styles.subject}>
            {email.isStarred ? '⭐ ' : ''}
            {email.subject}
          </Text>
          <View style={styles.metadata}>
            <Text style={styles.from}>From: {email.from}</Text>
            <Text style={styles.to}>To: {email.to}</Text>
            <Text style={styles.date}>{email.date}</Text>
          </View>
        </View>

        {/* Email Body */}
        <View style={styles.body}>
          <Text style={styles.bodyText}>{email.body}</Text>
        </View>
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={handleReply}>
          <Text style={styles.actionIcon}>↩️</Text>
          <Text style={styles.actionLabel}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleForward}>
          <Text style={styles.actionIcon}>↪️</Text>
          <Text style={styles.actionLabel}>Forward</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleArchive}>
          <Text style={styles.actionIcon}>📦</Text>
          <Text style={styles.actionLabel}>Archive</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
          <Text style={styles.actionIcon}>🗑️</Text>
          <Text style={styles.actionLabel}>Delete</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  subject: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  metadata: {
    gap: 4,
  },
  from: {
    fontSize: 14,
    color: '#333',
  },
  to: {
    fontSize: 14,
    color: '#666',
  },
  date: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  body: {
    padding: 16,
  },
  bodyText: {
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 24,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    color: '#666',
  },
});
