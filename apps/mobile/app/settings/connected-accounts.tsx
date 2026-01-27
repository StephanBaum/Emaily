import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useConnectedAccounts, type ConnectedAccount } from '../../src/hooks/useConnectedAccounts';

/**
 * Props for AccountItem component
 */
interface AccountItemProps {
  account: ConnectedAccount;
  onDisconnect: (accountId: string) => void;
  isDisconnecting: boolean;
}

/**
 * Account item component - displays a single connected account
 */
function AccountItem({
  account,
  onDisconnect,
  isDisconnecting,
}: AccountItemProps): JSX.Element {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDisconnect = useCallback((): void => {
    Alert.alert(
      'Disconnect Account',
      `Are you sure you want to disconnect this ${account.provider} account?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => onDisconnect(account.id),
        },
      ]
    );
  }, [account.provider, account.id, onDisconnect]);

  return (
    <View style={styles.accountItem}>
      <View style={styles.accountInfo}>
        <View style={styles.providerBadge}>
          <Text style={styles.providerInitial}>
            {account.provider.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.accountDetails}>
          <Text style={styles.providerName}>{account.provider}</Text>
          <Text style={styles.accountEmail}>Account ID: {account.id.slice(0, 8)}...</Text>
          <Text style={styles.connectedDate}>
            Connected {formatDate(account.createdAt)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.disconnectButton,
          isDisconnecting && styles.disconnectButtonDisabled,
        ]}
        onPress={handleDisconnect}
        disabled={isDisconnecting}
        activeOpacity={0.7}
      >
        {isDisconnecting ? (
          <ActivityIndicator size="small" color="#dc2626" />
        ) : (
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

/**
 * Empty state component - shown when no accounts are connected
 */
function EmptyState(): JSX.Element {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔗</Text>
      <Text style={styles.emptyTitle}>No Connected Accounts</Text>
      <Text style={styles.emptySubtitle}>
        Connect your email accounts to sync messages across all your inboxes
      </Text>
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
      <Text style={styles.loadingText}>Loading accounts...</Text>
    </View>
  );
}

/**
 * Connected Accounts Screen
 *
 * Displays a list of connected email accounts and allows users
 * to disconnect accounts. Users can manage which email accounts
 * are synced with the application.
 *
 * @example
 * ```tsx
 * // Basic usage in navigation
 * <ConnectedAccountsScreen />
 * ```
 */
export default function ConnectedAccountsScreen(): JSX.Element {
  const router = useRouter();
  const {
    accounts,
    isLoading,
    error,
    disconnectAccount,
  } = useConnectedAccounts();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  /**
   * Handle account disconnection
   */
  const handleDisconnect = useCallback(
    async (accountId: string): Promise<void> => {
      setDisconnectingId(accountId);
      try {
        await disconnectAccount(accountId);
        Alert.alert('Success', 'Account disconnected successfully');
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to disconnect account'
        );
      } finally {
        setDisconnectingId(null);
      }
    },
    [disconnectAccount]
  );

  /**
   * Navigate to add account screen
   */
  const handleAddAccount = useCallback((): void => {
    // TODO: Navigate to add account flow
    Alert.alert('Add Account', 'Account connection flow coming soon');
  }, []);

  /**
   * Navigate back to settings
   */
  const handleBack = useCallback((): void => {
    router.back();
  }, [router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  // Add error state check
  if (error && accounts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load accounts</Text>
          <Text style={styles.errorSubtext}>{error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connected Accounts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Manage your connected email accounts. You can disconnect accounts at
            any time.
          </Text>
        </View>

        {/* Accounts List */}
        {accounts.length > 0 ? (
          <View style={styles.accountsList}>
            <Text style={styles.sectionTitle}>
              {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}{' '}
              Connected
            </Text>
            <View style={styles.accountsContainer}>
              {accounts.map((account) => (
                <AccountItem
                  key={account.id}
                  account={account}
                  onDisconnect={handleDisconnect}
                  isDisconnecting={disconnectingId === account.id}
                />
              ))}
            </View>
          </View>
        ) : (
          <EmptyState />
        )}

        {/* Add Account Button */}
        <View style={styles.addAccountContainer}>
          <TouchableOpacity
            style={styles.addAccountButton}
            onPress={handleAddAccount}
            activeOpacity={0.7}
          >
            <Text style={styles.addAccountButtonText}>+ Add Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 4,
    minWidth: 60,
  },
  backButtonText: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerSpacer: {
    minWidth: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  accountsList: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  accountsContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  providerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  providerInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  accountDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  connectedDate: {
    fontSize: 12,
    color: '#999',
  },
  disconnectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc2626',
    minWidth: 100,
    alignItems: 'center',
  },
  disconnectButtonDisabled: {
    opacity: 0.5,
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
  },
  addAccountContainer: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  addAccountButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
