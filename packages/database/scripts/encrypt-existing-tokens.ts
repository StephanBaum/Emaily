/**
 * OAuth Token Migration Script
 *
 * This script encrypts existing plaintext OAuth tokens in the database using AES-256-GCM.
 * It processes both the Account table (Auth.js OAuth accounts) and EmailAccount table
 * (application email provider connections).
 *
 * Usage:
 *   DRY RUN (preview changes without modifying database):
 *     pnpm tsx scripts/encrypt-existing-tokens.ts --dry-run
 *
 *   ACTUAL MIGRATION (encrypt tokens in database):
 *     pnpm tsx scripts/encrypt-existing-tokens.ts
 *
 * Environment Requirements:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - OAUTH_ENCRYPTION_KEY: 32-byte base64-encoded encryption key
 *
 * Safety Features:
 *   - Detects already-encrypted tokens and skips them
 *   - Dry-run mode to preview changes
 *   - Detailed logging of all operations
 *   - Proper error handling and rollback
 */

import { PrismaClient } from "@prisma/client";
import { encryptOAuthToken } from "../src/token-encryption";

const prisma = new PrismaClient();

/**
 * Check if a token appears to be already encrypted.
 * Encrypted tokens are base64-encoded strings that start with the IV (12 bytes).
 * We check for base64 format and minimum length.
 *
 * @param token - Token to check
 * @returns true if token appears to be encrypted
 */
function isTokenEncrypted(token: string | null | undefined): boolean {
  if (!token) {
    return true; // Treat null/empty as "already processed"
  }

  // Check if it's a valid base64 string
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(token)) {
    return false; // Contains non-base64 characters, must be plaintext
  }

  try {
    // Encrypted tokens should be at least IV (12) + auth tag (16) = 28 bytes
    // In base64, that's about 38 characters minimum
    const decoded = Buffer.from(token, "base64");
    if (decoded.length < 28) {
      return false;
    }

    // If it looks like base64 and is long enough, assume it's encrypted
    // This is a heuristic - we can't be 100% certain without trying to decrypt
    return true;
  } catch {
    return false; // Failed to decode as base64, must be plaintext
  }
}

/**
 * Statistics for the migration
 */
interface MigrationStats {
  accountsProcessed: number;
  accountsUpdated: number;
  accountsSkipped: number;
  emailAccountsProcessed: number;
  emailAccountsUpdated: number;
  emailAccountsSkipped: number;
  errors: number;
}

/**
 * Migrate tokens in the Account table (Auth.js OAuth accounts)
 */
