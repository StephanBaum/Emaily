import { useRouter } from 'expo-router';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';

/**
 * Email item interface for the inbox list
 */
interface EmailItem {
  id: string;
  from: string;
  subject: string;
  preview: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
}

/**
 * Placeholder email data
 * TODO: Replace with real data from API
 */
const PLACEHOLDER_EMAILS: EmailItem[] = [
  {
    id: '1',
    from: 'team@company.com',
    subject: 'Welcome to Email AI',
    preview: 'Thank you for signing up! Get started with...',
    date: 'Today',
    isRead: false,
    isStarred: true,
  },
  {
    id: '2',
    from: 'support@example.com',
    subject: 'Your weekly summary',
    preview: 'Here is your email activity for this week...',
    date: 'Yesterday',
    isRead: true,
    isStarred: false,
  },
  {
    id: '3',
    from: 'notifications@service.com',
    subject: 'New features available',
    preview: 'Check out the latest updates to our platform...',
    date: 'Jan 24',
    isRead: true,
    isStarred: false,
  },
];

/**
 * Email list item component
 */
function EmailListItem({
  email,
  onPress,
}: {
  email: EmailItem;
  onPress: () => void;
}): JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.emailItem, !email.isRead && styles.unreadEmail]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.emailHeader}>
        <Text
          style={[styles.emailFrom, !email.isRead && styles.unreadText]}
          numberOfLines={1}
        >
          {email.from}
        </Text>
        <Text style={styles.emailDate}>{email.date}</Text>
      </View>
      <Text
        style={[styles.emailSubject, !email.isRead && styles.unreadText]}
        numberOfLines={1}
      >
        {email.isStarred ? '⭐ ' : ''}
        {email.subject}
      </Text>
      <Text style={styles.emailPreview} numberOfLines={2}>
        {email.preview}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Inbox screen - main email list
 *
 * Displays the user's email inbox with pull-to-refresh
 * and tap-to-view functionality.
 */
export default function InboxScreen(): JSX.Element {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [emails] = useState<EmailItem[]>(PLACEHOLDER_EMAILS);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Implement actual refresh from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleEmailPress = (emailId: string): void => {
    router.push(`/email/${emailId}`);
  };

  const renderEmailItem = ({ item }: { item: EmailItem }): JSX.Element => (
    <EmailListItem email={item} onPress={() => handleEmailPress(item.id)} />
  );

  const renderEmptyList = (): JSX.Element => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyText}>No emails yet</Text>
      <Text style={styles.emptySubtext}>
        Pull down to refresh or connect your email account
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FlatList
        data={emails}
        renderItem={renderEmailItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0078d4"
          />
        }
        ListEmptyComponent={renderEmptyList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    flexGrow: 1,
  },
  emailItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  unreadEmail: {
    backgroundColor: '#f8fafc',
  },
  emailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  emailFrom: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  emailDate: {
    fontSize: 13,
    color: '#666',
  },
  emailSubject: {
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  emailPreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  unreadText: {
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginLeft: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
