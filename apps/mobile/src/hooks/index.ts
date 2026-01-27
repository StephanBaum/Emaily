/**
 * Mobile app hooks
 *
 * This module exports all custom hooks for the mobile application.
 */

export {
  useAuth,
  default as useAuthDefault,
  type User,
  type AuthTokens,
  type AuthState,
  type AuthActions,
  type UseAuthReturn,
} from './useAuth';

export {
  useEmails,
  default as useEmailsDefault,
  type Email,
  type EmailAddress,
  type EmailCategory,
  type FetchEmailsOptions,
  type UseEmailsState,
  type UseEmailsActions,
  type UseEmailsReturn,
} from './useEmails';

export {
  useUserProfile,
  default as useUserProfileDefault,
  type UserProfile,
  type UserProfileUpdate,
  type UseUserProfileState,
  type UseUserProfileActions,
  type UseUserProfileReturn,
} from './useUserProfile';
