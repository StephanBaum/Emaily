/**
 * Verification script for password encryption
 *
 * This script verifies that:
 * 1. The encrypt() function produces non-plaintext output (base64 encoded)
 * 2. The encrypted output is significantly different from the plaintext
 * 3. The decrypt() function correctly recovers the original password
 * 4. Each encryption produces unique output (due to random IV)
 *
 * Run with: npx ts-node -r tsconfig-paths/register apps/web/src/lib/__tests__/crypto.verify.ts
 * Or: ENCRYPTION_KEY=<your-64-char-hex-key> npx tsx apps/web/src/lib/__tests__/crypto.verify.ts
 */

import { encrypt, decrypt, generateEncryptionKey } from "../crypto";

// ANSI color codes for output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function log(status: "pass" | "fail" | "info", message: string): void {
  const prefix =
    status === "pass" ? `${GREEN}✓${RESET}` : status === "fail" ? `${RED}✗${RESET}` : `${YELLOW}ℹ${RESET}`;
  // Using process.stdout.write for terminal output
  process.stdout.write(`${prefix} ${message}\n`);
}

async function verifyPasswordEncryption(): Promise<void> {
  process.stdout.write("\n=== Password Encryption Verification ===\n\n");

  // Check if ENCRYPTION_KEY is set
  if (!process.env.ENCRYPTION_KEY) {
    log("info", "ENCRYPTION_KEY not set. Generating a temporary key for testing...");
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
    log("info", `Using temporary key: ${process.env.ENCRYPTION_KEY.substring(0, 8)}...`);
  }

  const testPassword = "MySecretP@ssw0rd!";
  let allPassed = true;

  // Test 1: Encrypt produces non-plaintext output
  process.stdout.write("\n1. Testing encryption produces non-plaintext output:\n");
  try {
    const encrypted = encrypt(testPassword);

    // Verify it's base64 encoded
    const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(encrypted);
    if (isBase64) {
      log("pass", "Encrypted output is base64 encoded");
    } else {
      log("fail", "Encrypted output is NOT base64 encoded");
      allPassed = false;
    }

    // Verify encrypted text doesn't contain the plaintext password
    if (!encrypted.includes(testPassword)) {
      log("pass", "Encrypted output does NOT contain plaintext password");
    } else {
      log("fail", "Encrypted output contains plaintext password!");
      allPassed = false;
    }

    // Verify encrypted length is appropriate (IV + authTag + ciphertext)
    // Minimum: 12 (IV) + 16 (authTag) = 28 bytes => ~40 base64 chars
    if (encrypted.length >= 40) {
      log("pass", `Encrypted length (${encrypted.length} chars) indicates proper AES-GCM format`);
    } else {
      log("fail", `Encrypted length (${encrypted.length}) is suspiciously short`);
      allPassed = false;
    }

    process.stdout.write(`   Plaintext:  "${testPassword}"\n`);
    process.stdout.write(`   Encrypted:  "${encrypted}"\n`);
  } catch (error) {
    log("fail", `Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    allPassed = false;
  }

  // Test 2: Decrypt recovers original password
  process.stdout.write("\n2. Testing decryption recovers original password:\n");
  try {
    const encrypted = encrypt(testPassword);
    const decrypted = decrypt(encrypted);

    if (decrypted === testPassword) {
      log("pass", "Decrypted password matches original");
    } else {
      log("fail", `Decrypted password doesn't match: "${decrypted}" vs "${testPassword}"`);
      allPassed = false;
    }
  } catch (error) {
    log("fail", `Round-trip failed: ${error instanceof Error ? error.message : String(error)}`);
    allPassed = false;
  }

  // Test 3: Each encryption produces unique output (random IV)
  process.stdout.write("\n3. Testing encryption produces unique ciphertexts:\n");
  try {
    const encrypted1 = encrypt(testPassword);
    const encrypted2 = encrypt(testPassword);

    if (encrypted1 !== encrypted2) {
      log("pass", "Same password encrypts to different ciphertexts (unique IVs)");
      process.stdout.write(`   Encryption 1: ${encrypted1.substring(0, 30)}...\n`);
      process.stdout.write(`   Encryption 2: ${encrypted2.substring(0, 30)}...\n`);
    } else {
      log("fail", "Same password encrypts to identical ciphertext (IV reuse vulnerability!)");
      allPassed = false;
    }

    // Verify both can be decrypted
    const decrypted1 = decrypt(encrypted1);
    const decrypted2 = decrypt(encrypted2);

    if (decrypted1 === testPassword && decrypted2 === testPassword) {
      log("pass", "Both unique ciphertexts decrypt correctly");
    } else {
      log("fail", "Unique ciphertexts don't decrypt correctly");
      allPassed = false;
    }
  } catch (error) {
    log("fail", `Uniqueness test failed: ${error instanceof Error ? error.message : String(error)}`);
    allPassed = false;
  }

  // Test 4: Empty and special character passwords
  process.stdout.write("\n4. Testing edge cases:\n");
  const edgeCases = [
    { name: "Unicode password", password: "Pässwörd123日本語" },
    { name: "Long password", password: "a".repeat(200) },
    { name: "Special chars", password: "!@#$%^&*()_+-=[]{}|;':\",./<>?" },
  ];

  for (const testCase of edgeCases) {
    try {
      const encrypted = encrypt(testCase.password);
      const decrypted = decrypt(encrypted);

      if (decrypted === testCase.password) {
        log("pass", `${testCase.name}: encrypts and decrypts correctly`);
      } else {
        log("fail", `${testCase.name}: decryption mismatch`);
        allPassed = false;
      }
    } catch (error) {
      log("fail", `${testCase.name}: ${error instanceof Error ? error.message : String(error)}`);
      allPassed = false;
    }
  }

  // Summary
  process.stdout.write("\n=== Verification Summary ===\n");
  if (allPassed) {
    log("pass", "All encryption verification tests passed!");
    log("info", "The encryptedPassword field in the database will contain base64-encoded");
    log("info", "AES-256-GCM encrypted data, NOT plaintext passwords.\n");
    process.exit(0);
  } else {
    log("fail", "Some verification tests failed. See above for details.\n");
    process.exit(1);
  }
}

// Database verification guide
process.stdout.write(`
=== How to Verify in Database ===

1. Run Prisma Studio:
   cd packages/database && npx prisma studio

2. Navigate to EmailAccount table

3. Check the encryptedPassword column:
   - Should be a base64 string like: "nRk7Yh8Kp2L0xM3Q..."
   - Should NOT be readable plaintext like: "MyPassword123"
   - Length should be ~56-80+ characters (depending on password length)

4. The encrypted format is: base64(IV[12 bytes] + AuthTag[16 bytes] + Ciphertext)
   - IV ensures each encryption is unique
   - AuthTag prevents tampering
   - Ciphertext is the encrypted password

`);

// Run verification
verifyPasswordEncryption();
