/**
 * Token Encryption Integration Tests
 *
 * These tests verify the complete OAuth token encryption flow including:
 * - Encryption/decryption of tokens
 * - Database storage and retrieval
 * - Token helper utilities
 *
 * Note: These are integration tests that require a database connection.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { prisma } from "../../src/client";
import { encryptOAuthToken, decryptOAuthToken } from "../../src/token-encryption";

describe("OAuth Token Encryption Integration", () => {
  const testUserId = "test-user-" + Date.now();
  const testAccessToken = "ya29.a0AfH6SMBxTestAccessToken123456789";
  const testRefreshToken = "1//0gqE9TestRefreshToken123456789";

  let encryptedAccessToken: string;
  let encryptedRefreshToken: string;

  beforeAll(() => {
    // Verify encryption key is configured
    if (!process.env.OAUTH_ENCRYPTION_KEY) {
      throw new Error(
        "OAUTH_ENCRYPTION_KEY must be set in environment for integration tests"
      );
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.emailAccount.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.account.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe("Token Encryption/Decryption", () => {
    it("should encrypt OAuth access token", () => {
      encryptedAccessToken = encryptOAuthToken(testAccessToken)!;

      expect(encryptedAccessToken).toBeDefined();
      expect(encryptedAccessToken).not.toBe(testAccessToken);
      expect(encryptedAccessToken.length).toBeGreaterThan(40);
      // Should be base64
      expect(encryptedAccessToken).toMatch(/^[A-Za-z0-9+/]+=*$/);
      // Should NOT look like OAuth token
      expect(encryptedAccessToken).not.toMatch(/^ya29\./);
    });

    it("should encrypt OAuth refresh token", () => {
      encryptedRefreshToken = encryptOAuthToken(testRefreshToken)!;

      expect(encryptedRefreshToken).toBeDefined();
      expect(encryptedRefreshToken).not.toBe(testRefreshToken);
      expect(encryptedRefreshToken.length).toBeGreaterThan(40);
      // Should be base64
      expect(encryptedRefreshToken).toMatch(/^[A-Za-z0-9+/]+=*$/);
      // Should NOT look like OAuth token
      expect(encryptedRefreshToken).not.toMatch(/^1\/\//);
    });

    it("should decrypt access token correctly", () => {
      const decrypted = decryptOAuthToken(encryptedAccessToken);

      expect(decrypted).toBe(testAccessToken);
    });

    it("should decrypt refresh token correctly", () => {
      const decrypted = decryptOAuthToken(encryptedRefreshToken);

      expect(decrypted).toBe(testRefreshToken);
    });

    it("should handle null tokens gracefully", () => {
      expect(encryptOAuthToken(null)).toBeNull();
      expect(encryptOAuthToken(undefined)).toBeNull();
      expect(decryptOAuthToken(null)).toBeNull();
      expect(decryptOAuthToken(undefined)).toBeNull();
    });

    it("should produce different encrypted values for same input", () => {
      // Due to random IV, encrypting same token twice should produce different results
      const encrypted1 = encryptOAuthToken(testAccessToken)!;
      const encrypted2 = encryptOAuthToken(testAccessToken)!;

      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same value
      expect(decryptOAuthToken(encrypted1)).toBe(testAccessToken);
      expect(decryptOAuthToken(encrypted2)).toBe(testAccessToken);
    });
  });

  describe("Database Integration", () => {
    let testAccountId: string;
    let testEmailAccountId: string;

    it("should store encrypted tokens in Account table", async () => {
      // Create test user first
      const user = await prisma.user.create({
        data: {
          id: testUserId,
          email: "test@example.com",
          name: "Test User",
        },
      });

      // Create account with encrypted tokens
      const account = await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "google",
          providerAccountId: "test-provider-id",
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          scope: "email profile",
          token_type: "Bearer",
        },
      });

      testAccountId = account.id;

      expect(account.access_token).toBe(encryptedAccessToken);
      expect(account.refresh_token).toBe(encryptedRefreshToken);
    });

    it("should retrieve and decrypt tokens from Account table", async () => {
      const account = await prisma.account.findUnique({
        where: { id: testAccountId },
        select: {
          access_token: true,
          refresh_token: true,
        },
      });

      expect(account).toBeDefined();
      expect(account!.access_token).toBe(encryptedAccessToken);

      // Decrypt tokens
      const decryptedAccess = decryptOAuthToken(account!.access_token);
      const decryptedRefresh = decryptOAuthToken(account!.refresh_token);

      expect(decryptedAccess).toBe(testAccessToken);
      expect(decryptedRefresh).toBe(testRefreshToken);
    });

    it("should store encrypted tokens in EmailAccount table", async () => {
      const emailAccount = await prisma.emailAccount.create({
        data: {
          userId: testUserId,
          provider: "gmail",
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
        },
      });

      testEmailAccountId = emailAccount.id;

      expect(emailAccount.accessToken).toBe(encryptedAccessToken);
      expect(emailAccount.refreshToken).toBe(encryptedRefreshToken);
    });

    it("should retrieve and decrypt tokens from EmailAccount table", async () => {
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: testEmailAccountId },
        select: {
          accessToken: true,
          refreshToken: true,
        },
      });

      expect(emailAccount).toBeDefined();
      expect(emailAccount!.accessToken).toBe(encryptedAccessToken);

      // Decrypt tokens
      const decryptedAccess = decryptOAuthToken(emailAccount!.accessToken);
      const decryptedRefresh = decryptOAuthToken(emailAccount!.refreshToken);

      expect(decryptedAccess).toBe(testAccessToken);
      expect(decryptedRefresh).toBe(testRefreshToken);
    });

    it("should update tokens with new encrypted values", async () => {
      const newAccessToken = "ya29.a0NewAccessToken987654321";
      const newEncryptedAccess = encryptOAuthToken(newAccessToken)!;

      await prisma.emailAccount.update({
        where: { id: testEmailAccountId },
        data: {
          accessToken: newEncryptedAccess,
        },
      });

      const updated = await prisma.emailAccount.findUnique({
        where: { id: testEmailAccountId },
        select: { accessToken: true },
      });

      expect(updated!.accessToken).toBe(newEncryptedAccess);
      expect(decryptOAuthToken(updated!.accessToken)).toBe(newAccessToken);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when decrypting invalid data", () => {
      expect(() => {
        decryptOAuthToken("not-valid-encrypted-data");
      }).toThrow();
    });

    it("should throw error when decrypting with wrong format", () => {
      expect(() => {
        decryptOAuthToken("ya29.plaintext_token");
      }).toThrow();
    });

    it("should throw error when encryption key is missing", () => {
      const originalKey = process.env.OAUTH_ENCRYPTION_KEY;
      delete process.env.OAUTH_ENCRYPTION_KEY;

      expect(() => {
        encryptOAuthToken("test-token");
      }).toThrow(/OAUTH_ENCRYPTION_KEY/);

      // Restore key
      process.env.OAUTH_ENCRYPTION_KEY = originalKey;
    });
  });

  describe("Security Properties", () => {
    it("encrypted tokens should not contain plaintext", () => {
      const encrypted = encryptOAuthToken("secret-token-12345")!;

      // Should not contain any part of the plaintext
      expect(encrypted).not.toContain("secret");
      expect(encrypted).not.toContain("token");
      expect(encrypted).not.toContain("12345");
    });

    it("encrypted tokens should be sufficiently long", () => {
      // AES-256-GCM with IV and auth tag should produce long output
      const encrypted = encryptOAuthToken("short")!;

      // Base64 encoded (IV + ciphertext + auth tag) should be substantial
      expect(encrypted.length).toBeGreaterThan(40);
    });

    it("should handle tokens with special characters", () => {
      const specialToken = "token+with/special=chars&symbols!@#$%";
      const encrypted = encryptOAuthToken(specialToken)!;
      const decrypted = decryptOAuthToken(encrypted);

      expect(decrypted).toBe(specialToken);
    });

    it("should handle very long tokens", () => {
      const longToken = "a".repeat(1000);
      const encrypted = encryptOAuthToken(longToken)!;
      const decrypted = decryptOAuthToken(encrypted);

      expect(decrypted).toBe(longToken);
      expect(decrypted!.length).toBe(1000);
    });
  });
});
