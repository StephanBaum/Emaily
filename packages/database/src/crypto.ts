/**
 * Cryptographic Utilities for OAuth Token Encryption
 *
 * This module provides AES-256-GCM encryption and decryption functions
 * for securing OAuth tokens in the database.
 *
 * Environment Requirements:
 * - OAUTH_ENCRYPTION_KEY: A 256-bit (32-byte) base64-encoded encryption key
 *   Generate with: openssl rand -base64 32
 */

import crypto from "crypto";

/**
 * Encryption algorithm configuration
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the encryption key from environment variables
 *
 * @throws {Error} If OAUTH_ENCRYPTION_KEY is not set or invalid
 * @returns Buffer containing the 32-byte encryption key
 */
function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "OAUTH_ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(key, "base64");
  } catch (error) {
    throw new Error(
      "OAUTH_ENCRYPTION_KEY must be a valid base64-encoded string. " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `OAUTH_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${
        KEY_LENGTH * 8
      } bits) when decoded. ` +
        `Got ${keyBuffer.length} bytes. Generate a valid key with: openssl rand -base64 32`
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a token using AES-256-GCM
 *
 * The output format is: IV (12 bytes) + Encrypted Data + Auth Tag (16 bytes)
 * All encoded as base64 for storage in the database.
 *
 * @param plaintext - The token to encrypt
 * @returns Base64-encoded encrypted token with IV and auth tag
 * @throws {Error} If encryption fails or OAUTH_ENCRYPTION_KEY is not set
 *
 * @example
 * const encrypted = encryptToken("my_access_token");
 * // Returns: base64 string like "AgkKCwwNDg8QERITFBUWFxgZGhscHR4fIC..."
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty or null token");
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the plaintext
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    // Concatenate: IV + encrypted data + auth tag
    const result = Buffer.concat([iv, encrypted, authTag]);

    // Return as base64 for database storage
    return result.toString("base64");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Token encryption failed: ${error.message}`);
    }
    throw new Error("Token encryption failed: Unknown error");
  }
}

/**
 * Decrypt a token that was encrypted with encryptToken()
 *
 * @param ciphertext - Base64-encoded encrypted token (IV + data + auth tag)
 * @returns The decrypted plaintext token
 * @throws {Error} If decryption fails, auth tag is invalid, or key is wrong
 *
 * @example
 * const decrypted = decryptToken("AgkKCwwNDg8QERITFBUWFxgZGhscHR4fIC...");
 * // Returns: "my_access_token"
 */
export function decryptToken(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error("Cannot decrypt empty or null token");
  }

  try {
    const key = getEncryptionKey();

    // Decode from base64
    const buffer = Buffer.from(ciphertext, "base64");

    // Validate minimum length (IV + auth tag = 28 bytes minimum)
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error(
        "Invalid encrypted token: Data too short to contain IV and auth tag"
      );
    }

    // Extract components
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    if (error instanceof Error) {
      // Authentication tag verification failure indicates wrong key or corrupted data
      if (error.message.includes("auth")) {
        throw new Error(
          "Token decryption failed: Invalid authentication tag. " +
            "The encryption key may be incorrect or the data may be corrupted."
        );
      }
      throw new Error(`Token decryption failed: ${error.message}`);
    }
    throw new Error("Token decryption failed: Unknown error");
  }
}