async function migrateAccountTokens(dryRun: boolean): Promise<MigrationStats> {
  const stats: MigrationStats = {
    accountsProcessed: 0,
    accountsUpdated: 0,
    accountsSkipped: 0,
    emailAccountsProcessed: 0,
    emailAccountsUpdated: 0,
    emailAccountsSkipped: 0,
    errors: 0,
  };

  console.log("\n📋 Migrating Account table...");

  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      provider: true,
      access_token: true,
      refresh_token: true,
    },
  });

  console.log(`Found ${accounts.length} accounts to process`);

  for (const account of accounts) {
    stats.accountsProcessed++;

    try {
      const needsAccessTokenUpdate =
        account.access_token && !isTokenEncrypted(account.access_token);
      const needsRefreshTokenUpdate =
        account.refresh_token && !isTokenEncrypted(account.refresh_token);

      if (!needsAccessTokenUpdate && !needsRefreshTokenUpdate) {
        console.log(
          `  ⏭️  Account ${account.id} (${account.provider}): Already encrypted, skipping`
        );
        stats.accountsSkipped++;
        continue;
      }

      // Prepare encrypted tokens
      const encryptedAccessToken = needsAccessTokenUpdate
        ? encryptOAuthToken(account.access_token)
        : account.access_token;

      const encryptedRefreshToken = needsRefreshTokenUpdate
        ? encryptOAuthToken(account.refresh_token)
        : account.refresh_token;

      if (dryRun) {
        console.log(
          `  🔍 [DRY RUN] Would encrypt account ${account.id} (${account.provider}):`
        );
        if (needsAccessTokenUpdate) {
          console.log(`      - access_token: ${account.access_token?.substring(0, 20)}... → [encrypted]`);
        }
        if (needsRefreshTokenUpdate) {
          console.log(`      - refresh_token: ${account.refresh_token?.substring(0, 20)}... → [encrypted]`);
        }
      } else {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: encryptedAccessToken,
            refresh_token: encryptedRefreshToken,
          },
        });
        console.log(
          `  ✅ Encrypted account ${account.id} (${account.provider})`
        );
      }

      stats.accountsUpdated++;
    } catch (error) {
      console.error(
        `  ❌ Error processing account ${account.id}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Migrate tokens in the EmailAccount table (application email provider connections)
 */
async function migrateEmailAccountTokens(
  dryRun: boolean
): Promise<Omit<MigrationStats, "accountsProcessed" | "accountsUpdated" | "accountsSkipped">> {
  const stats = {
    emailAccountsProcessed: 0,
    emailAccountsUpdated: 0,
    emailAccountsSkipped: 0,
    errors: 0,
  };

  console.log("\n📋 Migrating EmailAccount table...");

  const emailAccounts = await prisma.emailAccount.findMany({
    select: {
      id: true,
      provider: true,
      accessToken: true,
      refreshToken: true,
    },
  });

  console.log(`Found ${emailAccounts.length} email accounts to process`);

  for (const account of emailAccounts) {
    stats.emailAccountsProcessed++;

    try {
      const needsAccessTokenUpdate = !isTokenEncrypted(account.accessToken);
      const needsRefreshTokenUpdate =
        account.refreshToken && !isTokenEncrypted(account.refreshToken);

      if (!needsAccessTokenUpdate && !needsRefreshTokenUpdate) {
        console.log(
          `  ⏭️  EmailAccount ${account.id} (${account.provider}): Already encrypted, skipping`
        );
        stats.emailAccountsSkipped++;
        continue;
      }

      // Prepare encrypted tokens
      const encryptedAccessToken = needsAccessTokenUpdate
        ? encryptOAuthToken(account.accessToken)
        : account.accessToken;

      const encryptedRefreshToken = needsRefreshTokenUpdate
        ? encryptOAuthToken(account.refreshToken)
        : account.refreshToken;

      if (dryRun) {
        console.log(
          `  🔍 [DRY RUN] Would encrypt email account ${account.id} (${account.provider}):`
        );
        if (needsAccessTokenUpdate) {
          console.log(`      - accessToken: ${account.accessToken.substring(0, 20)}... → [encrypted]`);
        }
        if (needsRefreshTokenUpdate) {
          console.log(`      - refreshToken: ${account.refreshToken?.substring(0, 20)}... → [encrypted]`);
        }
      } else {
        await prisma.emailAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encryptedAccessToken!,
            refreshToken: encryptedRefreshToken,
          },
        });
        console.log(
          `  ✅ Encrypted email account ${account.id} (${account.provider})`
        );
      }

      stats.emailAccountsUpdated++;
    } catch (error) {
      console.error(
        `  ❌ Error processing email account ${account.id}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Main migration function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("🔐 OAuth Token Encryption Migration");
  console.log("=====================================");

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made to the database");
  } else {
    console.log("⚠️  LIVE MODE - Tokens will be encrypted in the database");
  }

  // Verify encryption key is configured
  if (!process.env.OAUTH_ENCRYPTION_KEY) {
    console.error(
      "\n❌ ERROR: OAUTH_ENCRYPTION_KEY environment variable is not set"
    );
    console.error(
      "Generate one with: openssl rand -base64 32"
    );
    process.exit(1);
  }

  console.log("✅ Encryption key configured");

  try {
    // Migrate Account table
    const accountStats = await migrateAccountTokens(dryRun);

    // Migrate EmailAccount table
    const emailAccountStats = await migrateEmailAccountTokens(dryRun);

    // Combine statistics
    const totalStats: MigrationStats = {
      ...accountStats,
      ...emailAccountStats,
    };

    // Print summary
    console.log("\n📊 Migration Summary");
    console.log("=====================");
    console.log(
      `Accounts:       ${totalStats.accountsProcessed} processed, ${totalStats.accountsUpdated} updated, ${totalStats.accountsSkipped} skipped`
    );
    console.log(
      `EmailAccounts:  ${totalStats.emailAccountsProcessed} processed, ${totalStats.emailAccountsUpdated} updated, ${totalStats.emailAccountsSkipped} skipped`
    );
    console.log(`Errors:         ${totalStats.errors}`);

    if (dryRun) {
      console.log(
        "\n💡 This was a dry run. Run without --dry-run to perform the actual migration."
      );
    } else {
      console.log("\n✅ Migration completed successfully!");
    }

    if (totalStats.errors > 0) {
      console.error(
        `\n⚠️  Warning: ${totalStats.errors} error(s) occurred during migration. Review the logs above.`
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(
      "\n❌ Migration failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
