import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEmails, type Email, type EmailCategory } from '../hooks/useEmails';
import { EmailListItem } from '../components/EmailListItem';
import { SearchBar, type RecentSearch } from '../components/SearchBar';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * Category filter options for search
 */
const CATEGORIES: { id: EmailCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'important', label: 'Important' },
  { id: 'updates', label: 'Updates' },
  { id: 'social', label: 'Social' },
  { id: 'promotional', label: 'Promo' },
];

/**
 * Read status filter options
 */
type ReadStatus = 'all' | 'read' | 'unread';

const READ_STATUS_OPTIONS: { id: ReadStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'read', label: 'Read' },
  { id: 'unread', label: 'Unread' },
];

/**
 * Search filters state
 */
interface SearchFilters {
  query: string;
  sender: string;
  dateFrom: string;
  dateTo: string;
  hasAttachments: boolean;
  category: EmailCategory | 'all';
  readStatus: ReadStatus;
}

/**
 * Props for SearchScreen component
 */
export interface SearchScreenProps {
  /** Optional callback when an email is opened */
  onEmailOpen?: (emailId: string) => void;
}

/**
 * Filter pill component
 */
interface FilterPillProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function FilterPill({ label, isActive, onPress }: FilterPillProps): JSX.Element {
  return (
    <Pressable
      style={[styles.filterPill, isActive && styles.filterPillActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Filter icon component (hamburger menu style)
 */
function FilterIcon(): JSX.Element {
  return (
    <View style={styles.filterIcon}>
      <View style={styles.filterIconLine} />
      <View style={styles.filterIconLine} />
      <View style={styles.filterIconLine} />
    </View>
  );
}

/**
 * Chevron icon for expandable sections
 */
interface ChevronIconProps {
  isExpanded: boolean;
}

function ChevronIcon({ isExpanded }: ChevronIconProps): JSX.Element {
  return (
    <View
      style={[
        styles.chevronIcon,
        isExpanded && styles.chevronIconExpanded,
      ]}
    >
      <View style={styles.chevronLine1} />
      <View style={styles.chevronLine2} />
    </View>
  );
}

/**
 * Empty search state component
 */
function EmptySearchState({ hasQuery }: { hasQuery: boolean }): JSX.Element {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{hasQuery ? 'o' : '\u{1F50D}'}</Text>
      <Text style={styles.emptyTitle}>
        {hasQuery ? 'No results found' : 'Start searching'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasQuery
          ? 'Try adjusting your search or filters'
          : 'Enter a search term to find emails'}
      </Text>
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
      <Text style={styles.errorTitle}>Unable to search</Text>
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
      <Text style={styles.loadingText}>Searching...</Text>
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
 * SearchScreen - Email search screen with filters
 *
 * Displays email search results with advanced filtering options including
 * sender, date range, attachments, category, and read status filters.
 * Supports pull-to-refresh and infinite scroll pagination.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SearchScreen />
 *
 * // With custom email open handler
 * <SearchScreen
 *   onEmailOpen={(id) => navigation.navigate('EmailDetail', { id })}
 * />
 * ```
 */
export function SearchScreen({ onEmailOpen }: SearchScreenProps): JSX.Element {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthContext();
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches] = useState<RecentSearch[]>([]);

  // Search filters state
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    sender: '',
    dateFrom: '',
    dateTo: '',
    hasAttachments: false,
    category: 'all',
    readStatus: 'all',
  });

  // Build search query string for useEmails hook
  const searchQuery = useMemo(() => {
    const parts: string[] = [];

    if (filters.query) {
      parts.push(filters.query);
    }

    if (filters.sender) {
      parts.push(`from:${filters.sender}`);
    }

    return parts.join(' ');
  }, [filters.query, filters.sender]);

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
  } = useEmails({
    category: filters.category === 'all' ? undefined : filters.category,
    search: searchQuery || undefined,
  });

  /**
   * Handle search query change
   */
  const handleSearch = useCallback((query: string): void => {
    setFilters((prev) => ({ ...prev, query }));
  }, []);

  /**
   * Handle recent search selection
   */
  const handleSelectRecent = useCallback((query: string): void => {
    setFilters((prev) => ({ ...prev, query }));
  }, []);

  /**
   * Handle clear search
   */
  const handleClear = useCallback((): void => {
    setFilters({
      query: '',
      sender: '',
      dateFrom: '',
      dateTo: '',
      hasAttachments: false,
      category: 'all',
      readStatus: 'all',
    });
  }, []);

  /**
   * Toggle filters panel
   */
  const toggleFilters = useCallback((): void => {
    setShowFilters((prev) => !prev);
  }, []);

  /**
   * Update filter value
   */
  const updateFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]): void => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  /**
   * Count active filters (excluding query)
   */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sender) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.hasAttachments) count++;
    if (filters.category !== 'all') count++;
    if (filters.readStatus !== 'all') count++;
    return count;
  }, [filters]);

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
   * Render empty state
   */
  const renderEmptyComponent = useCallback((): JSX.Element => {
    return <EmptySearchState hasQuery={!!filters.query} />;
  }, [filters.query]);

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
    if (hasMore && !isLoadingMore && filters.query) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, filters.query, loadMore]);

  /**
   * Render filters panel
   */
  const renderFiltersPanel = useMemo(() => {
    if (!showFilters) return null;

    return (
      <ScrollView style={styles.filtersPanel} showsVerticalScrollIndicator={false}>
        {/* Sender filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Sender</Text>
          <TextInput
            style={styles.filterInput}
            value={filters.sender}
            onChangeText={(text) => updateFilter('sender', text)}
            placeholder="Filter by sender email..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>

        {/* Date range filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Date Range</Text>
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>From</Text>
              <TextInput
                style={styles.filterInput}
                value={filters.dateFrom}
                onChangeText={(text) => updateFilter('dateFrom', text)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>To</Text>
              <TextInput
                style={styles.filterInput}
                value={filters.dateTo}
                onChangeText={(text) => updateFilter('dateTo', text)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </View>

        {/* Has attachments toggle */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Has Attachments</Text>
            <Switch
              value={filters.hasAttachments}
              onValueChange={(value) => updateFilter('hasAttachments', value)}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={filters.hasAttachments ? '#3b82f6' : '#f3f4f6'}
            />
          </View>
        </View>

        {/* Category filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.filterPillContainer}>
            {CATEGORIES.map((category) => (
              <FilterPill
                key={category.id}
                label={category.label}
                isActive={filters.category === category.id}
                onPress={() => updateFilter('category', category.id)}
              />
            ))}
          </View>
        </View>

        {/* Read status filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.filterPillContainer}>
            {READ_STATUS_OPTIONS.map((option) => (
              <FilterPill
                key={option.id}
                label={option.label}
                isActive={filters.readStatus === option.id}
                onPress={() => updateFilter('readStatus', option.id)}
              />
            ))}
          </View>
        </View>

        {/* Clear filters button */}
        {activeFilterCount > 0 && (
          <Pressable style={styles.clearFiltersButton} onPress={handleClear}>
            <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }, [showFilters, filters, activeFilterCount, updateFilter, handleClear]);

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.unauthContainer}>
          <Text style={styles.unauthIcon}>@</Text>
          <Text style={styles.unauthTitle}>Sign in to search emails</Text>
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

  // Loading state (only for initial load)
  if (isLoading && emails.length === 0 && filters.query) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
        </View>
        <SearchBar
          value={filters.query}
          onSearch={handleSearch}
          onSelectRecent={handleSelectRecent}
          recentSearches={recentSearches}
          onClear={handleClear}
          placeholder="Search emails..."
        />
        <LoadingState />
      </SafeAreaView>
    );
  }

  // Error state
  if (error && emails.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
        </View>
        <SearchBar
          value={filters.query}
          onSearch={handleSearch}
          onSelectRecent={handleSelectRecent}
          recentSearches={recentSearches}
          onClear={handleClear}
          placeholder="Search emails..."
        />
        <ErrorState message={error.message} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Search</Text>
          {total > 0 && filters.query && (
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

      {/* Search bar */}
      <SearchBar
        value={filters.query}
        onSearch={handleSearch}
        onSelectRecent={handleSelectRecent}
        recentSearches={recentSearches}
        isLoading={isLoading}
        onClear={handleClear}
        placeholder="Search emails..."
      />

      {/* Filters toggle button */}
      <View style={styles.filtersToggleContainer}>
        <Pressable
          style={styles.filtersToggleButton}
          onPress={toggleFilters}
          accessibilityRole="button"
          accessibilityLabel="Toggle filters"
          accessibilityState={{ expanded: showFilters }}
        >
          <FilterIcon />
          <Text style={styles.filtersToggleText}>Filters</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
          <ChevronIcon isExpanded={showFilters} />
        </Pressable>
      </View>

      {/* Filters panel */}
      {renderFiltersPanel}

      {/* Results list */}
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
  filtersToggleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filtersToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  filtersToggleText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  filterBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  filterIcon: {
    width: 16,
    height: 16,
    justifyContent: 'space-between',
  },
  filterIconLine: {
    height: 2,
    backgroundColor: '#6b7280',
    borderRadius: 1,
  },
  chevronIcon: {
    width: 12,
    height: 12,
    position: 'relative',
  },
  chevronIconExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  chevronLine1: {
    width: 7,
    height: 2,
    backgroundColor: '#6b7280',
    borderRadius: 1,
    position: 'absolute',
    top: 5,
    left: 0,
    transform: [{ rotate: '45deg' }],
  },
  chevronLine2: {
    width: 7,
    height: 2,
    backgroundColor: '#6b7280',
    borderRadius: 1,
    position: 'absolute',
    top: 5,
    right: 0,
    transform: [{ rotate: '-45deg' }],
  },
  filtersPanel: {
    maxHeight: 400,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  dateRangeContainer: {
    gap: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  filterPillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterPillActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  clearFiltersButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  clearFiltersButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
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
  emptyIcon: {
    fontSize: 48,
    color: '#d1d5db',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
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

export default SearchScreen;
