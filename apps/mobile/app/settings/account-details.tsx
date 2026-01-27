import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserProfile } from '../../src/hooks/useUserProfile';

/**
 * Profile field display component
 */
interface ProfileFieldProps {
  label: string;
  value: string;
  editable?: boolean;
  onEdit?: () => void;
}

function ProfileField({
  label,
  value,
  editable = false,
  onEdit,
}: ProfileFieldProps): JSX.Element {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueContainer}>
        <Text style={styles.fieldValue}>{value}</Text>
        {editable && onEdit && (
          <Pressable onPress={onEdit} style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Edit name modal component
 */
interface EditNameModalProps {
  currentName: string | null;
  onSave: (name: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function EditNameModal({
  currentName,
  onSave,
  onCancel,
  isSaving,
}: EditNameModalProps): JSX.Element {
  const [name, setName] = useState(currentName || '');

  const handleSave = useCallback((): void => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    onSave(name.trim());
  }, [name, onSave]);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Edit Name</Text>
        <TextInput
          style={styles.modalInput}
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          autoFocus
          editable={!isSaving}
        />
        <View style={styles.modalActions}>
          <Pressable
            onPress={onCancel}
            style={[styles.modalButton, styles.modalButtonCancel]}
            disabled={isSaving}
          >
            <Text style={styles.modalButtonTextCancel}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            style={[styles.modalButton, styles.modalButtonSave]}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalButtonTextSave}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Loading state component
 */
function LoadingState(): JSX.Element {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>Loading profile...</Text>
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
    <View style={styles.centerContainer}>
      <Text style={styles.errorIcon}>!</Text>
      <Text style={styles.errorTitle}>Unable to load profile</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

/**
 * Account Details Screen
 *
 * Displays user profile information and allows editing of name field.
 * Shows email, name, profile image, and account creation date.
 *
 * @example
 * ```tsx
 * // Navigation from settings
 * router.push('/settings/account-details')
 * ```
 */
export default function AccountDetailsScreen(): JSX.Element {
  const {
    profile,
    isLoading,
    isUpdating,
    error,
    refresh,
    updateProfile,
  } = useUserProfile();

  const [isEditingName, setIsEditingName] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  /**
   * Handle name edit save
   */
  const handleSaveName = useCallback(
    async (newName: string): Promise<void> => {
      try {
        await updateProfile({ name: newName });
        setIsEditingName(false);
        Alert.alert('Success', 'Profile updated successfully');
      } catch (err) {
        Alert.alert(
          'Error',
          err instanceof Error ? err.message : 'Failed to update profile'
        );
      }
    },
    [updateProfile]
  );

  /**
   * Format date for display
   */
  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  /**
   * Get provider display name
   */
  const getProviderName = useCallback((provider: string): string => {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'microsoft':
        return 'Microsoft';
      default:
        return provider;
    }
  }, []);

  // Show loading state
  if (isLoading && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  // Show error state
  if (error && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ErrorState message={error.message} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  // Profile should exist at this point
  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ErrorState
          message="Profile not loaded"
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.header}>
          {profile.image ? (
            <Image source={{ uri: profile.image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {profile.name?.[0]?.toUpperCase() || profile.email[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.headerEmail}>{profile.email}</Text>
          <Text style={styles.headerProvider}>
            Signed in with {getProviderName(profile.provider)}
          </Text>
        </View>

        {/* Profile Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          <View style={styles.sectionContent}>
            <ProfileField
              label="Name"
              value={profile.name || 'Not set'}
              editable
              onEdit={() => setIsEditingName(true)}
            />
            <ProfileField label="Email" value={profile.email} />
            <ProfileField
              label="Account Provider"
              value={getProviderName(profile.provider)}
            />
            <ProfileField
              label="Member Since"
              value={formatDate(profile.createdAt)}
            />
          </View>
        </View>

        {/* Account Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Status</Text>
          <View style={styles.sectionContent}>
            <View style={styles.statusItem}>
              <View style={styles.statusIndicator} />
              <Text style={styles.statusText}>Account Active</Text>
            </View>
            <Text style={styles.statusSubtext}>
              Last updated: {formatDate(profile.updatedAt)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      {isEditingName && (
        <EditNameModal
          currentName={profile.name}
          onSave={handleSaveName}
          onCancel={() => setIsEditingName(false)}
          isSaving={isUpdating}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  // Loading state
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  // Error state
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: '#ef4444',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Header
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#fff',
  },
  headerEmail: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerProvider: {
    fontSize: 14,
    color: '#6b7280',
  },
  // Section
  section: {
    marginTop: 16,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionContent: {
    paddingVertical: 8,
  },
  // Profile field
  fieldContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  fieldLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  fieldValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldValue: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Status
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    marginRight: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  statusSubtext: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  // Edit modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonSave: {
    backgroundColor: '#3b82f6',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
