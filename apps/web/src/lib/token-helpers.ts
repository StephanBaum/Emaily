/**
 * Token Helper Utilities
 *
 * Provides helper functions to fetch and decrypt OAuth tokens for email services.
 * These utilities bridge the gap between encrypted tokens in the database and
 * the plaintext tokens needed by Gmail/Outlook API clients.
 */

import { prisma, decryptOAuthToken } from "@email-ai/database";
import { EmailOAuthTokens } from "./email/types";

/**
 * Provider type for email accounts
 */
type EmailProvider = "gmail" | "outlook";

/**
 * Error thrown when email account is not found or tokens are missing
 */
export class TokenNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenNotFoundError";
  }
}

/**
 * Error thrown when token decryption fails
 */
export class TokenDecryptionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = "TokenDecryptionError";
  }
}

/**
 * Get decrypted OAuth tokens for a user's email account by provider.
 *
 * Fetches the email account from the database, decrypts the stored tokens,
 * and returns them in a format suitable for creating email service instances.
 *
 * @param userId - The user's ID
 * @param provider - The email provider ('gmail' or 'outlook')
 * @returns Decrypted OAuth tokens ready for use
 * @throws {TokenNotFoundError} If no account exists for the user/provider combination
 * @throws {TokenDecryptionError} If token decryption fails
 *
 * @example
 * const tokens = await getDecryptedTokensForUser(userId, 'gmail');
 * const gmailService = createGmailService(tokens);
 */
export async function getDecryptedTokensForUser(
  userId: string,
  provider: EmailProvider
): Promise<EmailOAuthTokens> {
  // DECRYPTION FLOW STEP 1: Fetch encrypted tokens from the database
  // The tokens stored in the database are encrypted base64 strings - not usable yet
  const emailAccount = await prisma.emailAccount.findFirst({
    where: {
      userId,
      provider,
    },
    select: {
      accessToken: true,
      refreshToken: true,
    },
  });

  if (!emailAccount) {
    throw new TokenNotFoundError(
      `No ${provider} account found for user ${userId}`
    );
  }

  // DECRYPTION FLOW STEP 2: Decrypt the tokens for use with email APIs
  // This converts the encrypted tokens back to plaintext OAuth tokens
  // that can be used to make Gmail/Outlook API calls
  try {
    const decryptedAccessToken = decryptOAuthToken(emailAccount.accessToken);
    const decryptedRefreshToken = decryptOAuthToken(emailAccount.refreshToken);

    // Validate that we successfully decrypted an access token
    // Access tokens are required, refresh tokens are optional
    if (!decryptedAccessToken) {
      throw new TokenDecryptionError(
        `Access token decryption returned null for user ${userId}, provider ${provider}`
      );
    }

    // DECRYPTION FLOW STEP 3: Return plaintext tokens ready for API use
    // These tokens can now be used directly with Gmail/Outlook API clients
    return {
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
    };
  } catch (error) {
    if (error instanceof TokenDecryptionError) {
      throw error;
    }
    throw new TokenDecryptionError(
      `Failed to decrypt tokens for user ${userId}, provider ${provider}`,
      error as Error
    );
  }
}

/**
 * Get decrypted OAuth tokens for an email account by account ID.
 *
 * Fetches the email account from the database by ID, decrypts the stored tokens,
 * and returns them in a format suitable for creating email service instances.
 * This is useful when you already have the account ID from a previous query.
 *
 * @param accountId - The email account ID
 * @returns Decrypted OAuth tokens ready for use
 * @throws {TokenNotFoundError} If the account doesn't exist
 * @throws {TokenDecryptionError} If token decryption fails
 *
 * @example
 * const tokens = await getDecryptedTokensByAccountId(accountId);
 * const provider = createEmailProvider(account.provider, tokens);
 */
