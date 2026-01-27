import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';

/**
 * Recent search entry stored in AsyncStorage
 */
export interface RecentSearch {
  id: string;
  query: string;
  timestamp: number;
}

/**
 * Props for the SearchBar component
 */
export interface SearchBarProps {
  /** Current search query value */
  value?: string;
  /** Callback when search query changes (debounced) */
  onSearch?: (query: string) => void;
  /** Callback when user selects a recent search */
  onSelectRecent?: (query: string) => void;
  /** Recent search history entries */
  recentSearches?: RecentSearch[];
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Called when the clear button is pressed */
  onClear?: () => void;
  /** Whether to show recent searches dropdown */
  showRecents?: boolean;
}

/**
 * Search icon component
 */
function SearchIcon(): JSX.Element {
  return (
    <View style={styles.icon}>
      <View style={styles.iconCircle} />
      <View style={styles.iconHandle} />
    </View>
  );
}

/**
 * Clock icon for recent searches
 */
function ClockIcon(): JSX.Element {
  return (
    <View style={styles.clockIcon}>
      <View style={styles.clockCircle} />
      <View style={styles.clockHand} />
    </View>
  );
}

/**
 * Close/X icon for clear button
 */
function CloseIcon(): JSX.Element {
  return (
    <View style={styles.closeIcon}>
      <View style={styles.closeLine1} />
      <View style={styles.closeLine2} />
    </View>
  );
}

/**
 * Recent searches list component
 */
interface RecentSearchesListProps {
  searches: RecentSearch[];
  onSelect: (query: string) => void;
  isLoading: boolean;
}

function RecentSearchesList({
  searches,
  onSelect,
  isLoading,
}: RecentSearchesListProps): JSX.Element {
  const handleSelect = useCallback(
    (query: string) => (): void => {
      onSelect(query);
    },
    [onSelect]
  );

  const renderItem: ListRenderItem<RecentSearch> = useCallback(
    ({ item }) => (
      <Pressable
        style={styles.recentItem}
        onPress={handleSelect(item.query)}
        accessibilityRole="button"
        accessibilityLabel={`Search for ${item.query}`}
      >
        <ClockIcon />
        <Text style={styles.recentItemText} numberOfLines={1}>
          {item.query}
        </Text>
      </Pressable>
    ),
    [handleSelect]
  );

  const keyExtractor = useCallback((item: RecentSearch): string => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.recentLoadingContainer}>
        <ActivityIndicator size="small" color="#6b7280" />
      </View>
    );
  }

  if (searches.length === 0) {
    return (
      <View style={styles.recentEmptyContainer}>
        <Text style={styles.recentEmptyText}>No recent searches</Text>
      </View>
    );
  }

  return (
    <View style={styles.recentListContainer}>
      <Text style={styles.recentListHeader}>Recent Searches</Text>
      <FlatList
        data={searches}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.recentList}
        scrollEnabled={false}
      />
    </View>
  );
}

/**
 * SearchBar component for mobile email search
 *
 * Features:
 * - Debounced search input (default 300ms)
 * - Recent searches dropdown
 * - Clear button when input has value
 * - Loading state indicator
 * - Full accessibility support
 * - Recent searches stored in AsyncStorage
 *
 * @example
 * ```tsx
 * <SearchBar
 *   value={searchQuery}
 *   onSearch={handleSearch}
 *   recentSearches={recentSearches}
 *   onSelectRecent={handleSelectRecent}
 *   placeholder="Search emails..."
 * />
 * ```
 */
export function SearchBar({
  value = '',
  onSearch,
  onSelectRecent,
  recentSearches = [],
  isLoading = false,
  placeholder = 'Search emails...',
  debounceMs = 300,
  onClear,
  showRecents = true,
}: SearchBarProps): JSX.Element {
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update internal state when external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounced search callback
  const debouncedSearch = useCallback(
    (query: string): void => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onSearch?.(query);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  // Handle input change
  const handleChangeText = useCallback(
    (text: string): void => {
      setInputValue(text);
      debouncedSearch(text);
    },
    [debouncedSearch]
  );

  // Handle clear button press
  const handleClear = useCallback((): void => {
    setInputValue('');
    onSearch?.('');
    onClear?.();
    inputRef.current?.focus();
  }, [onSearch, onClear]);

  // Handle recent search selection
  const handleSelectRecent = useCallback(
    (query: string): void => {
      setInputValue(query);
      setShowDropdown(false);
      onSelectRecent?.(query);
      onSearch?.(query);
      inputRef.current?.blur();
    },
    [onSearch, onSelectRecent]
  );

  // Handle input focus
  const handleFocus = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>): void => {
      setIsFocused(true);
      if (showRecents && recentSearches.length > 0) {
        setShowDropdown(true);
      }
    },
    [showRecents, recentSearches.length]
  );

  // Handle input blur
  const handleBlur = useCallback((): void => {
    setIsFocused(false);
  }, []);

  // Handle modal close
  const handleCloseDropdown = useCallback((): void => {
    setShowDropdown(false);
    inputRef.current?.blur();
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          {/* Search icon */}
          <View style={styles.iconContainer}>
            <SearchIcon />
          </View>

          {/* Search input */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputValue}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            returnKeyType="search"
            clearButtonMode="never"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search emails"
            accessibilityHint="Enter search terms to find emails"
          />

          {/* Loading indicator or clear button */}
          {isLoading ? (
            <View style={styles.clearButtonContainer}>
              <ActivityIndicator size="small" color="#6b7280" />
            </View>
          ) : inputValue ? (
            <Pressable
              style={styles.clearButtonContainer}
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <CloseIcon />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Recent searches modal/dropdown */}
      <Modal
        visible={showDropdown && isFocused}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDropdown}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseDropdown}>
          <Pressable style={styles.dropdownContainer} onPress={(e) => e.stopPropagation()}>
            <RecentSearchesList
              searches={recentSearches}
              onSelect={handleSelectRecent}
              isLoading={false}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * Styles for SearchBar component
 */
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  iconContainer: {
    marginRight: 8,
  },
  icon: {
    width: 18,
    height: 18,
    position: 'relative',
  },
  iconCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6b7280',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  iconHandle: {
    width: 6,
    height: 2,
    backgroundColor: '#6b7280',
    borderRadius: 1,
    position: 'absolute',
    bottom: 0,
    right: 0,
    transform: [{ rotate: '45deg' }],
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  clearButtonContainer: {
    marginLeft: 8,
    padding: 4,
  },
  closeIcon: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  closeLine1: {
    width: 16,
    height: 2,
    backgroundColor: '#6b7280',
    borderRadius: 1,
    position: 'absolute',
    top: 7,
    left: 0,
    transform: [{ rotate: '45deg' }],
  },
  closeLine2: {
    width: 16,
    height: 2,
    backgroundColor: '#6b7280',
    borderRadius: 1,
    position: 'absolute',
    top: 7,
    left: 0,
    transform: [{ rotate: '-45deg' }],
  },
  clockIcon: {
    width: 16,
    height: 16,
    position: 'relative',
    marginRight: 12,
  },
  clockCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9ca3af',
    position: 'absolute',
  },
  clockHand: {
    width: 5,
    height: 2,
    backgroundColor: '#9ca3af',
    borderRadius: 1,
    position: 'absolute',
    top: 7,
    left: 7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  dropdownContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 80,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 400,
  },
  recentListContainer: {
    paddingVertical: 8,
  },
  recentListHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  recentList: {
    maxHeight: 300,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  recentItemText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  recentLoadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentEmptyContainer: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  recentEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
