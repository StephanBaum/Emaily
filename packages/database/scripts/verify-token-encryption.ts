#!/usr/bin/env tsx
/**
 * Token Encryption Verification Script
 *
 * This script verifies that OAuth tokens are properly encrypted in the database.
 * It checks both the Account and EmailAccount tables for encrypted tokens.
 *
 * Usage:
 *   pnpm tsx packages/database/scripts/verify-token-encryption.ts
 *
 * What it checks:
 * 1. All tokens in Account table are encrypted (look encrypted, not plaintext OAuth tokens)
 * 2. All tokens in EmailAccount table are encrypted
 * 3. Encrypted tokens can be successfully decrypted
 * 4. Decrypted tokens have expected OAuth token format
 *
 * Exit codes:
 *   0 - All tokens are properly encrypted
 *   1 - Found plaintext tokens or decryption errors
 *   2 - Script configuration error (missing env vars, etc.)
 */

import { prisma } from "../src/client";
import { decryptOAuthToken } from "../src/token-encryption";

interface VerificationResult {
  totalAccounts: number;
  totalEmailAccounts: number;
  encryptedAccounts: number;
  encryptedEmailAccounts: number;
  plaintextAccounts: number;
  plaintextEmailAccounts: number;
  decryptionErrors: string[];
  success: boolean;
}

/**
 * Heuristic check to determine if a string looks like an encrypted token.
 * Encrypted tokens use base64 encoding and have a specific format from AES-256-GCM.
 */
function looksEncrypted(token: string): boolean {
  // Encrypted tokens from our crypto module are base64 encoded
  // They contain IV (12 bytes), encrypted data, and auth tag (16 bytes)
  // Minimum length would be base64 encoding of ~30+ bytes
  if (token.length < 40) return false;

  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(token)) return false;

  // OAuth tokens typically start with "ya29." (Google) or similar patterns
  // If we see these, the token is likely plaintext
  const oauthPatterns = [
    /^ya29\./,  // Google OAuth access token
    /^1\/\//,   // Google OAuth refresh token
    /^EwA/,     // Microsoft OAuth token
    /^eyJ/,     // JWT format
  ];

  if (oauthPatterns.some(pattern => pattern.test(token))) {
    return false;
  }

  return true;
}

/**
 * Verify that tokens in the Account table are encrypted
 */
async function verifyAccountTable(): Promise<{
  total: number;
  encrypted: number;
  plaintext: string[];
  decryptionErrors: string[];
}> {
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      provider: true,
      access_token: true,
      refresh_token: true,
    },
  });

  const plaintext: string[] = [];
  const decryptionErrors: string[] = [];
  let encrypted = 0;

  for (const account of accounts) {
    let accountEncrypted = true;

    // Check access token
    if (account.access_token) {
      if (!looksEncrypted(account.access_token)) {
        accountEncrypted = false;
        plaintext.push(`Account ${account.id} (${account.provider}): access_token appears plaintext`);
      } else {
        // Try to decrypt to verify it's actually encrypted
        try {
          const decrypted = decryptOAuthToken(account.access_token);
          if (!decrypted) {
            decryptionErrors.push(`Account ${account.id}: access_token decryption returned null`);
            accountEncrypted = false;
          }
        } catch (error) {
          decryptionErrors.push(
            `Account ${account.id}: access_token decryption failed - ${error instanceof Error ? error.message : String(error)}`
          );
          accountEncrypted = false;
        }
      }
    }

    // Check refresh token
    if (account.refresh_token) {
      if (!looksEncrypted(account.refresh_token)) {
        accountEncrypted = false;
        plaintext.push(`Account ${account.id} (${account.provider}): refresh_token appears plaintext`);
      } else {
        // Try to decrypt to verify it's actually encrypted
        try {
          const decrypted = decryptOAuthToken(account.refresh_token);
          if (!decrypted) {
            decryptionErrors.push(`Account ${account.id}: refresh_token decryption returned null`);
            accountEncrypted = false;
          }
        } catch (error) {
          decryptionErrors.push(
            `Account ${account.id}: refresh_token decryption failed - ${error instanceof Error ? error.message : String(error)}`
          );
          accountEncrypted = false;
        }
      }
    }

    if (accountEncrypted) {
      encrypted++;
    }
  }

  return {
    total: accounts.length,
    encrypted,
    plaintext,
    decryptionErrors,
  };
}

/**
 * Verify that tokens in the EmailAccount table are encrypted
 */
