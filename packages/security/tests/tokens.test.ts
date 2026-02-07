import { describe, it, expect } from "vitest";
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  generateSecureId,
  parseExpiry,
} from "../src/tokens";

const TEST_SECRET = "test-secret-key-for-jwt-signing-at-least-32-chars";

describe("Token utilities", () => {
  describe("generateAccessToken", () => {
    it("generates a valid JWT", () => {
      const payload = {
        userId: "user-123",
        teamId: "team-456",
        email: "test@example.com",
        role: "member",
      };

      const token = generateAccessToken(payload, TEST_SECRET);

      expect(token).toBeDefined();
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe("verifyAccessToken", () => {
    it("verifies and decodes valid token", () => {
      const payload = {
        userId: "user-123",
        teamId: "team-456",
        email: "test@example.com",
        role: "admin",
      };

      const token = generateAccessToken(payload, TEST_SECRET);
      const decoded = verifyAccessToken(token, TEST_SECRET);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe("user-123");
      expect(decoded?.teamId).toBe("team-456");
      expect(decoded?.email).toBe("test@example.com");
      expect(decoded?.role).toBe("admin");
    });

    it("returns null for invalid token", () => {
      const decoded = verifyAccessToken("invalid-token", TEST_SECRET);
      expect(decoded).toBeNull();
    });

    it("returns null for wrong secret", () => {
      const payload = {
        userId: "user-123",
        teamId: "team-456",
        email: "test@example.com",
        role: "member",
      };

      const token = generateAccessToken(payload, TEST_SECRET);
      const decoded = verifyAccessToken(token, "wrong-secret");

      expect(decoded).toBeNull();
    });
  });

  describe("generateRefreshToken", () => {
    it("generates refresh token with all required fields", () => {
      const result = generateRefreshToken();

      expect(result.token).toBeDefined();
      expect(result.tokenHash).toBeDefined();
      expect(result.familyId).toBeDefined();
      expect(result.tokenId).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("generates unique tokens", () => {
      const result1 = generateRefreshToken();
      const result2 = generateRefreshToken();

      expect(result1.token).not.toBe(result2.token);
      expect(result1.tokenHash).not.toBe(result2.tokenHash);
      expect(result1.familyId).not.toBe(result2.familyId);
    });

    it("sets expiry 7 days in future", () => {
      const result = generateRefreshToken();
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      expect(result.expiresAt.getTime()).toBeGreaterThan(now);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
        now + sevenDaysMs + 1000
      );
    });
  });

  describe("hashToken", () => {
    it("hashes token consistently", () => {
      const token = "test-token";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different tokens", () => {
      const hash1 = hashToken("token1");
      const hash2 = hashToken("token2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("generateSecureId", () => {
    it("generates ID of default length", () => {
      const id = generateSecureId();
      expect(id.length).toBe(21);
    });

    it("generates ID of custom length", () => {
      const id = generateSecureId(32);
      expect(id.length).toBe(32);
    });

    it("generates unique IDs", () => {
      const id1 = generateSecureId();
      const id2 = generateSecureId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("parseExpiry", () => {
    it("parses seconds", () => {
      expect(parseExpiry("30s")).toBe(30000);
    });

    it("parses minutes", () => {
      expect(parseExpiry("15m")).toBe(15 * 60 * 1000);
    });

    it("parses hours", () => {
      expect(parseExpiry("2h")).toBe(2 * 60 * 60 * 1000);
    });

    it("parses days", () => {
      expect(parseExpiry("7d")).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("throws for invalid format", () => {
      expect(() => parseExpiry("invalid")).toThrow();
    });
  });
});
