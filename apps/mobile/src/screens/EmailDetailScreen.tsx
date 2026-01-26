import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuthContext } from '../contexts/AuthContext';
import type { Email } from '../hooks/useEmails';

/**
 * API URL from app configuration
 */
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

/**
 * Smart reply item from AI
 */
interface SmartReply {
  content: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  isShort: boolean;
}

/**
 * Props for EmailDetailScreen component
 */
export interface EmailDetailScreenProps {
  /** Email ID to display */
  emailId: string;
  /** Optional callback when email is archived */
  onArchive?: () => void;
  /** Optional callback when email is deleted */
  onDelete?: () => void;
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
 * Tone badge colors
 */
const TONE_COLORS: Record<string, { bg: string; text: string }> = {
  formal: { bg: '#e0e7ff', text: '#4338ca' },
  casual: { bg: '#fef3c7', text: '#d97706' },
  friendly: { bg: '#d1fae5', text: '#059669' },
  professional: { bg: '#f3e8ff', text: '#7c3aed' },
};

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get sender display name from email
 */
function getSenderDisplay(sender: string): { name: string; email: string } {
  // Try to extract name and email from sender field (format: "Name <email@example.com>")
  const match = sender.match(/^(.+?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  // Fall back to using sender as both name and email
  const emailMatch = sender.match(/^([^@]+)@/);
  const name = emailMatch ? emailMatch[1] : sender;
  return { name, email: sender };
}

/**
 * Get initials from name
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
    '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80',
    '#2dd4bf', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Action button component
 */
interface ActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function ActionButton({ icon, label, onPress, destructive, disabled }: ActionButtonProps): JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.actionIcon, destructive && styles.destructiveIcon]}>{icon}</Text>
      <Text style={[styles.actionLabel, destructive && styles.destructiveLabel]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Smart reply suggestion button
 */
interface SmartReplyButtonProps {
  reply: SmartReply;
  onPress: (reply: SmartReply) => void;
}

function SmartReplyButton({ reply, onPress }: SmartReplyButtonProps): JSX.Element {
  const toneStyle = TONE_COLORS[reply.tone] || TONE_COLORS.professional;

  const handlePress = useCallback(() => {
    onPress(reply);
  }, [reply, onPress]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.smartReplyButton,
        pressed && styles.smartReplyButtonPressed,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Reply with ${reply.tone} tone: ${reply.content.substring(0, 50)}...`}
    >
      <View style={[styles.toneBadge, { backgroundColor: toneStyle.bg }]}>
        <Text style={[styles.toneBadgeText, { color: toneStyle.text }]}>{reply.tone}</Text>
      </View>
      <Text style={styles.smartReplyContent} numberOfLines={2}>
        {reply.content}
      </Text>
    </Pressable>
  );
}

/**
 * Loading state component
 */
function LoadingState(): JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>Loading email...</Text>
    </View>
  );
}

/**
 * Error state component
 */
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  onGoBack: () => void;
}

function ErrorState({ message, onRetry, onGoBack }: ErrorStateProps): JSX.Element {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>!</Text>
      <Text style={styles.errorTitle}>Unable to load email</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <View style={styles.errorActions}>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.backButton} onPress={onGoBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * EmailDetailScreen component
 *
 * Displays the full content of an email with actions like reply, forward,
 * archive, delete, star, and mark as read/unread. Also shows AI-powered
 * smart reply suggestions.
 *
 * @example
 * ```tsx
 * <EmailDetailScreen
 *   emailId="123"
 *   onArchive={() => navigation.goBack()}
 *   onDelete={() => navigation.goBack()}
 * />
 * ```
 */
export function EmailDetailScreen({
  emailId,
  onArchive,
  onDelete,
}: EmailDetailScreenProps): JSX.Element {
  const router = useRouter();
  const { tokens, isAuthenticated } = useAuthContext();
  const { width: screenWidth } = useWindowDimensions();

  // State
  const [email, setEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  /**
   * Fetch email details from API
   */
  const fetchEmail = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !tokens?.accessToken) {
      setError(new Error('Not authenticated'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/emails/${emailId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Email not found');
        }
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.');
        }
        throw new Error('Failed to load email');
      }

      const data = await response.json();
      setEmail(data);

      // Mark as read if not already
      if (!data.isRead) {
        await markAsRead();
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load email'));
    } finally {
      setIsLoading(false);
    }
  }, [emailId, isAuthenticated, tokens?.accessToken]);

  /**
   * Fetch smart reply suggestions
   */
  const fetchSmartReplies = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !tokens?.accessToken || !email) {
      return;
    }

    setIsLoadingReplies(true);

    try {
      const response = await fetch(`${API_URL}/api/ai/smart-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          subject: email.subject,
          body: stripHtml(email.body),
          sender: email.sender,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSmartReplies(data.replies || []);
      }
    } catch {
      // Silently fail - smart replies are optional
    } finally {
      setIsLoadingReplies(false);
    }
  }, [email, isAuthenticated, tokens?.accessToken]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchEmail();
  }, [fetchEmail]);

  /**
   * Fetch smart replies after email loads
   */
  useEffect(() => {
    if (email && !isLoading) {
      fetchSmartReplies();
    }
  }, [email, isLoading, fetchSmartReplies]);

  /**
   * Perform API action on email
   */
  const performAction = useCallback(
    async (endpoint: string, method: string = 'POST'): Promise<void> => {
      if (!isAuthenticated || !tokens?.accessToken) {
        return;
      }

      setIsActioning(true);

      try {
        const response = await fetch(`${API_URL}/api/emails/${emailId}/${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to ${endpoint} email`);
        }

        return;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Action failed');
      } finally {
        setIsActioning(false);
      }
    },
    [emailId, isAuthenticated, tokens?.accessToken]
  );

  /**
   * Mark email as read
   */
  const markAsRead = useCallback(async (): Promise<void> => {
    try {
      await performAction('read', 'POST');
      setEmail((prev) => prev ? { ...prev, isRead: true } : null);
    } catch {
      // Silently fail
    }
  }, [performAction]);

  /**
   * Toggle read/unread status
   */
  const toggleReadStatus = useCallback(async (): Promise<void> => {
    if (!email) return;

    const newStatus = !email.isRead;
    // Optimistic update
    setEmail((prev) => prev ? { ...prev, isRead: newStatus } : null);

    try {
      await performAction('read', newStatus ? 'POST' : 'DELETE');
    } catch (err) {
      // Rollback
      setEmail((prev) => prev ? { ...prev, isRead: !newStatus } : null);
      Alert.alert('Error', 'Failed to update read status');
    }
  }, [email, performAction]);

  /**
   * Toggle starred status
   */
  const toggleStarred = useCallback(async (): Promise<void> => {
    if (!email) return;

    const newStatus = !email.isStarred;
    // Optimistic update
    setEmail((prev) => prev ? { ...prev, isStarred: newStatus } : null);

    try {
      await fetch(`${API_URL}/api/emails/${emailId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({ isStarred: newStatus }),
      });
    } catch (err) {
      // Rollback
      setEmail((prev) => prev ? { ...prev, isStarred: !newStatus } : null);
      Alert.alert('Error', 'Failed to update star status');
    }
  }, [email, emailId, tokens?.accessToken]);

  /**
   * Archive email
   */
  const handleArchive = useCallback(async (): Promise<void> => {
    try {
      await performAction('archive', 'POST');
      onArchive?.();
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to archive email');
    }
  }, [performAction, onArchive, router]);

  /**
   * Delete email
   */
  const handleDelete = useCallback(async (): Promise<void> => {
    Alert.alert(
      'Delete Email',
      'Are you sure you want to delete this email?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/emails/${emailId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${tokens?.accessToken}`,
                },
              });
              onDelete?.();
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete email');
            }
          },
        },
      ]
    );
  }, [emailId, tokens?.accessToken, onDelete, router]);

  /**
   * Handle reply action
   */
  const handleReply = useCallback((): void => {
    // Navigate to compose screen with reply data
    router.push({
      pathname: '/(tabs)/compose',
      params: {
        mode: 'reply',
        replyToId: emailId,
        to: email?.sender || '',
        subject: `Re: ${email?.subject || ''}`,
      },
    });
  }, [router, emailId, email]);

  /**
   * Handle forward action
   */
  const handleForward = useCallback((): void => {
    router.push({
      pathname: '/(tabs)/compose',
      params: {
        mode: 'forward',
        forwardId: emailId,
        subject: `Fwd: ${email?.subject || ''}`,
      },
    });
  }, [router, emailId, email]);

  /**
   * Handle smart reply selection
   */
  const handleSmartReply = useCallback(
    (reply: SmartReply): void => {
      router.push({
        pathname: '/(tabs)/compose',
        params: {
          mode: 'reply',
          replyToId: emailId,
          to: email?.sender || '',
          subject: `Re: ${email?.subject || ''}`,
          body: reply.content,
        },
      });
    },
    [router, emailId, email]
  );

  /**
   * Handle share action
   */
  const handleShare = useCallback(async (): Promise<void> => {
    if (!email) return;

    try {
      await Share.share({
        title: email.subject,
        message: `${email.subject}\n\nFrom: ${email.sender}\n\n${stripHtml(email.body)}`,
      });
    } catch {
      // Silently fail
    }
  }, [email]);

  /**
   * Go back to inbox
   */
  const handleGoBack = useCallback((): void => {
    router.back();
  }, [router]);

  // Memoized values
  const senderInfo = useMemo(
    () => (email ? getSenderDisplay(email.sender) : { name: '', email: '' }),
    [email?.sender]
  );
  const initials = useMemo(() => getInitials(senderInfo.name), [senderInfo.name]);
  const avatarColor = useMemo(
    () => (email ? stringToColor(email.sender) : '#6b7280'),
    [email?.sender]
  );
  const formattedDate = useMemo(
    () => (email ? formatDate(email.receivedAt) : ''),
    [email?.receivedAt]
  );
  const categoryStyle = useMemo(
    () => (email?.category ? CATEGORY_COLORS[email.category] : null),
    [email?.category]
  );
  const priorityColor = useMemo(
    () => (email?.priority ? PRIORITY_COLORS[email.priority] : null),
    [email?.priority]
  );

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable style={styles.backTouchable} onPress={handleGoBack}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Email</Text>
          <View style={styles.headerSpacer} />
        </View>
        <LoadingState />
      </SafeAreaView>
    );
  }

  // Render error state
  if (error || !email) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable style={styles.backTouchable} onPress={handleGoBack}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Email</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ErrorState
          message={error?.message || 'Email not found'}
          onRetry={fetchEmail}
          onGoBack={handleGoBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backTouchable} onPress={handleGoBack}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {email.subject || '(No subject)'}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={toggleStarred}
            accessibilityLabel={email.isStarred ? 'Unstar' : 'Star'}
          >
            <Text style={[styles.starIcon, email.isStarred && styles.starredIcon]}>
              {email.isStarred ? '*' : 'o'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={toggleReadStatus}
            accessibilityLabel={email.isRead ? 'Mark as unread' : 'Mark as read'}
          >
            <Text style={styles.readIcon}>{email.isRead ? 'U' : 'R'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Email Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Priority indicator */}
        {priorityColor && (
          <View style={[styles.priorityBanner, { backgroundColor: priorityColor }]}>
            <Text style={styles.priorityText}>
              Priority {email.priority}: {email.priority === 5 ? 'Critical' : email.priority === 4 ? 'High' : email.priority === 3 ? 'Medium' : email.priority === 2 ? 'Low' : 'Minimal'}
            </Text>
          </View>
        )}

        {/* Sender Info */}
        <View style={styles.senderSection}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.senderInfo}>
            <View style={styles.senderNameRow}>
              <Text style={styles.senderName}>{senderInfo.name}</Text>
              {categoryStyle && email.category && (
                <View style={[styles.categoryBadge, { backgroundColor: categoryStyle.bg }]}>
                  <Text style={[styles.categoryText, { color: categoryStyle.text }]}>
                    {email.category}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.senderEmail}>{senderInfo.email}</Text>
            <Text style={styles.recipientText}>
              To: {email.recipients?.join(', ') || 'me'}
            </Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
        </View>

        {/* Subject */}
        <View style={styles.subjectSection}>
          <Text style={styles.subject}>{email.subject || '(No subject)'}</Text>
        </View>

        {/* AI Summary */}
        {email.summary && (
          <View style={styles.summarySection}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryIcon}>AI</Text>
              <Text style={styles.summaryLabel}>AI Summary</Text>
            </View>
            <Text style={styles.summaryText}>{email.summary}</Text>
          </View>
        )}

        {/* Email Body */}
        <View style={styles.bodySection}>
          <Text style={styles.bodyText}>
            {email.bodyHtml ? stripHtml(email.bodyHtml) : email.body}
          </Text>
        </View>

        {/* Attachments indicator */}
        {email.hasAttachments && (
          <View style={styles.attachmentsSection}>
            <Text style={styles.attachmentIcon}>[=]</Text>
            <Text style={styles.attachmentText}>This email has attachments</Text>
          </View>
        )}

        {/* Smart Replies */}
        <View style={styles.smartRepliesSection}>
          <Text style={styles.smartRepliesTitle}>Smart Replies</Text>
          {isLoadingReplies ? (
            <View style={styles.smartRepliesLoading}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.smartRepliesLoadingText}>Generating suggestions...</Text>
            </View>
          ) : smartReplies.length > 0 ? (
            <View style={styles.smartRepliesList}>
              {smartReplies.map((reply, index) => (
                <SmartReplyButton key={index} reply={reply} onPress={handleSmartReply} />
              ))}
            </View>
          ) : (
            <Text style={styles.noSmartReplies}>No suggestions available</Text>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <ActionButton icon="^" label="Reply" onPress={handleReply} disabled={isActioning} />
        <ActionButton icon=">" label="Forward" onPress={handleForward} disabled={isActioning} />
        <ActionButton icon="[=]" label="Archive" onPress={handleArchive} disabled={isActioning} />
        <ActionButton icon="^" label="Share" onPress={handleShare} disabled={isActioning} />
        <ActionButton
          icon="X"
          label="Delete"
          onPress={handleDelete}
          destructive
          disabled={isActioning}
        />
      </View>

      {/* Loading overlay for actions */}
      {isActioning && (
        <View style={styles.actioningOverlay}>
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backTouchable: {
    padding: 8,
    marginRight: 4,
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3b82f6',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  headerSpacer: {
    width: 40,
  },
  starIcon: {
    fontSize: 18,
    color: '#9ca3af',
  },
  starredIcon: {
    color: '#f59e0b',
  },
  readIcon: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  priorityBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  senderSection: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  senderInfo: {
    flex: 1,
  },
  senderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
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
  senderEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  recipientText: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  subjectSection: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  subject: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 28,
  },
  summarySection: {
    margin: 16,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryIcon: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
  },
  summaryText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  bodySection: {
    padding: 16,
  },
  bodyText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 26,
  },
  attachmentsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  attachmentIcon: {
    fontSize: 16,
    color: '#6b7280',
    marginRight: 8,
  },
  attachmentText: {
    fontSize: 14,
    color: '#6b7280',
  },
  smartRepliesSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  smartRepliesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  smartRepliesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  smartRepliesLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  smartRepliesList: {
    gap: 8,
  },
  smartReplyButton: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  smartReplyButtonPressed: {
    backgroundColor: '#f3f4f6',
  },
  toneBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  toneBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  smartReplyContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  noSmartReplies: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
  },
  actionButtonPressed: {
    opacity: 0.6,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionIcon: {
    fontSize: 20,
    color: '#3b82f6',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  destructiveIcon: {
    color: '#dc2626',
  },
  destructiveLabel: {
    color: '#dc2626',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    fontSize: 48,
    color: '#ef4444',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  actioningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EmailDetailScreen;
