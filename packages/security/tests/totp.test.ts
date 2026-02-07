import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpToken,
  generateTotpToken,
  getTotpTimeRemaining,
} from "../src/totp";

describe("TOTP utilities", () => {
  describe("generateTotpSecret", () => {
    it("generates a valid secret", () => {
      const secret = generateTotpSecret();
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThan(10);
    });

    it("generates unique secrets", () => {
      const secret1 = generateTotpSecret();
      const secret2 = generateTotpSecret();
      expect(secret1).not.toBe(secret2);
    });
  });

  describe("generateTotpUri", () => {
    it("generates valid URI for authenticator apps", () => {
      const secret = generateTotpSecret();
      const uri = generateTotpUri(secret, "test@example.com");

      expect(uri).toContain("otpauth://totp/");
      expect(uri).toContain("test"); // @ is URL-encoded to %40
      expect(uri).toContain("example.com");
      expect(uri).toContain("EmailAutomation");
      expect(uri).toContain("secret=");
    });

    it("uses custom issuer", () => {
      const secret = generateTotpSecret();
      const uri = generateTotpUri(secret, "test@example.com", "CustomIssuer");

      expect(uri).toContain("CustomIssuer");
    });
  });

  describe("verifyTotpToken", () => {
    it("verifies valid token", () => {
      const secret = generateTotpSecret();
      const token = generateTotpToken(secret);

      expect(verifyTotpToken(secret, token)).toBe(true);
    });

    it("rejects invalid token", () => {
      const secret = generateTotpSecret();
      expect(verifyTotpToken(secret, "000000")).toBe(false);
    });

    it("rejects malformed token", () => {
      const secret = generateTotpSecret();
      expect(verifyTotpToken(secret, "invalid")).toBe(false);
    });
  });

  describe("generateTotpToken", () => {
    it("generates 6-digit token", () => {
      const secret = generateTotpSecret();
      const token = generateTotpToken(secret);

      expect(token).toMatch(/^\d{6}$/);
    });
  });

  describe("getTotpTimeRemaining", () => {
    it("returns seconds until expiry", () => {
      const remaining = getTotpTimeRemaining();
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(30);
    });
  });
});
