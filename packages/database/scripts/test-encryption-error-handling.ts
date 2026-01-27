#!/usr/bin/env tsx
/**
 * Encryption Error Handling Test Script
 *
 * This script tests that the OAuth token encryption system handles errors gracefully:
 * 1. Missing OAUTH_ENCRYPTION_KEY environment variable
 * 2. Wrong encryption key (decryption with different key)
 * 3. Corrupted encrypted data
 *
 * Usage:
 *   pnpm tsx packages/database/scripts/test-encryption-error-handling.ts
 *
 * Exit codes:
 *   0 - All error handling tests passed
 *   1 - One or more tests failed
 */

import { encryptToken, decryptToken } from "../src/crypto";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

const results: TestResult[] = [];

/**
 * Print a formatted header
 */
function printHeader(text: string): void {
  console.log(`\n${colors.bold}${colors.cyan}${"=".repeat(70)}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}${text}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}${"=".repeat(70)}${colors.reset}\n`);
}

/**
 * Print a test result
 */
function printTest(result: TestResult): void {
  const icon = result.passed ? "✅" : "❌";
  const color = result.passed ? colors.green : colors.red;
  console.log(`${icon} ${color}${result.name}${colors.reset}`);
  console.log(`   ${result.message}`);
  if (result.details) {
    console.log(`   ${colors.yellow}Details: ${result.details}${colors.reset}`);
  }
  console.log();
}

/**
 * Test 1: Missing OAUTH_ENCRYPTION_KEY
 */
