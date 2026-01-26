import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEmails, type Email, type EmailCategory } from '../hooks/useEmails';
import { EmailListItem } from '../components/EmailListItem';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * Category filter options for the inbox
 */
const CATEGORIES: { id: EmailCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'important', label: 'Important' },
  { id: 'updates', label: 'Updates' },
  { id: 'social', label: 'Social' },
  { id: 'promotional', label: 'Promo' },
];

/**
 * Props for InboxScreen component
 */
export interface InboxScreenProps {
  /** Optional callback when an email is opened */
  onEmailOpen?: (emailId: string) => void;
}

/**
 * Category filter pill component
 */
interface CategoryPillProps {
  category: { id: EmailCategory; label: string };
  isActive: boolean;
  onPress: (category: EmailCategory) => void;
}

function CategoryPill({ category, isActive, onPress }: CategoryPillProps): JSX.Element {
  const handlePress = useCallback((): void => {
    onPress(category.id);
  }, [category.id, onPress]);

  return (
    <Pressable
      style={[styles.categoryPill, isActive && styles.categoryPillActive]}
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
        {category.label}
      </Text>
    </Pressable>
  );
}

/**
 * Empty inbox state component - Inbox Zero celebration
 */
function EmptyInboxState(): JSX.Element {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.celebrationContainer}>
        <Text style={styles.celebrationEmoji}>*</Text>
        <View style={styles.celebrationRing} />
      </View>
      <Text style={styles.emptyTitle}>Inbox Zero!</Text>
      <Text style={styles.emptySubtitle}>
        You've processed all your emails.{'\n'}
        Take a moment to celebrate!
      </Text>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>-</Text>
          <Text style={styles.statLabel}>Processed today</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Error state component
 */
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps): JSX.Element {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>!</Text>
      <Text style={styles.errorTitle}>Unable to load emails</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

/**
 * Loading state component
 */
function LoadingState(): JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>Loading emails...</Text>
    </View>
  );
}

/**
 * Footer loader component for pagination
 */
function FooterLoader(): JSX.Element {
  return (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color="#3b82f6" />
    </View>
  );
}

/**
 * InboxScreen - Main email list screen
 *
 * Displays the user's email inbox with category filtering,
 * pull-to-refresh, infinite scroll pagination, and email actions.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <InboxScreen />
 *
 * // With custom email open handler
 * <InboxScreen
 *   onEmailOpen={(id) => navigation.navigate('EmailDetail', { id })}
 * />
 * ```
 */
