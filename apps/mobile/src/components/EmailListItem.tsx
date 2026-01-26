import React, { useCallback, useMemo } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import type { Email } from '../hooks/useEmails';

/**
 * Props for EmailListItem component
 */
export interface EmailListItemProps {
  /** Email data to display */
  email: Email;
  /** Called when the email item is pressed */
  onPress: (email: Email) => void;
  /** Called when swipe action triggers archive */
  onArchive?: (email: Email) => void;
  /** Called when swipe action triggers delete */
  onDelete?: (email: Email) => void;
  /** Called when star button is pressed */
  onToggleStar?: (email: Email) => void;
  /** Whether to show category badge */
  showCategory?: boolean;
  /** Whether to show priority indicator */
  showPriority?: boolean;
}

/**
 * Category colors for badges
 */
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  important: { bg: '#fee2e2', text: '#dc2626' },
  promotional: { bg: '#fef3c7', text: '#d97706' },
  social: { bg: '#dbeafe', text: '#2563eb' },
  updates: { bg: '#d1fae5', text: '#059669' },
  spam: { bg: '#f3f4f6', text: '#6b7280' },
};

/**
 * Priority indicator colors
 */
const PRIORITY_COLORS: Record<number, string> = {
  5: '#dc2626', // Critical - Red
  4: '#f97316', // High - Orange
  3: '#eab308', // Medium - Yellow
  2: '#22c55e', // Low - Green
  1: '#6b7280', // Minimal - Gray
};

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today - show time
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    // Within a week - show day name
    return date.toLocaleDateString([], { weekday: 'short' });
  } else if (date.getFullYear() === now.getFullYear()) {
    // Same year - show month and day
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else {
    // Different year - show full date
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

/**
 * Get sender display name from email
 */
function getSenderDisplay(email: Email): string {
  // Try to extract name from sender field (format: "Name <email@example.com>")
  const match = email.sender.match(/^(.+?)\s*<.*>$/);
  if (match) {
    return match[1].trim();
  }
  // Fall back to email address without domain
  const emailMatch = email.sender.match(/^([^@]+)@/);
  if (emailMatch) {
    return emailMatch[1];
  }
  return email.sender;
}

/**
 * Get initials from sender name
 */
function getInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate consistent color from string
 */
function stringToColor(str: string): string {
  const colors = [
    '#f87171', // red
    '#fb923c', // orange
    '#fbbf24', // amber
    '#a3e635', // lime
    '#4ade80', // green
    '#2dd4bf', // teal
    '#22d3ee', // cyan
    '#60a5fa', // blue
    '#a78bfa', // violet
    '#f472b6', // pink
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * EmailListItem component
 *
 * Displays a single email item in a list with sender avatar,
 * subject, preview, category badge, and priority indicator.
 *
 * @example
 * ```tsx
 * <EmailListItem
 *   email={email}
 *   onPress={(email) => navigateToDetail(email.id)}
 *   onToggleStar={(email) => toggleStar(email.id)}
 *   showCategory
 *   showPriority
 * />
 * ```
 */
export function EmailListItem({
  email,
  onPress,
  onArchive,
  onDelete,
  onToggleStar,
  showCategory = true,
  showPriority = true,
}: EmailListItemProps): JSX.Element {
  const senderName = useMemo(() => getSenderDisplay(email), [email.sender]);
  const initials = useMemo(() => getInitials(senderName), [senderName]);
  const avatarColor = useMemo(() => stringToColor(email.sender), [email.sender]);
  const formattedDate = useMemo(() => formatDate(email.receivedAt), [email.receivedAt]);

  // Get preview text - use snippet if available, otherwise truncate body
  const preview = useMemo(() => {
    if (email.snippet) return email.snippet;
    const plainText = email.body.replace(/<[^>]*>/g, '').trim();
    return plainText.substring(0, 100);
  }, [email.snippet, email.body]);

  const categoryStyle = useMemo(() => {
    if (!email.category || !CATEGORY_COLORS[email.category]) return null;
    return CATEGORY_COLORS[email.category];
  }, [email.category]);

  const priorityColor = useMemo(() => {
    if (!email.priority) return null;
    return PRIORITY_COLORS[email.priority] || null;
  }, [email.priority]);

  /**
   * Handle press on the email item
   */
  const handlePress = useCallback((): void => {
    onPress(email);
  }, [email, onPress]);

  /**
   * Handle star toggle
   */
  const handleToggleStar = useCallback(
    (e: GestureResponderEvent): void => {
      e.stopPropagation();
      onToggleStar?.(email);
    },
    [email, onToggleStar]
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        !email.isRead && styles.unreadContainer,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Email from ${senderName}: ${email.subject}`}
      accessibilityHint="Double tap to open email"
      accessibilityState={{ selected: !email.isRead }}
    >
      {/* Priority indicator */}
      {showPriority && priorityColor && (
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
      )}

      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Header row: sender and date */}
        <View style={styles.headerRow}>
          <View style={styles.senderContainer}>
            <Text
              style={[styles.sender, !email.isRead && styles.unreadText]}
              numberOfLines={1}
            >
              {senderName}
            </Text>
            {email.isStarred && (
              <Pressable
                onPress={handleToggleStar}
                hitSlop={8}
                accessibilityLabel="Starred"
              >
                <Text style={styles.starredIcon}>*</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>

        {/* Subject row with category badge */}
        <View style={styles.subjectRow}>
          <Text
            style={[styles.subject, !email.isRead && styles.unreadText]}
            numberOfLines={1}
          >
            {email.subject || '(No subject)'}
          </Text>
          {showCategory && categoryStyle && email.category && (
            <View style={[styles.categoryBadge, { backgroundColor: categoryStyle.bg }]}>
              <Text style={[styles.categoryText, { color: categoryStyle.text }]}>
                {email.category}
              </Text>
            </View>
          )}
        </View>

        {/* Preview/summary */}
        <Text style={styles.preview} numberOfLines={2}>
          {email.summary || preview}
        </Text>

        {/* Attachment indicator */}
        {email.hasAttachments && (
          <View style={styles.attachmentIndicator}>
            <Text style={styles.attachmentIcon}>[=]</Text>
            <Text style={styles.attachmentText}>Attachment</Text>
          </View>
        )}
      </View>

      {/* Unread indicator dot */}
      {!email.isRead && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  unreadContainer: {
    backgroundColor: '#f8fafc',
  },
  pressed: {
    backgroundColor: '#f1f5f9',
  },
  priorityIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  senderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  sender: {
    fontSize: 15,
    color: '#374151',
    flexShrink: 1,
  },
  starredIcon: {
    fontSize: 16,
    color: '#f59e0b',
    marginLeft: 6,
  },
  date: {
    fontSize: 13,
    color: '#9ca3af',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  subject: {
    fontSize: 15,
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  preview: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  unreadText: {
    fontWeight: '600',
    color: '#111827',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginLeft: 8,
    alignSelf: 'center',
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attachmentIcon: {
    fontSize: 12,
    color: '#9ca3af',
    marginRight: 4,
  },
  attachmentText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default EmailListItem;
