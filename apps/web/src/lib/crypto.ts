/**
 * Cryptographic utilities for secure credential storage
 * Uses AES-256-GCM for encrypting IMAP passwords
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256 key length in bytes (256 bits = 32 bytes) */
const KEY_LENGTH = 32;
/** GCM initialization vector length in bytes (96 bits = 12 bytes) */
const IV_LENGTH = 12;
/** GCM authentication tag length in bytes (128 bits = 16 bytes) */
const AUTH_TAG_LENGTH = 16;
/** Encryption algorithm */
const ALGORITHM = "aes-256-gcm";

/**
 * Error thrown when encryption/decryption operations fail
 */
export class CryptoError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_KEY" | "ENCRYPTION_FAILED" | "DECRYPTION_FAILED" | "INVALID_DATA"
  ) {
    super(message);
    this.name = "CryptoError";
  }
}

/**
 * Gets and validates the encryption key from environment variables
 * @returns The validated encryption key as a Buffer
 * @throws CryptoError if ENCRYPTION_KEY is missing or invalid
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new CryptoError(
      "ENCRYPTION_KEY environment variable is not set. Please set a 32-byte hex string.",
      "INVALID_KEY"
    );
  }

  // Remove any whitespace and validate hex format
  const cleanedKey = keyHex.trim();
  if (!/^[0-9a-fA-F]+$/.test(cleanedKey)) {
    throw new CryptoError(
      "ENCRYPTION_KEY must be a valid hexadecimal string",
      "INVALID_KEY"
    );
  }

  const keyBuffer = Buffer.from(cleanedKey, "hex");

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new CryptoError(
      `ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes). Got ${cleanedKey.length} characters.`,
      "INVALID_KEY"
    );
  }

  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 *
 * The output format is: base64(iv + authTag + ciphertext)
 * - iv: 12 bytes (96 bits) - unique per encryption
 * - authTag: 16 bytes (128 bits) - authentication tag for integrity
 * - ciphertext: variable length - the encrypted data
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted data containing IV, auth tag, and ciphertext
 * @throws CryptoError if encryption fails
 *
 * @example
 * ```typescript
 * const encrypted = encrypt("my-secret-password");
 * // Returns: base64 string like "abc123..."
 * ```
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new CryptoError("Plaintext must be a string", "INVALID_DATA");
  }

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine: iv + authTag + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString("base64");
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(
      `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ENCRYPTION_FAILED"
    );
  }
}

/**
 * Decrypts an AES-256-GCM encrypted string
 *
 * @param encryptedData - Base64-encoded encrypted data (format: iv + authTag + ciphertext)
 * @returns The decrypted plaintext string
 * @throws CryptoError if decryption fails or data is tampered
 *
 * @example
 * ```typescript
 * const password = decrypt(encryptedPassword);
 * // Returns: "my-secret-password"
 * ```
 */
export function decrypt(encryptedData: string): string {
  if (typeof encryptedData !== "string" || encryptedData.length === 0) {
    throw new CryptoError("Encrypted data must be a non-empty string", "INVALID_DATA");
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, "base64");

    // Minimum size: IV + authTag (no ciphertext for empty string encryption)
    const minSize = IV_LENGTH + AUTH_TAG_LENGTH;
    if (combined.length < minSize) {
      throw new CryptoError(
        "Encrypted data is too short to be valid",
        "INVALID_DATA"
      );
    }

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    // GCM authentication failure typically throws "Unsupported state or unable to authenticate data"
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("authenticate")) {
      throw new CryptoError(
        "Decryption failed: Data may be corrupted or tampered with",
        "DECRYPTION_FAILED"
      );
    }
    throw new CryptoError(
      `Decryption failed: ${errorMessage}`,
      "DECRYPTION_FAILED"
    );
  }
}

/**
 * Generates a random encryption key for initial setup
 * This is a utility function for generating the ENCRYPTION_KEY environment variable
 *
 * @returns A 64-character hexadecimal string (32 bytes)
 *
 * @example
 * ```typescript
 * const key = generateEncryptionKey();
 * // Set this in your .env file:
 * // ENCRYPTION_KEY=<generated key>
 * ```
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}