export async function getDecryptedTokensByAccountId(
  accountId: string
): Promise<EmailOAuthTokens> {
  // DECRYPTION FLOW STEP 1: Fetch encrypted tokens from database by account ID
  const emailAccount = await prisma.emailAccount.findUnique({
    where: { id: accountId },
    select: {
      accessToken: true,
      refreshToken: true,
    },
  });

  if (!emailAccount) {
    throw new TokenNotFoundError(`Email account ${accountId} not found`);
  }

  // DECRYPTION FLOW STEP 2: Decrypt the encrypted tokens to plaintext
  try {
    const decryptedAccessToken = decryptOAuthToken(emailAccount.accessToken);
    const decryptedRefreshToken = decryptOAuthToken(emailAccount.refreshToken);

    if (!decryptedAccessToken) {
      throw new TokenDecryptionError(
        `Access token decryption returned null for account ${accountId}`
      );
    }

    // DECRYPTION FLOW STEP 3: Return plaintext tokens for API usage
    return {
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
    };
  } catch (error) {
    if (error instanceof TokenDecryptionError) {
      throw error;
    }
    throw new TokenDecryptionError(
      `Failed to decrypt tokens for account ${accountId}`,
      error as Error
    );
  }
}

/**
 * Get decrypted OAuth tokens for all email accounts belonging to a user.
 *
 * Fetches all email accounts for the user, decrypts their tokens, and returns
 * them grouped by account ID. Useful for syncing multiple accounts in parallel.
 *
 * @param userId - The user's ID
 * @returns Map of account ID to decrypted tokens
 * @throws {TokenDecryptionError} If any token decryption fails
 *
 * @example
 * const allTokens = await getAllDecryptedTokensForUser(userId);
 * for (const [accountId, tokens] of Object.entries(allTokens)) {
 *   const service = createEmailProvider(accounts[accountId].provider, tokens);
 *   await service.fetchEmails();
 * }
 */
export async function getAllDecryptedTokensForUser(
  userId: string
): Promise<Record<string, EmailOAuthTokens>> {
  // DECRYPTION FLOW STEP 1: Fetch all encrypted tokens for the user's accounts
  // This retrieves encrypted tokens for all providers (Gmail, Outlook, etc.)
  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
    },
  });

  const result: Record<string, EmailOAuthTokens> = {};

  // DECRYPTION FLOW STEP 2: Decrypt tokens for each account individually
  // Each account gets its tokens decrypted in sequence to avoid overwhelming the system
  for (const account of emailAccounts) {
    try {
      const decryptedAccessToken = decryptOAuthToken(account.accessToken);
      const decryptedRefreshToken = decryptOAuthToken(account.refreshToken);

      if (!decryptedAccessToken) {
        throw new TokenDecryptionError(
          `Access token decryption returned null for account ${account.id}`
        );
      }

      // DECRYPTION FLOW STEP 3: Build result map with plaintext tokens
      // The result maps each account ID to its decrypted, API-ready tokens
      result[account.id] = {
        accessToken: decryptedAccessToken,
        refreshToken: decryptedRefreshToken,
      };
    } catch (error) {
      if (error instanceof TokenDecryptionError) {
        throw error;
      }
      throw new TokenDecryptionError(
        `Failed to decrypt tokens for account ${account.id}`,
        error as Error
      );
    }
  }

  return result;
}

/**
 * Decrypt tokens from a raw database account object.
 *
 * This is a lower-level utility for when you've already fetched the account
 * and just need to decrypt the tokens. Useful for avoiding additional database
 * queries when you already have the account data.
 *
 * @param account - Account object with encrypted tokens
 * @returns Decrypted OAuth tokens
 * @throws {TokenDecryptionError} If token decryption fails
 *
 * @example
 * const account = await prisma.emailAccount.findFirst({ where: { userId } });
 * const tokens = decryptAccountTokens(account);
 * const service = createEmailProvider(account.provider, tokens);
 */
export function decryptAccountTokens(account: {
  accessToken: string;
  refreshToken: string | null;
}): EmailOAuthTokens {
  try {
    // DECRYPTION FLOW: Decrypt tokens from an already-fetched account object
    // This is a lightweight helper that skips the database query when you
    // already have the account data and just need plaintext tokens
    const decryptedAccessToken = decryptOAuthToken(account.accessToken);
    const decryptedRefreshToken = decryptOAuthToken(account.refreshToken);

    if (!decryptedAccessToken) {
      throw new TokenDecryptionError("Access token decryption returned null");
    }

    // Return plaintext tokens ready for API usage
    return {
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
    };
  } catch (error) {
    if (error instanceof TokenDecryptionError) {
      throw error;
    }
    throw new TokenDecryptionError(
      "Failed to decrypt account tokens",
      error as Error
    );
  }
}
