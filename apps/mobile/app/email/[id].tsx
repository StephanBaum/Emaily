import { useLocalSearchParams } from 'expo-router';
import { EmailDetailScreen } from '../../src/screens/EmailDetailScreen';

/**
 * Email detail route
 *
 * Route: /email/[id]
 *
 * Displays the full content of an email with actions:
 * - Reply
 * - Forward
 * - Archive
 * - Delete
 * - Star/Unstar
 * - Mark Read/Unread
 * - Smart Reply suggestions
 */
export default function EmailDetailRoute(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <EmailDetailScreen emailId={id || ''} />;
}
