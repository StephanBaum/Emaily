#!/usr/bin/env tsx
/**
 * Mobile Sync Encryption Test Script
 *
 * This script tests the mobile sync endpoint to ensure OAuth tokens
 * are properly encrypted when synced from a mobile client.
 *
 * Usage:
 *   pnpm tsx packages/database/scripts/test-mobile-sync-encryption.ts
 *
 * What it tests:
 * 1. Mobile client can POST tokens to /api/mobile/auth/sync
 * 2. Tokens are encrypted in the EmailAccount table
 * 3. Encrypted tokens can be successfully decrypted
 * 4. Session token is returned for subsequent API calls
 *
 * Prerequisites:
 *   - Dev server must be running (pnpm dev)
 *   - OAUTH_ENCRYPTION_KEY must be set in .env
 *   - Database must be accessible
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - Tests failed
 *   2 - Configuration error or test setup failed
 */

import { prisma } from "../src/client";
import { decryptOAuthToken } from "../src/token-encryption";

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const TEST_EMAIL = `mobile-test-${Date.now()}@example.com`;
const TEST_ACCESS_TOKEN = `test_mobile_access_token_${Math.random().toString(36).substring(7)}`;
const TEST_REFRESH_TOKEN = `test_mobile_refresh_token_${Math.random().toString(36).substring(7)}`;
const TEST_PROVIDER = "google";

interface MobileSyncResponse {
  success: boolean;
  sessionToken?: string;
  userId?: string;
  emailAccountId?: string;
  error?: string;
}

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];
let createdUserId: string | null = null;
let createdEmailAccountId: string | null = null;

/**
 * Add a test result
 */
function addTestResult(testName: string, passed: boolean, message: string, details?: any) {
  testResults.push({ testName, passed, message, details });
  const icon = passed ? "✅" : "❌";
  console.log(`  ${icon} ${testName}: ${message}`);
  if (details) {
    console.log(`     Details: ${JSON.stringify(details, null, 2)}`);
  }
}

/**
 * Check if a string looks encrypted (base64 format with sufficient length)
 */
function looksEncrypted(token: string): boolean {
  if (token.length < 40) return false;
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return base64Regex.test(token);
}

/**
 * Test 1: POST to mobile sync endpoint
 */
