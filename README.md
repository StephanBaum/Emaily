# Email AI Client

A modern email client with AI-powered features, supporting Gmail and Microsoft Outlook through OAuth authentication.

## 🏗️ Architecture

This is a monorepo built with:
- **Web App** (`apps/web`): Next.js web application
- **Mobile App** (`apps/mobile`): React Native mobile application
- **Database** (`packages/database`): Prisma ORM with PostgreSQL
- **AI Package** (`packages/ai`): AI-powered email features

## 🔐 Security: OAuth Token Encryption

**CRITICAL:** This application stores OAuth access tokens and refresh tokens that provide full access to users' email accounts via Gmail and Microsoft Graph APIs. These tokens are encrypted at rest using **AES-256-GCM** encryption to protect them from database compromise.

### Why Token Encryption Is Important

OAuth tokens stored in this application have read, write, modify, and send permissions for users' email accounts. If the database is compromised through:
- SQL injection vulnerabilities
- Database backup exposure
- Insider threats
- Infrastructure breaches

...attackers would have immediate access to all users' email accounts, **bypassing password authentication entirely**. Encryption ensures that even if the database is compromised, the tokens remain protected.

### Setting Up Encryption (Required)

#### 1. Generate an Encryption Key

Generate a secure 32-byte encryption key using OpenSSL:

```bash
openssl rand -base64 32
```

#### 2. Add to Environment Variables

Add the generated key to your `.env` file:

```bash
OAUTH_ENCRYPTION_KEY="<your-generated-key-here>"
```

**⚠️ Important Security Notes:**
- **Keep this key secure** - it's required to decrypt all OAuth tokens
- **Store in a secrets manager** for production environments (AWS Secrets Manager, HashiCorp Vault, etc.)
- **Never commit to version control** - it's already in `.gitignore`
- **Back up securely** - if you lose this key, encrypted tokens cannot be recovered and users must re-authenticate
- **Use different keys** for development, staging, and production environments

#### 3. What Gets Encrypted

The following OAuth tokens are automatically encrypted when stored in the database:
- **Access tokens**: Used for API requests to Gmail/Outlook
- **Refresh tokens**: Used to obtain new access tokens when they expire

Encryption happens automatically in:
- Auth.js OAuth sign-in flow
- Mobile app authentication sync endpoint
- Token refresh operations

Decryption happens automatically when:
- Creating Gmail/Outlook API service instances
- Reading tokens from the database for API calls

### Migrating Existing Tokens

If you're upgrading from a version without encryption, or need to encrypt existing plaintext tokens in your database, follow these steps:

#### Prerequisites

1. **Back up your database** (CRITICAL - do not skip this step):
   ```bash
   pg_dump -h localhost -U postgres -d emailclient > backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Set the encryption key** in your `.env` file (see above)

3. **Install dependencies**: `pnpm install`

#### Running the Migration

1. **Test with dry-run mode** (preview changes without modifying the database):
   ```bash
   pnpm --filter @email-ai/database tsx scripts/encrypt-existing-tokens.ts --dry-run
   ```

2. **Run the actual migration**:
   ```bash
   pnpm --filter @email-ai/database tsx scripts/encrypt-existing-tokens.ts
   ```

3. **Verify the migration**:
   ```bash
   pnpm --filter @email-ai/database tsx scripts/verify-token-encryption.ts
   ```

The migration script includes safety features:
- ✅ Automatically detects and skips already-encrypted tokens
- ✅ Detailed logging of all changes
- ✅ Statistics reporting
- ✅ Error handling for individual record failures

#### Detailed Migration Documentation

For comprehensive migration instructions, troubleshooting, and rollback procedures, see:
- **[Database Migration Guide](./packages/database/scripts/README.md)** - Complete step-by-step migration instructions
- **[E2E Testing Guide](./.auto-claude/specs/011-oauth-tokens-stored-unencrypted-in-database/E2E-TEST-GUIDE.md)** - Testing OAuth flows after migration

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm 9.15.0 or higher
- PostgreSQL database

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd email-ai-client
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Configure required environment variables** in `.env`:
   - `DATABASE_URL` - PostgreSQL connection string
   - `AUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `OAUTH_ENCRYPTION_KEY` - **REQUIRED** - Generate with `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` - For Gmail OAuth
   - `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` - For Outlook OAuth

5. **Set up the database**:
   ```bash
   pnpm db:push
   ```

6. **Start the development server**:
   ```bash
   pnpm dev
   ```

   Or start individual apps:
   ```bash
   pnpm dev:web     # Web app only
   pnpm dev:mobile  # Mobile app only
   ```

## 📦 Available Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps for production
- `pnpm test` - Run all tests
- `pnpm test:integration` - Run integration tests
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm lint` - Run linting
- `pnpm db:push` - Push database schema changes
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Prisma Studio (database GUI)

## 🔧 OAuth Setup

### Google OAuth (Gmail)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
4. Add the credentials to your `.env` file

### Microsoft OAuth (Outlook)

1. Go to [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Register a new application
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/azure-ad` (development)
   - `https://yourdomain.com/api/auth/callback/azure-ad` (production)
4. Add the credentials to your `.env` file

## 🧪 Testing

After setting up OAuth token encryption, verify everything works:

1. **Run automated verification**:
   ```bash
   pnpm --filter @email-ai/database tsx scripts/verify-token-encryption.ts
   ```

2. **Manual testing**:
   - Sign in with Google OAuth
   - Sign in with Microsoft OAuth
   - Verify email fetching works
   - Verify email sending works
   - Check database to confirm tokens are encrypted (base64 strings)

## 📚 Documentation

- [Migration Guide](./packages/database/scripts/README.md) - OAuth token encryption migration
- [E2E Testing Guide](./.auto-claude/specs/011-oauth-tokens-stored-unencrypted-in-database/E2E-TEST-GUIDE.md) - End-to-end testing procedures
- [Mobile Sync Testing](./.auto-claude/specs/011-oauth-tokens-stored-unencrypted-in-database/MOBILE-SYNC-TEST.md) - Mobile authentication testing

## 🔒 Security Best Practices

1. ✅ **Use encryption keys from secrets managers in production**
2. ✅ **Never commit secrets to version control**
3. ✅ **Use different encryption keys per environment**
4. ✅ **Back up your encryption key securely**
5. ✅ **Always back up the database before running migrations**
6. ✅ **Rotate encryption keys periodically** (requires token re-encryption)
7. ✅ **Monitor for unauthorized database access**
8. ✅ **Use environment-specific OAuth credentials**

## 📄 License

[Your License Here]

## 🤝 Contributing

[Your Contributing Guidelines Here]

---

**Security Contact**: If you discover a security vulnerability, please email [security@yourdomain.com] instead of using the issue tracker.
