import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../src/password";

describe("Password utilities", () => {
  describe("hashPassword", () => {
    it("hashes a password", async () => {
      const password = "SecurePassword123";
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2")).toBe(true); // bcrypt hash prefix
      expect(hash.length).toBeGreaterThan(50);
    });

    it("produces different hashes for same password", async () => {
      const password = "SamePassword123";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("verifies correct password", async () => {
      const password = "CorrectPassword123";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("rejects incorrect password", async () => {
      const password = "CorrectPassword123";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword("WrongPassword123", hash);
      expect(isValid).toBe(false);
    });
  });

  describe("validatePasswordStrength", () => {
    it("rejects short passwords", () => {
      const result = validatePasswordStrength("Short1");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Password must be at least 8 characters");
    });

    it("requires uppercase letter", () => {
      const result = validatePasswordStrength("nouppercase123");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one uppercase letter"
      );
    });

    it("requires lowercase letter", () => {
      const result = validatePasswordStrength("NOLOWERCASE123");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one lowercase letter"
      );
    });

    it("requires number", () => {
      const result = validatePasswordStrength("NoNumbersHere");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one number"
      );
    });

    it("accepts valid password", () => {
      const result = validatePasswordStrength("ValidPassword123");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("gives higher score for longer passwords", () => {
      const short = validatePasswordStrength("Valid123");
      const medium = validatePasswordStrength("ValidPass123!");
      const long = validatePasswordStrength("VeryLongValidPassword123!");

      expect(long.score).toBeGreaterThan(medium.score);
      expect(medium.score).toBeGreaterThan(short.score);
    });
  });
});