async function testMobileSyncEndpoint(): Promise<void> {
  console.log("\n📱 Test 1: POST to mobile sync endpoint");

  try {
    const response = await fetch(`${API_BASE_URL}/api/mobile/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: TEST_ACCESS_TOKEN,
        refreshToken: TEST_REFRESH_TOKEN,
        provider: TEST_PROVIDER,
        email: TEST_EMAIL,
      }),
    });

    const data: MobileSyncResponse = await response.json();

    if (!response.ok) {
      addTestResult(
        "API Response",
        false,
        `API returned ${response.status}`,
        { status: response.status, error: data.error }
      );
      return;
    }

    if (!data.success) {
      addTestResult("API Response", false, "API response indicates failure", data);
      return;
    }

    addTestResult("API Response", true, "API returned success");

    if (!data.sessionToken) {
      addTestResult("Session Token", false, "No session token in response", data);
      return;
    }

    addTestResult("Session Token", true, "Session token returned");

    if (!data.userId) {
      addTestResult("User ID", false, "No userId in response", data);
      return;
    }

    createdUserId = data.userId;
    addTestResult("User ID", true, `User created: ${data.userId}`);

    if (!data.emailAccountId) {
      addTestResult("EmailAccount ID", false, "No emailAccountId in response", data);
      return;
    }

    createdEmailAccountId = data.emailAccountId;
    addTestResult("EmailAccount ID", true, `EmailAccount created: ${data.emailAccountId}`);

  } catch (error) {
    addTestResult(
      "API Request",
      false,
      "Failed to connect to API",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Test 2: Verify tokens are encrypted in database
 */
async function testTokensEncryptedInDatabase(): Promise<void> {
  console.log("\n🔐 Test 2: Verify tokens are encrypted in database");

  if (!createdEmailAccountId) {
    addTestResult("Database Check", false, "No EmailAccount ID to check (previous test failed)");
    return;
  }

  try {
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: createdEmailAccountId },
      select: {
        id: true,
        provider: true,
        accessToken: true,
        refreshToken: true,
      },
    });

    if (!emailAccount) {
      addTestResult("Database Check", false, `EmailAccount not found: ${createdEmailAccountId}`);
      return;
    }

    addTestResult("Database Check", true, "EmailAccount found in database");

    // Check accessToken encryption
    if (!emailAccount.accessToken) {
      addTestResult("Access Token Storage", false, "No accessToken in database");
      return;
    }

    if (emailAccount.accessToken === TEST_ACCESS_TOKEN) {
      addTestResult(
        "Access Token Encryption",
        false,
        "Access token is stored in plaintext (not encrypted!)",
        { stored: emailAccount.accessToken, expected: "encrypted base64 string" }
      );
      return;
    }

    if (!looksEncrypted(emailAccount.accessToken)) {
      addTestResult(
        "Access Token Encryption",
        false,
        "Access token doesn't look encrypted (not base64 format)",
        { stored: emailAccount.accessToken.substring(0, 50) + "..." }
      );
      return;
    }

    addTestResult("Access Token Encryption", true, "Access token is encrypted in database");

    // Check refreshToken encryption
    if (!emailAccount.refreshToken) {
      addTestResult("Refresh Token Storage", false, "No refreshToken in database");
      return;
    }

    if (emailAccount.refreshToken === TEST_REFRESH_TOKEN) {
      addTestResult(
        "Refresh Token Encryption",
        false,
        "Refresh token is stored in plaintext (not encrypted!)",
        { stored: emailAccount.refreshToken, expected: "encrypted base64 string" }
      );
      return;
    }

    if (!looksEncrypted(emailAccount.refreshToken)) {
      addTestResult(
        "Refresh Token Encryption",
        false,
        "Refresh token doesn't look encrypted (not base64 format)",
        { stored: emailAccount.refreshToken.substring(0, 50) + "..." }
      );
      return;
    }

    addTestResult("Refresh Token Encryption", true, "Refresh token is encrypted in database");

  } catch (error) {
    addTestResult(
      "Database Query",
      false,
      "Failed to query database",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Test 3: Verify tokens can be decrypted
 */
async function testTokenDecryption(): Promise<void> {
  console.log("\n🔓 Test 3: Verify tokens can be decrypted");

  if (!createdEmailAccountId) {
    addTestResult("Decryption Test", false, "No EmailAccount ID to check (previous test failed)");
    return;
  }

  try {
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: createdEmailAccountId },
      select: {
        accessToken: true,
        refreshToken: true,
      },
    });

    if (!emailAccount) {
      addTestResult("Decryption Test", false, "EmailAccount not found");
      return;
    }

    // Decrypt access token
    if (!emailAccount.accessToken) {
      addTestResult("Access Token Decryption", false, "No accessToken to decrypt");
      return;
    }

    try {
      const decryptedAccessToken = decryptOAuthToken(emailAccount.accessToken);

      if (!decryptedAccessToken) {
        addTestResult("Access Token Decryption", false, "Decryption returned null");
        return;
      }

      if (decryptedAccessToken !== TEST_ACCESS_TOKEN) {
        addTestResult(
          "Access Token Decryption",
          false,
          "Decrypted token doesn't match original",
          {
            original: TEST_ACCESS_TOKEN,
            decrypted: decryptedAccessToken,
          }
        );
        return;
      }

      addTestResult(
        "Access Token Decryption",
        true,
        "Access token decrypted successfully and matches original"
      );
    } catch (error) {
      addTestResult(
        "Access Token Decryption",
        false,
        "Decryption failed",
        { error: error instanceof Error ? error.message : String(error) }
      );
      return;
    }

    // Decrypt refresh token
    if (!emailAccount.refreshToken) {
      addTestResult("Refresh Token Decryption", false, "No refreshToken to decrypt");
      return;
    }

    try {
      const decryptedRefreshToken = decryptOAuthToken(emailAccount.refreshToken);

      if (!decryptedRefreshToken) {
        addTestResult("Refresh Token Decryption", false, "Decryption returned null");
        return;
      }

      if (decryptedRefreshToken !== TEST_REFRESH_TOKEN) {
        addTestResult(
          "Refresh Token Decryption",
          false,
          "Decrypted token doesn't match original",
          {
            original: TEST_REFRESH_TOKEN,
            decrypted: decryptedRefreshToken,
          }
        );
        return;
      }

      addTestResult(
        "Refresh Token Decryption",
        true,
        "Refresh token decrypted successfully and matches original"
      );
    } catch (error) {
      addTestResult(
        "Refresh Token Decryption",
        false,
        "Decryption failed",
        { error: error instanceof Error ? error.message : String(error) }
      );
      return;
    }

  } catch (error) {
    addTestResult(
      "Decryption Test",
      false,
      "Failed to query database",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Test 4: Verify subsequent sync updates tokens correctly
 */
async function testSubsequentSync(): Promise<void> {
  console.log("\n🔄 Test 4: Verify subsequent sync updates tokens correctly");

  const NEW_ACCESS_TOKEN = `test_mobile_access_token_updated_${Math.random().toString(36).substring(7)}`;
  const NEW_REFRESH_TOKEN = `test_mobile_refresh_token_updated_${Math.random().toString(36).substring(7)}`;

  try {
    const response = await fetch(`${API_BASE_URL}/api/mobile/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: NEW_ACCESS_TOKEN,
        refreshToken: NEW_REFRESH_TOKEN,
        provider: TEST_PROVIDER,
        email: TEST_EMAIL,
      }),
    });

    const data: MobileSyncResponse = await response.json();

    if (!response.ok || !data.success) {
      addTestResult("Subsequent Sync", false, "API call failed", data);
      return;
    }

    addTestResult("Subsequent Sync", true, "API call succeeded");

    // Verify tokens were updated
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { id: createdEmailAccountId! },
      select: {
        accessToken: true,
        refreshToken: true,
      },
    });

    if (!emailAccount) {
      addTestResult("Token Update Check", false, "EmailAccount not found");
      return;
    }

    // Decrypt and verify updated tokens
    const decryptedAccessToken = decryptOAuthToken(emailAccount.accessToken!);
    const decryptedRefreshToken = decryptOAuthToken(emailAccount.refreshToken!);

    if (decryptedAccessToken !== NEW_ACCESS_TOKEN) {
      addTestResult(
        "Access Token Update",
        false,
        "Access token was not updated correctly",
        { expected: NEW_ACCESS_TOKEN, actual: decryptedAccessToken }
      );
      return;
    }

    addTestResult("Access Token Update", true, "Access token updated and encrypted correctly");

    if (decryptedRefreshToken !== NEW_REFRESH_TOKEN) {
      addTestResult(
        "Refresh Token Update",
        false,
        "Refresh token was not updated correctly",
        { expected: NEW_REFRESH_TOKEN, actual: decryptedRefreshToken }
      );
      return;
    }

    addTestResult("Refresh Token Update", true, "Refresh token updated and encrypted correctly");

  } catch (error) {
    addTestResult(
      "Subsequent Sync",
      false,
      "Test failed",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Cleanup: Delete test data
 */
async function cleanup(): Promise<void> {
  console.log("\n🧹 Cleanup: Removing test data");

  try {
    if (createdEmailAccountId) {
      await prisma.emailAccount.delete({
        where: { id: createdEmailAccountId },
      });
      console.log(`  ✅ Deleted EmailAccount: ${createdEmailAccountId}`);
    }

    if (createdUserId) {
      await prisma.user.delete({
        where: { id: createdUserId },
      });
      console.log(`  ✅ Deleted User: ${createdUserId}`);
    }
  } catch (error) {
    console.log(
      `  ⚠️  Cleanup warning: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Print summary
 */
function printSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  const total = testResults.length;

  console.log(`\nTotal tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.testName}: ${r.message}`);
      });
  }

  console.log();
  if (failed === 0) {
    console.log("✅ SUCCESS: All mobile sync encryption tests passed!");
    console.log("\nThe mobile sync endpoint correctly:");
    console.log("  ✅ Encrypts OAuth tokens before storing in database");
    console.log("  ✅ Stores encrypted tokens in EmailAccount table");
    console.log("  ✅ Allows tokens to be decrypted for use");
    console.log("  ✅ Updates tokens correctly on subsequent syncs");
  } else {
    console.log("❌ FAILURE: Some tests failed.");
    console.log("\nPlease review the failures above and ensure:");
    console.log("  1. Dev server is running (pnpm dev)");
    console.log("  2. OAUTH_ENCRYPTION_KEY is set in .env");
    console.log("  3. Mobile sync endpoint is properly configured");
    console.log("  4. Token encryption functions are working correctly");
  }
  console.log("=".repeat(60));
}

/**
 * Main test runner
 */
async function main() {
  console.log("🔐 Mobile Sync Encryption Test");
  console.log("================================");
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log();

  // Check prerequisites
  if (!process.env.OAUTH_ENCRYPTION_KEY) {
    console.error("❌ ERROR: OAUTH_ENCRYPTION_KEY environment variable is not set");
    console.error("   Set OAUTH_ENCRYPTION_KEY in your .env file.\n");
    process.exit(2);
  }

  console.log("✅ OAUTH_ENCRYPTION_KEY is set");

  try {
    // Run tests
    await testMobileSyncEndpoint();
    await testTokensEncryptedInDatabase();
    await testTokenDecryption();
    await testSubsequentSync();

    // Cleanup
    await cleanup();

    // Print summary
    printSummary();

    // Exit with appropriate code
    const failed = testResults.filter((r) => !r.passed).length;
    process.exit(failed === 0 ? 0 : 1);

  } catch (error) {
    console.error("\n❌ Test runner error:", error);

    // Try to cleanup even if tests failed
    try {
      await cleanup();
    } catch {
      // Ignore cleanup errors
    }

    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
main();
