# Database Migration Scripts

## OAuth Token Encryption Migration

This directory contains scripts for migrating and managing OAuth tokens in the database.

### Overview

This directory contains two main scripts:

1. **`encrypt-existing-tokens.ts`** - Encrypts existing plaintext OAuth tokens
2. **`verify-token-encryption.ts`** - Verifies all tokens are properly encrypted

The `encrypt-existing-tokens.ts` script encrypts existing plaintext OAuth access tokens and refresh tokens using AES-256-GCM encryption. This migration is required for security compliance to protect OAuth tokens stored in the database.

**What it does:**
- Encrypts tokens in the `Account` table (Auth.js OAuth accounts)
- Encrypts tokens in the `EmailAccount` table (email provider connections)
- Detects and skips already-encrypted tokens
- Provides detailed logging and statistics

The `verify-token-encryption.ts` script verifies that all OAuth tokens are properly encrypted and can be used after migration or for regular security audits.

---

## Prerequisites

Before running the migration, ensure you have:

1. **Environment Variables Configured**
   - `DATABASE_URL`: PostgreSQL connection string
   - `OAUTH_ENCRYPTION_KEY`: 32-byte base64-encoded encryption key

2. **Database Backup**
   - **CRITICAL**: Always backup your database before running migrations
   ```bash
   # PostgreSQL backup example
   pg_dump -h localhost -U postgres -d emailclient > backup-$(date +%Y%m%d-%H%M%S).sql
   ```

3. **Node.js and Dependencies**
   - Ensure all dependencies are installed: `pnpm install`

---

## Step-by-Step Migration Guide

### Step 1: Generate Encryption Key

Generate a secure 32-byte encryption key using OpenSSL:

```bash
openssl rand -base64 32
```

Add this key to your `.env` file:

```bash
OAUTH_ENCRYPTION_KEY="<generated-key-here>"
```

**Important:**
- Keep this key secure - it's required to decrypt tokens
- Store it in a secrets manager for production environments
- Never commit it to version control
- If you lose this key, encrypted tokens cannot be recovered

### Step 2: Test with Dry Run

Always run the migration in dry-run mode first to preview changes:

```bash
# From the project root
pnpm --filter @email-ai/database tsx scripts/encrypt-existing-tokens.ts --dry-run
```

This will:
- Show which tokens would be encrypted
- Display statistics without modifying the database
- Verify your encryption key is configured correctly

**Review the output carefully** to ensure:
- The correct number of accounts are detected
- Already-encrypted tokens are properly skipped
- No errors are reported

### Step 3: Run the Migration

Once you've verified the dry-run output, execute the actual migration:

```bash
# From the project root
pnpm --filter @email-ai/database tsx scripts/encrypt-existing-tokens.ts
```

The script will:
- Process all accounts in both tables
- Encrypt plaintext tokens
- Skip already-encrypted tokens
- Display progress and final statistics

**Expected output:**
```
🔐 OAuth Token Encryption Migration
=====================================
⚠️  LIVE MODE - Tokens will be encrypted in the database
✅ Encryption key configured

📋 Migrating Account table...
Found X accounts to process
  ✅ Encrypted account abc123 (google)
  ⏭️  Account def456 (google): Already encrypted, skipping

📋 Migrating EmailAccount table...
Found Y email accounts to process
  ✅ Encrypted email account xyz789 (GOOGLE)

📊 Migration Summary
=====================
Accounts:       X processed, Y updated, Z skipped
EmailAccounts:  X processed, Y updated, Z skipped
Errors:         0

✅ Migration completed successfully!
```

### Step 4: Verify Migration Success

After migration, verify that tokens are encrypted:

1. **Run the automated verification script:**
   ```bash
   pnpm --filter @email-ai/database tsx scripts/verify-token-encryption.ts
   ```

   Expected output:
   ```
   ✅ SUCCESS: All OAuth tokens are properly encrypted!
   ```

   If the script reports issues, review the recommendations and re-run the migration if needed.

2. **Check the database directly:**
   ```sql
   -- Access tokens should look like encrypted base64 strings
   SELECT id, provider, LEFT(access_token, 50) as token_sample
   FROM "Account"
   LIMIT 5;

   SELECT id, provider, LEFT("accessToken", 50) as token_sample
   FROM "EmailAccount"
   LIMIT 5;
   ```

