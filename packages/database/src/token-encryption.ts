import { encryptToken, decryptToken } from "./crypto";

/**
 * OAuth Token Encryption Wrapper
 *
 * This module provides high-level utilities for encrypting and decrypting
 * OAuth tokens before storing them in the database. It wraps the low-level
 * crypto functions with OAuth-specific error handling and null safety.
 */

/**
 * Encrypts an OAuth token for secure storage in the database.
 *
 * This function wraps the low-level encryption with OAuth-specific handling,
 * including proper null/undefined checks for optional tokens.
 *
 * @param token - The OAuth token to encrypt (access token, refresh token, etc.)
 * @returns Encrypted token as a base64 string, or null if input is null/undefined
 * @throws {Error} If encryption fails or OAUTH_ENCRYPTION_KEY is not configured
 *
 * @example
 * const encrypted = encryptOAuthToken(account.access_token);
 * await prisma.account.create({ data: { access_token: encrypted } });
 */
export function encryptOAuthToken(token: string | null | undefined): string | null {
  // Handle null/undefined tokens gracefully
  if (!token) {
    return null;
  }

  try {
    return encryptToken(token);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OAuth token encryption failed: ${error.message}`);
    }
    throw new Error("OAuth token encryption failed: Unknown error");
  }
}

/**
 * Decrypts an OAuth token retrieved from the database.
 *
 * This function wraps the low-level decryption with OAuth-specific handling,
 * including proper null/undefined checks for optional tokens.
 *
 * @param encryptedToken - The encrypted token from the database
 * @returns Decrypted plaintext token, or null if input is null/undefined
 * @throws {Error} If decryption fails, auth tag is invalid, or key is wrong
 *
 * @example
 * const account = await prisma.account.findUnique({ where: { id } });
 * const accessToken = decryptOAuthToken(account.access_token);
 */
export function decryptOAuthToken(encryptedToken: string | null | undefined): string | null {
  // Handle null/undefined tokens gracefully
  if (!encryptedToken) {
    return null;
  }

  try {
    return decryptToken(encryptedToken);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OAuth token decryption failed: ${error.message}`);
    }
    throw new Error("OAuth token decryption failed: Unknown error");
  }
}

/**
 * Token pair containing both access and refresh tokens
 */
export interface TokenPair {
  accessToken: string | null;
  refreshToken?: string | null;
}

/**
 * Encrypted token pair
 */
export interface EncryptedTokenPair {
  accessToken: string | null;
  refreshToken?: string | null;
}

/**
 * Encrypts a pair of OAuth tokens (access token and optional refresh token).
 *
 * Useful when storing OAuth account credentials that include both tokens.
 *
 * @param tokens - Object containing access_token and optional refresh_token
 * @returns Object with encrypted tokens
 * @throws {Error} If encryption fails
 *
 * @example
 * const encrypted = encryptOAuthTokens({
 *   accessToken: account.access_token,
 *   refreshToken: account.refresh_token
 * });
 * await prisma.account.create({
 *   data: {
 *     access_token: encrypted.accessToken,
 *     refresh_token: encrypted.refreshToken
 *   }
 * });
 */
export function encryptOAuthTokens(tokens: TokenPair): EncryptedTokenPair {
  return {
    accessToken: encryptOAuthToken(tokens.accessToken),
    refreshToken: tokens.refreshToken !== undefined
      ? encryptOAuthToken(tokens.refreshToken)
      : undefined,
  };
}

/**
 * Decrypts a pair of OAuth tokens (access token and optional refresh token).
 *
 * Useful when retrieving OAuth account credentials from the database.
 *
 * @param encryptedTokens - Object containing encrypted access_token and optional refresh_token
 * @returns Object with decrypted tokens
 * @throws {Error} If decryption fails
 *
 * @example
 * const account = await prisma.account.findUnique({ where: { id } });
 * const tokens = decryptOAuthTokens({
 *   accessToken: account.access_token,
 *   refreshToken: account.refresh_token
 * });
 * // Use tokens.accessToken and tokens.refreshToken
 */
export function decryptOAuthTokens(encryptedTokens: EncryptedTokenPair): TokenPair {
  return {
    accessToken: decryptOAuthToken(encryptedTokens.accessToken),
    refreshToken: encryptedTokens.refreshToken !== undefined
      ? decryptOAuthToken(encryptedTokens.refreshToken)
      : undefined,
  };
}

/**
 * Batch encrypts multiple OAuth tokens.
 *
 * Useful for migration scripts that need to encrypt many tokens at once.
 *
 * @param tokens - Array of tokens to encrypt
 * @returns Array of encrypted tokens in the same order
 * @throws {Error} If any encryption fails
 *
 * @example
 * const plainTokens = accounts.map(a => a.access_token);
 * const encrypted = batchEncryptTokens(plainTokens);
 */
export function batchEncryptTokens(tokens: (string | null)[]): (string | null)[] {
  return tokens.map(token => encryptOAuthToken(token));
}

/**
 * Batch decrypts multiple OAuth tokens.
 *
 * Useful for bulk operations that need to decrypt many tokens at once.
 *
 * @param encryptedTokens - Array of encrypted tokens to decrypt
 * @returns Array of decrypted tokens in the same order
 * @throws {Error} If any decryption fails
 *
 * @example
 * const accounts = await prisma.account.findMany();
 * const encryptedTokens = accounts.map(a => a.access_token);
 * const decrypted = batchDecryptTokens(encryptedTokens);
 */
export function batchDecryptTokens(encryptedTokens: (string | null)[]): (string | null)[] {
  return encryptedTokens.map(token => decryptOAuthToken(token));
}