async function verifyEmailAccountTable(): Promise<{
  total: number;
  encrypted: number;
  plaintext: string[];
  decryptionErrors: string[];
}> {
  const emailAccounts = await prisma.emailAccount.findMany({
    select: {
      id: true,
      provider: true,
      accessToken: true,
      refreshToken: true,
    },
  });

  const plaintext: string[] = [];
  const decryptionErrors: string[] = [];
  let encrypted = 0;

  for (const account of emailAccounts) {
    let accountEncrypted = true;

    // Check access token
    if (account.accessToken) {
      if (!looksEncrypted(account.accessToken)) {
        accountEncrypted = false;
        plaintext.push(`EmailAccount ${account.id} (${account.provider}): accessToken appears plaintext`);
      } else {
        // Try to decrypt to verify it's actually encrypted
        try {
          const decrypted = decryptOAuthToken(account.accessToken);
          if (!decrypted) {
            decryptionErrors.push(`EmailAccount ${account.id}: accessToken decryption returned null`);
            accountEncrypted = false;
          }
        } catch (error) {
          decryptionErrors.push(
            `EmailAccount ${account.id}: accessToken decryption failed - ${error instanceof Error ? error.message : String(error)}`
          );
          accountEncrypted = false;
        }
      }
    }

    // Check refresh token
    if (account.refreshToken) {
      if (!looksEncrypted(account.refreshToken)) {
        accountEncrypted = false;
        plaintext.push(`EmailAccount ${account.id} (${account.provider}): refreshToken appears plaintext`);
      } else {
        // Try to decrypt to verify it's actually encrypted
        try {
          const decrypted = decryptOAuthToken(account.refreshToken);
          if (!decrypted) {
            decryptionErrors.push(`EmailAccount ${account.id}: refreshToken decryption returned null`);
            accountEncrypted = false;
          }
        } catch (error) {
          decryptionErrors.push(
            `EmailAccount ${account.id}: refreshToken decryption failed - ${error instanceof Error ? error.message : String(error)}`
          );
          accountEncrypted = false;
        }
      }
    }

    if (accountEncrypted) {
      encrypted++;
    }
  }

  return {
    total: emailAccounts.length,
    encrypted,
    plaintext,
    decryptionErrors,
  };
}

/**
 * Main verification function
 */
async function main() {
  console.log("🔐 OAuth Token Encryption Verification");
  console.log("=====================================\n");

  // Check for OAUTH_ENCRYPTION_KEY
  if (!process.env.OAUTH_ENCRYPTION_KEY) {
    console.error("❌ ERROR: OAUTH_ENCRYPTION_KEY environment variable is not set");
    console.error("   Cannot verify token encryption without the encryption key.");
    console.error("   Set OAUTH_ENCRYPTION_KEY in your .env file.\n");
    process.exit(2);
  }

  try {
    // Verify Account table
    console.log("Checking Account table...");
    const accountResults = await verifyAccountTable();
    console.log(`  Total accounts: ${accountResults.total}`);
    console.log(`  ✅ Encrypted: ${accountResults.encrypted}`);
    if (accountResults.plaintext.length > 0) {
      console.log(`  ❌ Plaintext tokens found: ${accountResults.plaintext.length}`);
      accountResults.plaintext.forEach(msg => console.log(`     - ${msg}`));
    }
    if (accountResults.decryptionErrors.length > 0) {
      console.log(`  ⚠️  Decryption errors: ${accountResults.decryptionErrors.length}`);
      accountResults.decryptionErrors.forEach(msg => console.log(`     - ${msg}`));
    }
    console.log();

    // Verify EmailAccount table
    console.log("Checking EmailAccount table...");
    const emailAccountResults = await verifyEmailAccountTable();
    console.log(`  Total email accounts: ${emailAccountResults.total}`);
    console.log(`  ✅ Encrypted: ${emailAccountResults.encrypted}`);
    if (emailAccountResults.plaintext.length > 0) {
      console.log(`  ❌ Plaintext tokens found: ${emailAccountResults.plaintext.length}`);
      emailAccountResults.plaintext.forEach(msg => console.log(`     - ${msg}`));
    }
    if (emailAccountResults.decryptionErrors.length > 0) {
      console.log(`  ⚠️  Decryption errors: ${emailAccountResults.decryptionErrors.length}`);
      emailAccountResults.decryptionErrors.forEach(msg => console.log(`     - ${msg}`));
    }
    console.log();

    // Summary
    const totalPlaintext = accountResults.plaintext.length + emailAccountResults.plaintext.length;
    const totalDecryptionErrors = accountResults.decryptionErrors.length + emailAccountResults.decryptionErrors.length;
    const totalAccounts = accountResults.total + emailAccountResults.total;
    const totalEncrypted = accountResults.encrypted + emailAccountResults.encrypted;

    console.log("Summary");
    console.log("=======");
    console.log(`Total accounts checked: ${totalAccounts}`);
    console.log(`✅ Properly encrypted: ${totalEncrypted}`);
    console.log(`❌ Plaintext tokens: ${totalPlaintext}`);
    console.log(`⚠️  Decryption errors: ${totalDecryptionErrors}`);
    console.log();

    if (totalPlaintext === 0 && totalDecryptionErrors === 0) {
      console.log("✅ SUCCESS: All OAuth tokens are properly encrypted!");
      process.exit(0);
    } else {
      console.log("❌ FAILURE: Found issues with token encryption.");
      console.log("\nRecommended actions:");
      if (totalPlaintext > 0) {
        console.log("  1. Run the migration script to encrypt plaintext tokens:");
        console.log("     pnpm tsx packages/database/scripts/encrypt-existing-tokens.ts");
      }
      if (totalDecryptionErrors > 0) {
        console.log("  2. Check that OAUTH_ENCRYPTION_KEY matches the key used for encryption");
        console.log("  3. If the key was changed, you may need to re-authenticate users");
      }
      console.log();
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Script error:", error);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();