async function testMissingEncryptionKey(): Promise<void> {
  console.log(`${colors.bold}Test 1: Missing OAUTH_ENCRYPTION_KEY${colors.reset}`);
  console.log("Testing that encryption fails gracefully when key is not set...\n");

  // Save original key
  const originalKey = process.env.OAUTH_ENCRYPTION_KEY;

  try {
    // Remove encryption key
    delete process.env.OAUTH_ENCRYPTION_KEY;

    // Try to encrypt a token
    try {
      encryptToken("test_token");

      // If we get here, the test failed - it should have thrown an error
      results.push({
        name: "Missing key - Encryption",
        passed: false,
        message: "Expected encryption to throw error when key is missing",
        details: "encryptToken() did not throw an error",
      });
    } catch (error) {
      // Check that error message is helpful and doesn't expose sensitive data
      const errorMessage = error instanceof Error ? error.message : String(error);

      const hasHelpfulMessage = errorMessage.includes("OAUTH_ENCRYPTION_KEY");
      const mentionsHowToGenerate = errorMessage.includes("openssl");
      const noSensitiveData = !errorMessage.includes("test_token");

      if (hasHelpfulMessage && mentionsHowToGenerate && noSensitiveData) {
        results.push({
          name: "Missing key - Encryption",
          passed: true,
          message: "Encryption fails gracefully with helpful error message",
          details: errorMessage,
        });
      } else {
        results.push({
          name: "Missing key - Encryption",
          passed: false,
          message: "Error message is not helpful or exposes sensitive data",
          details: `Missing helpful message: ${!hasHelpfulMessage}, Missing generation instructions: ${!mentionsHowToGenerate}, Exposes sensitive data: ${!noSensitiveData}. Error: ${errorMessage}`,
        });
      }
    }

    // Try to decrypt a token
    try {
      decryptToken("fake_encrypted_token");

      // If we get here, the test failed
      results.push({
        name: "Missing key - Decryption",
        passed: false,
        message: "Expected decryption to throw error when key is missing",
        details: "decryptToken() did not throw an error",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const hasHelpfulMessage = errorMessage.includes("OAUTH_ENCRYPTION_KEY");
      const noSensitiveData = !errorMessage.includes("fake_encrypted_token");

      if (hasHelpfulMessage && noSensitiveData) {
        results.push({
          name: "Missing key - Decryption",
          passed: true,
          message: "Decryption fails gracefully with helpful error message",
          details: errorMessage,
        });
      } else {
        results.push({
          name: "Missing key - Decryption",
          passed: false,
          message: "Error message is not helpful or exposes sensitive data",
          details: errorMessage,
        });
      }
    }
  } finally {
    // Restore original key
    if (originalKey) {
      process.env.OAUTH_ENCRYPTION_KEY = originalKey;
    }
  }
}

/**
 * Test 2: Wrong Encryption Key
 */
async function testWrongEncryptionKey(): Promise<void> {
  console.log(`${colors.bold}Test 2: Wrong Encryption Key${colors.reset}`);
  console.log("Testing that decryption fails gracefully with wrong key...\n");

  const originalKey = process.env.OAUTH_ENCRYPTION_KEY;

  if (!originalKey) {
    results.push({
      name: "Wrong key - Test setup",
      passed: false,
      message: "Cannot test wrong key - OAUTH_ENCRYPTION_KEY not set",
      details: "Set OAUTH_ENCRYPTION_KEY in .env before running this test",
    });
    return;
  }

  try {
    // Encrypt with original key
    const testToken = "test_access_token_12345";
    const encrypted = encryptToken(testToken);

    // Verify encryption worked
    const decrypted = decryptToken(encrypted);
    if (decrypted !== testToken) {
      results.push({
        name: "Wrong key - Encryption setup",
        passed: false,
        message: "Failed to encrypt/decrypt with correct key",
        details: "Cannot proceed with wrong key test",
      });
      return;
    }

    // Generate a different key (32 bytes base64 encoded)
    const wrongKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
    process.env.OAUTH_ENCRYPTION_KEY = wrongKey;

    // Try to decrypt with wrong key
    try {
      decryptToken(encrypted);

      // If we get here, the test failed - it should have thrown an error
      results.push({
        name: "Wrong key - Decryption",
        passed: false,
        message: "Expected decryption to fail with wrong key",
        details: "decryptToken() succeeded when it should have failed",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check for helpful error message
      const mentionsAuthTag =
        errorMessage.includes("authentication tag") || errorMessage.includes("auth tag");
      const mentionsWrongKey =
        errorMessage.includes("incorrect") || errorMessage.includes("wrong key");
      const mentionsCorrupted = errorMessage.includes("corrupted");
      const noSensitiveData = !errorMessage.includes(testToken) && !errorMessage.includes(encrypted);

      const isHelpful = (mentionsAuthTag || mentionsWrongKey || mentionsCorrupted) && noSensitiveData;

      if (isHelpful) {
        results.push({
          name: "Wrong key - Decryption",
          passed: true,
          message: "Decryption fails gracefully with helpful error message",
          details: errorMessage,
        });
      } else {
        results.push({
          name: "Wrong key - Decryption",
          passed: false,
          message: "Error message is not helpful or exposes sensitive data",
          details: `Auth tag mentioned: ${mentionsAuthTag}, Wrong key mentioned: ${mentionsWrongKey}, Corrupted mentioned: ${mentionsCorrupted}, No sensitive data: ${noSensitiveData}. Error: ${errorMessage}`,
        });
      }
    }
  } finally {
    // Restore original key
    process.env.OAUTH_ENCRYPTION_KEY = originalKey;
  }
}

/**
 * Test 3: Corrupted Encrypted Data
 */
async function testCorruptedData(): Promise<void> {
  console.log(`${colors.bold}Test 3: Corrupted Encrypted Data${colors.reset}`);
  console.log("Testing that decryption handles corrupted data gracefully...\n");

  if (!process.env.OAUTH_ENCRYPTION_KEY) {
    results.push({
      name: "Corrupted data - Test setup",
      passed: false,
      message: "Cannot test corrupted data - OAUTH_ENCRYPTION_KEY not set",
      details: "Set OAUTH_ENCRYPTION_KEY in .env before running this test",
    });
    return;
  }

  // Test cases for corrupted data
  const corruptedDataTests = [
    {
      name: "Empty string",
      data: "",
      expectedErrorContains: "empty",
    },
    {
      name: "Invalid base64",
      data: "not-valid-base64!@#$%",
      expectedErrorContains: ["base64", "invalid", "auth"],
    },
    {
      name: "Valid base64 but too short",
      data: Buffer.from("short").toString("base64"),
      expectedErrorContains: ["invalid", "auth", "too short", "corrupted"],
    },
    {
      name: "Valid base64 but wrong length",
      data: Buffer.from("this is exactly 28 bytes!!").toString("base64"),
      expectedErrorContains: ["invalid", "auth", "corrupted"],
    },
    {
      name: "Properly encrypted but tampered",
      data: null as string | null, // Will be set below
      expectedErrorContains: ["auth", "invalid", "corrupted", "incorrect"],
    },
  ];

  // Create a properly encrypted token and tamper with it
  const validToken = "test_token_for_tampering";
  const encrypted = encryptToken(validToken);
  const encryptedBuffer = Buffer.from(encrypted, "base64");

  // Tamper with a byte in the middle
  if (encryptedBuffer.length > 20) {
    encryptedBuffer[20] = encryptedBuffer[20] ^ 0xff; // Flip all bits
  }
  corruptedDataTests[4].data = encryptedBuffer.toString("base64");

  // Run each corrupted data test
  for (const test of corruptedDataTests) {
    if (test.data === null) continue;

    try {
      decryptToken(test.data);

      // If we get here, the test failed - should have thrown
      results.push({
        name: `Corrupted data - ${test.name}`,
        passed: false,
        message: "Expected decryption to fail with corrupted data",
        details: "decryptToken() succeeded when it should have failed",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if error message is helpful
      const expectedPhrases = Array.isArray(test.expectedErrorContains)
        ? test.expectedErrorContains
        : [test.expectedErrorContains];

      const hasExpectedPhrase = expectedPhrases.some((phrase) =>
        errorMessage.toLowerCase().includes(phrase.toLowerCase())
      );

      // Make sure sensitive data is not exposed
      // For empty string, we can't check if it's "included" since empty string is in every string
      const noSensitiveData =
        test.data === "" || // Empty string is safe to mention
        (!errorMessage.includes(test.data) && !errorMessage.includes(validToken));

      if (hasExpectedPhrase && noSensitiveData) {
        results.push({
          name: `Corrupted data - ${test.name}`,
          passed: true,
          message: "Handles corrupted data gracefully with helpful error",
          details: errorMessage,
        });
      } else {
        results.push({
          name: `Corrupted data - ${test.name}`,
          passed: false,
          message: "Error message is not helpful or exposes sensitive data",
          details: `Expected phrase found: ${hasExpectedPhrase}, No sensitive data: ${noSensitiveData}. Error: ${errorMessage}`,
        });
      }
    }
  }
}

/**
 * Test 4: Null and undefined handling
 */
async function testNullUndefinedHandling(): Promise<void> {
  console.log(`${colors.bold}Test 4: Null and Undefined Handling${colors.reset}`);
  console.log("Testing that null/undefined values are handled gracefully...\n");

  // Test encryptToken with empty string (null would be caught by TypeScript)
  try {
    encryptToken("");
    results.push({
      name: "Null handling - Encryption",
      passed: false,
      message: "Expected error when encrypting empty string",
      details: "encryptToken('') did not throw an error",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const hasHelpfulMessage = errorMessage.includes("empty") || errorMessage.includes("null");

    results.push({
      name: "Null handling - Encryption",
      passed: hasHelpfulMessage,
      message: hasHelpfulMessage
        ? "Handles empty/null gracefully with helpful error"
        : "Error message is not helpful",
      details: errorMessage,
    });
  }

  // Test decryptToken with empty string
  try {
    decryptToken("");
    results.push({
      name: "Null handling - Decryption",
      passed: false,
      message: "Expected error when decrypting empty string",
      details: "decryptToken('') did not throw an error",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const hasHelpfulMessage = errorMessage.includes("empty") || errorMessage.includes("null");

    results.push({
      name: "Null handling - Decryption",
      passed: hasHelpfulMessage,
      message: hasHelpfulMessage
        ? "Handles empty/null gracefully with helpful error"
        : "Error message is not helpful",
      details: errorMessage,
    });
  }
}

/**
 * Print summary of all test results
 */
function printSummary(): void {
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;

  printHeader("TEST RESULTS SUMMARY");

  // Print each result
  results.forEach(printTest);

  // Print overall summary
  console.log(`${colors.bold}${"=".repeat(70)}${colors.reset}`);
  console.log(
    `${colors.bold}Total Tests: ${totalTests} | ` +
      `${colors.green}Passed: ${passedTests}${colors.reset} | ` +
      `${colors.red}Failed: ${failedTests}${colors.reset}`
  );
  console.log(`${colors.bold}${"=".repeat(70)}${colors.reset}\n`);

  if (failedTests === 0) {
    console.log(
      `${colors.green}${colors.bold}✅ SUCCESS: All encryption error handling tests passed!${colors.reset}\n`
    );
    console.log("The encryption system handles errors gracefully:");
    console.log("  ✅ Missing encryption key - Clear error message");
    console.log("  ✅ Wrong encryption key - Detected and reported");
    console.log("  ✅ Corrupted encrypted data - Handled safely");
    console.log("  ✅ No sensitive data exposed in error messages");
  } else {
    console.log(`${colors.red}${colors.bold}❌ FAILURE: ${failedTests} test(s) failed${colors.reset}\n`);
    console.log("Please review the failed tests above and fix the error handling.\n");
  }
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
  printHeader("OAuth Token Encryption - Error Handling Tests");

  console.log("This script tests that encryption errors are handled gracefully:\n");
  console.log("  1. Missing OAUTH_ENCRYPTION_KEY environment variable");
  console.log("  2. Wrong encryption key (decryption with different key)");
  console.log("  3. Corrupted encrypted data");
  console.log("  4. Null/undefined value handling\n");

  // Run all tests
  await testMissingEncryptionKey();
  await testWrongEncryptionKey();
  await testCorruptedData();
  await testNullUndefinedHandling();

  // Print summary
  printSummary();

  // Exit with appropriate code
  const hasFailures = results.some((r) => !r.passed);
  process.exit(hasFailures ? 1 : 0);
}

// Run the tests
main().catch((error) => {
  console.error(`${colors.red}${colors.bold}Unexpected error running tests:${colors.reset}`);
  console.error(error);
  process.exit(1);
});
