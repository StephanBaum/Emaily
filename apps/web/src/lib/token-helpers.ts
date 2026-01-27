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
  // Fetch the email account from database
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

  // Decrypt the tokens
  try {
    const decryptedAccessToken = decryptOAuthToken(emailAccount.accessToken);
    const decryptedRefreshToken = decryptOAuthToken(emailAccount.refreshToken);

    if (!decryptedAccessToken) {
      throw new TokenDecryptionError(
        `Access token decryption returned null for user ${userId}, provider ${provider}`
      );
    }

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
  // Fetch the email account from database
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

  // Decrypt the tokens
  try {
    const decryptedAccessToken = decryptOAuthToken(emailAccount.accessToken);
    const decryptedRefreshToken = decryptOAuthToken(emailAccount.refreshToken);

    if (!decryptedAccessToken) {
      throw new TokenDecryptionError(
        `Access token decryption returned null for account ${accountId}`
      );
    }

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
  // Fetch all email accounts for the user
  const emailAccounts = await prisma.emailAccount.findMany({
    where: { userId },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
    },
  });

  const result: Record<string, EmailOAuthTokens> = {};

  // Decrypt tokens for each account
  for (const account of emailAccounts) {
    try {
      const decryptedAccessToken = decryptOAuthToken(account.accessToken);
      const decryptedRefreshToken = decryptOAuthToken(account.refreshToken);

      if (!decryptedAccessToken) {
        throw new TokenDecryptionError(
          `Access token decryption returned null for account ${account.id}`
        );
      }

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
    const decryptedAccessToken = decryptOAuthToken(account.accessToken);
    const decryptedRefreshToken = decryptOAuthToken(account.refreshToken);

    if (!decryptedAccessToken) {
      throw new TokenDecryptionError("Access token decryption returned null");
    }

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
