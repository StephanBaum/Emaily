import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Encrypt sensitive data (like IMAP passwords)
 * Uses AES-256-GCM for authenticated encryption
 */
export function encrypt(plaintext: string, masterKey: string): string {
  // Derive a key from the master key using scrypt
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(masterKey, salt, 32);

  // Generate IV
  const iv = randomBytes(IV_LENGTH);

  // Encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + encrypted
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString("base64");
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string, masterKey: string): string {
  const combined = Buffer.from(encryptedData, "base64");

  // Extract parts
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key
  const key = scryptSync(masterKey, salt, 32);

  // Decrypt
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Generate a secure master key (for initial setup)
 */
export function generateMasterKey(): string {
  return randomBytes(32).toString("base64");
}

/**
 * Hash sensitive data for blind indexing (searchable encryption)
 * Uses HMAC-SHA256 with a separate key
 */
export function blindIndex(data: string, indexKey: string): string {
  return createHmac("sha256", indexKey).update(data.toLowerCase()).digest("hex");
}