3. **Test OAuth functionality:**
   - Log in with Google OAuth
   - Log in with Microsoft OAuth
   - Verify email fetching still works
   - Verify email sending still works

4. **Check application logs:**
   - No decryption errors should appear
   - OAuth API calls should work normally

---

## Rollback Procedure

If you need to rollback the migration:

### Option 1: Restore from Database Backup (Recommended)

```bash
# PostgreSQL restore example
psql -h localhost -U postgres -d emailclient < backup-YYYYMMDD-HHMMSS.sql
```

**Important:** This will restore the entire database to the backup point, losing any data created after the backup.

### Option 2: Manual Decryption (Not Recommended)

If you need to selectively decrypt tokens without a full restore:

1. Create a decryption script (similar pattern to the migration script)
2. Use the same `OAUTH_ENCRYPTION_KEY` that was used for encryption
3. Import `decryptOAuthToken` from `@email-ai/database`
4. Decrypt each token and update the database

**Note:** Manual decryption is error-prone and should only be used if a full restore isn't feasible.

### Option 3: Re-authenticate Users

If tokens cannot be decrypted and you don't have a backup:

1. Clear the `Account` and `EmailAccount` tables (or specific problematic rows)
2. Have users re-authenticate with OAuth
3. New tokens will be encrypted properly

---

## Safety Features

The migration script includes several safety features:

1. **Already-Encrypted Detection**: Automatically detects and skips tokens that are already encrypted
2. **Dry-Run Mode**: Preview changes without modifying the database
3. **Detailed Logging**: Track exactly what's being changed
4. **Error Handling**: Continues processing if individual records fail
5. **Statistics Reporting**: Clear summary of what was changed

---

## Troubleshooting

### Error: "OAUTH_ENCRYPTION_KEY environment variable is not set"

**Solution:** Generate an encryption key and add it to your `.env` file:
```bash
openssl rand -base64 32
```

### Error: "PrismaClient initialization failed"

**Solution:** Verify your `DATABASE_URL` is correct and the database is accessible.

### Tokens Still Not Working After Migration

**Possible causes:**
1. **Wrong encryption key**: Ensure you're using the same key that was used during migration
2. **Key mismatch**: Development vs production environments using different keys
3. **Corrupted tokens**: Some tokens may have been corrupted during migration

**Debug steps:**
1. Check logs for decryption errors
2. Try re-authenticating a test account
3. Verify the `OAUTH_ENCRYPTION_KEY` is consistent across all environments

### Some Tokens Were Skipped

This is normal behavior. Tokens are skipped if:
- They're already encrypted (detected by base64 format and length)
- They're null or empty

If tokens should have been encrypted but were skipped, check:
1. Are they already encrypted from a previous migration run?
2. Run with `--dry-run` to see why they're being skipped

### Migration Reports Errors

If the migration completes with errors:
1. Review the error messages in the output
2. Check if specific accounts are problematic
3. Consider manually inspecting those accounts in the database
4. You may need to re-authenticate those specific accounts

---

## Best Practices

1. **Always test in a staging environment first**
2. **Always backup before running migrations**
3. **Run dry-run mode first to preview changes**
4. **Verify OAuth functionality after migration**
5. **Store encryption keys securely (use secrets manager)**
6. **Document your encryption key backup location**
7. **Monitor application logs after migration**

---

## Technical Details

**Encryption Algorithm:** AES-256-GCM
- Industry-standard authenticated encryption
- Provides confidentiality and authenticity
- IV (initialization vector) is randomly generated for each encryption
- Auth tag prevents tampering

**Key Management:**
- 32-byte (256-bit) encryption key
- Stored as base64-encoded string in environment variable
- Same key must be used for encryption and decryption

**Token Format:**
- Encrypted tokens are stored as base64-encoded strings
- Format: `base64(IV + ciphertext + auth_tag)`
- Minimum length: ~38 characters (after base64 encoding)

---

## Support

If you encounter issues not covered in this guide:

1. Check the application logs for detailed error messages
2. Verify all prerequisites are met
3. Review the migration script source code for implementation details
4. Consult the main project documentation for OAuth setup

---

**Last Updated:** 2026-01-27
