import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  generateMasterKey,
  blindIndex,
} from "../src/encryption";

describe("Encryption utilities", () => {
  const TEST_MASTER_KEY = "test-master-key-for-encryption-32b";

  describe("encrypt and decrypt", () => {
    it("encrypts and decrypts data correctly", () => {
      const plaintext = "my-secret-imap-password";
      const encrypted = encrypt(plaintext, TEST_MASTER_KEY);
      const decrypted = decrypt(encrypted, TEST_MASTER_KEY);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertext for same plaintext", () => {
      const plaintext = "same-password";
      const encrypted1 = encrypt(plaintext, TEST_MASTER_KEY);
      const encrypted2 = encrypt(plaintext, TEST_MASTER_KEY);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("handles special characters", () => {
      const plaintext = "p@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encrypt(plaintext, TEST_MASTER_KEY);
      const decrypted = decrypt(encrypted, TEST_MASTER_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it("handles unicode", () => {
      const plaintext = "密码123пароль🔐";
      const encrypted = encrypt(plaintext, TEST_MASTER_KEY);
      const decrypted = decrypt(encrypted, TEST_MASTER_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it("fails with wrong key", () => {
      const plaintext = "secret-data";
      const encrypted = encrypt(plaintext, TEST_MASTER_KEY);

      expect(() => decrypt(encrypted, "wrong-key")).toThrow();
    });

    it("fails with tampered data", () => {
      const plaintext = "secret-data";
      const encrypted = encrypt(plaintext, TEST_MASTER_KEY);

      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -4) + "XXXX";

      expect(() => decrypt(tampered, TEST_MASTER_KEY)).toThrow();
    });
  });

  describe("generateMasterKey", () => {
    it("generates a 32-byte key as base64", () => {
      const key = generateMasterKey();

      expect(key).toBeDefined();
      // 32 bytes = ~43 base64 characters
      expect(key.length).toBeGreaterThan(40);
    });

    it("generates unique keys", () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe("blindIndex", () => {
    it("creates consistent index for same input", () => {
      const indexKey = "index-key";
      const data = "searchable-value";

      const index1 = blindIndex(data, indexKey);
      const index2 = blindIndex(data, indexKey);

      expect(index1).toBe(index2);
    });

    it("creates different index for different input", () => {
      const indexKey = "index-key";

      const index1 = blindIndex("value1", indexKey);
      const index2 = blindIndex("value2", indexKey);

      expect(index1).not.toBe(index2);
    });

    it("is case-insensitive", () => {
      const indexKey = "index-key";

      const index1 = blindIndex("Email@Example.com", indexKey);
      const index2 = blindIndex("email@example.com", indexKey);

      expect(index1).toBe(index2);
    });

    it("produces hex string", () => {
      const index = blindIndex("test", "key");
      expect(index).toMatch(/^[a-f0-9]+$/);
    });
  });
});