export function InboxScreen({ onEmailOpen }: InboxScreenProps): JSX.Element {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthContext();
  const [selectedCategory, setSelectedCategory] = useState<EmailCategory>('all');

  const {
    emails,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    total,
    refresh,
    loadMore,
    archiveEmail,
    markAsRead,
    starEmail,
    unstarEmail,
    setCategory,
  } = useEmails({ category: selectedCategory });

  /**
   * Handle category filter change
   */
  const handleCategoryChange = useCallback(
    (category: EmailCategory): void => {
      setSelectedCategory(category);
      setCategory(category);
    },
    [setCategory]
  );

  /**
   * Handle email item press - navigate to detail
   */
  const handleEmailPress = useCallback(
    (email: Email): void => {
      // Mark as read when opening
      if (!email.isRead) {
        markAsRead(email.id).catch(() => {
          // Silently fail - the email will be marked as read when viewed
        });
      }

      if (onEmailOpen) {
        onEmailOpen(email.id);
      } else {
        router.push(`/email/${email.id}`);
      }
    },
    [onEmailOpen, router, markAsRead]
  );

  /**
   * Handle star toggle
   */
  const handleToggleStar = useCallback(
    (email: Email): void => {
      if (email.isStarred) {
        unstarEmail(email.id).catch(() => {
          // Error handled by hook
        });
      } else {
        starEmail(email.id).catch(() => {
          // Error handled by hook
        });
      }
    },
    [starEmail, unstarEmail]
  );

  /**
   * Handle archive action
   */
  const handleArchive = useCallback(
    (email: Email): void => {
      archiveEmail(email.id).catch(() => {
        // Error handled by hook
      });
    },
    [archiveEmail]
  );

  /**
   * Render individual email item
   */
  const renderItem: ListRenderItem<Email> = useCallback(
    ({ item }) => (
      <EmailListItem
        email={item}
        onPress={handleEmailPress}
        onToggleStar={handleToggleStar}
        onArchive={handleArchive}
        showCategory
        showPriority
      />
    ),
    [handleEmailPress, handleToggleStar, handleArchive]
  );

  /**
   * Key extractor for FlatList
   */
  const keyExtractor = useCallback((item: Email): string => item.id, []);

  /**
   * Render empty state - either Inbox Zero or general empty
   */
  const renderEmptyComponent = useCallback((): JSX.Element => {
    if (selectedCategory === 'all' && total === 0) {
      return <EmptyInboxState />;
    }

    return (
      <View style={styles.emptyFilterContainer}>
        <Text style={styles.emptyFilterIcon}>o</Text>
        <Text style={styles.emptyFilterText}>
          No {selectedCategory} emails
        </Text>
        <Text style={styles.emptyFilterSubtext}>
          Emails in this category will appear here
        </Text>
      </View>
    );
  }, [selectedCategory, total]);

  /**
   * Render footer - loading more indicator
   */
  const renderFooter = useCallback((): JSX.Element | null => {
    if (!isLoadingMore) return null;
    return <FooterLoader />;
  }, [isLoadingMore]);

  /**
   * Handle end reached for pagination
   */
  const handleEndReached = useCallback((): void => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  /**
   * Render category filter bar
   */
  const renderCategoryBar = useMemo(
    () => (
      <View style={styles.categoryBar}>
        {CATEGORIES.map((category) => (
          <CategoryPill
            key={category.id}
            category={category}
            isActive={selectedCategory === category.id}
            onPress={handleCategoryChange}
          />
        ))}
      </View>
    ),
    [selectedCategory, handleCategoryChange]
  );

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.unauthContainer}>
          <Text style={styles.unauthIcon}>@</Text>
          <Text style={styles.unauthTitle}>Sign in to view your inbox</Text>
          <Text style={styles.unauthSubtitle}>
            Connect your email account to get started
          </Text>
          <Pressable
            style={styles.signInButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading && emails.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        {renderCategoryBar}
        <LoadingState />
      </SafeAreaView>
    );
  }

  // Error state
  if (error && emails.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        {renderCategoryBar}
        <ErrorState message={error.message} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header with user info */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Inbox</Text>
          {total > 0 && (
            <Text style={styles.headerCount}>{total}</Text>
          )}
        </View>
        {user && (
          <View style={styles.headerRight}>
            <Text style={styles.headerEmail} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        )}
      </View>

      {/* Category filter bar */}
      {renderCategoryBar}

      {/* Email list */}
      <FlatList
        data={emails}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        ListEmptyComponent={renderEmptyComponent}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        // Performance optimizations
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        getItemLayout={(_, index) => ({
          length: 88, // Approximate height of email item
          offset: 88 * index,
          index,
        })}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerCount: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  headerEmail: {
    fontSize: 13,
    color: '#9ca3af',
  },
  categoryBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  categoryPillActive: {
    backgroundColor: '#3b82f6',
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  listContent: {
    flexGrow: 1,
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  celebrationContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  celebrationEmoji: {
    fontSize: 48,
    color: '#fbbf24',
  },
  celebrationRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fbbf24',
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
  },
  emptyFilterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyFilterIcon: {
    fontSize: 48,
    color: '#d1d5db',
    marginBottom: 16,
  },
  emptyFilterText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  emptyFilterSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  unauthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  unauthIcon: {
    fontSize: 64,
    color: '#3b82f6',
    marginBottom: 16,
  },
  unauthTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  unauthSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default InboxScreen;
