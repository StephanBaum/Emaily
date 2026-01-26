import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

/**
 * Gmail icon as an SVG path rendered in React Native
 */
function GmailIcon(): JSX.Element {
  return (
    <View style={styles.iconContainer}>
      <Text style={styles.gmailIcon}>G</Text>
    </View>
  );
}

/**
 * Microsoft/Outlook icon
 */
function MicrosoftIcon(): JSX.Element {
  return (
    <View style={[styles.iconContainer, styles.microsoftIconContainer]}>
      <View style={styles.microsoftGrid}>
        <View style={[styles.microsoftSquare, { backgroundColor: '#F25022' }]} />
        <View style={[styles.microsoftSquare, { backgroundColor: '#7FBA00' }]} />
        <View style={[styles.microsoftSquare, { backgroundColor: '#00A4EF' }]} />
        <View style={[styles.microsoftSquare, { backgroundColor: '#FFB900' }]} />
      </View>
    </View>
  );
}

/**
 * Props for LoginButton component
 */
interface LoginButtonProps {
  provider: 'google' | 'microsoft';
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

/**
 * Reusable OAuth login button component
 */
function LoginButton({
  provider,
  onPress,
  disabled = false,
  isLoading = false,
}: LoginButtonProps): JSX.Element {
  const isGoogle = provider === 'google';
  const buttonStyle = isGoogle
    ? [styles.button, styles.googleButton]
    : [styles.button, styles.microsoftButton];
  const textStyle = isGoogle
    ? [styles.buttonText, styles.googleButtonText]
    : [styles.buttonText, styles.microsoftButtonText];

  const Icon = isGoogle ? GmailIcon : MicrosoftIcon;
  const label = isGoogle ? 'Sign in with Google' : 'Sign in with Microsoft';

  return (
    <Pressable
      style={({ pressed }) => [
        ...buttonStyle,
        pressed && styles.buttonPressed,
        (disabled || isLoading) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={isGoogle ? '#1a73e8' : '#ffffff'}
        />
      ) : (
        <Icon />
      )}
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

/**
 * Props for LoginScreen component
 */
export interface LoginScreenProps {
  /**
   * Optional callback when authentication succeeds
   */
  onAuthSuccess?: () => void;
}

/**
 * LoginScreen component with OAuth authentication for Google and Microsoft
 *
 * This screen provides OAuth sign-in buttons for connecting email accounts
 * from Gmail (Google) and Outlook (Microsoft). It handles the OAuth flow
 * and navigates to the inbox upon successful authentication.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LoginScreen />
 *
 * // With custom success handler
 * <LoginScreen onAuthSuccess={() => router.replace('/inbox')} />
 * ```
 */
export function LoginScreen({ onAuthSuccess }: LoginScreenProps): JSX.Element {
  const router = useRouter();
  const {
    isLoading,
    isAuthenticated,
    error,
    signInWithGoogle,
    signInWithMicrosoft,
  } = useAuth();

  /**
   * Handle Google sign-in
   */
  const handleGoogleSignIn = useCallback(async (): Promise<void> => {
    await signInWithGoogle();
  }, [signInWithGoogle]);

  /**
   * Handle Microsoft sign-in
   */
  const handleMicrosoftSignIn = useCallback(async (): Promise<void> => {
    await signInWithMicrosoft();
  }, [signInWithMicrosoft]);

  /**
   * Navigate to inbox when authenticated
   */
  React.useEffect(() => {
    if (isAuthenticated) {
      if (onAuthSuccess) {
        onAuthSuccess();
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, onAuthSuccess, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Logo and branding */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>@</Text>
          </View>
          <Text style={styles.title}>Email AI</Text>
          <Text style={styles.subtitle}>
            AI-powered email client for your inbox
          </Text>
        </View>

        {/* Features list */}
        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="+"
            title="Smart Categorization"
            description="AI automatically organizes your emails"
          />
          <FeatureItem
            icon="~"
            title="Quick Replies"
            description="Generate smart reply suggestions"
          />
          <FeatureItem
            icon="#"
            title="Priority Detection"
            description="Important emails are highlighted first"
          />
        </View>

        {/* Auth buttons */}
        <View style={styles.buttonContainer}>
          <LoginButton
            provider="google"
            onPress={handleGoogleSignIn}
            isLoading={isLoading}
          />
          <LoginButton
            provider="microsoft"
            onPress={handleMicrosoftSignIn}
            isLoading={isLoading}
          />
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}

        {/* Terms and privacy */}
        <Text style={styles.termsText}>
          By signing in, you agree to our{' '}
          <Text style={styles.linkText}>Terms of Service</Text> and{' '}
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * Feature item component for displaying app features
 */
interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps): JSX.Element {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Text style={styles.featureIconText}>{icon}</Text>
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1a73e8',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  featuresContainer: {
    gap: 16,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a73e8',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: '#666666',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 12,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  microsoftButton: {
    backgroundColor: '#0078d4',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  googleButtonText: {
    color: '#3c4043',
  },
  microsoftButtonText: {
    color: '#ffffff',
  },
  iconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gmailIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285f4',
  },
  microsoftIconContainer: {
    width: 20,
    height: 20,
  },
  microsoftGrid: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  microsoftSquare: {
    width: 8,
    height: 8,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#1a73e8',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
