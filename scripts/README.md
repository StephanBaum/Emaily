# Scripts

This directory contains utility scripts for managing the Email AI Client application.

## Gmail Pub/Sub Setup

**File**: `setup-gmail-pubsub.ts`

Script for setting up and managing Gmail push notifications via Google Cloud Pub/Sub.

### Quick Start

```bash
# Install dependencies first
pnpm install

# Display setup instructions
npx tsx scripts/setup-gmail-pubsub.ts help

# Step 1: Create Pub/Sub topic
npx tsx scripts/setup-gmail-pubsub.ts create-topic

# Step 2: Grant Gmail publish permission
npx tsx scripts/setup-gmail-pubsub.ts grant-publish

# Step 3: Create push subscription
npx tsx scripts/setup-gmail-pubsub.ts create-sub

# Step 4: Start watch for a user (requires access token)
npx tsx scripts/setup-gmail-pubsub.ts start-watch <ACCESS_TOKEN>

# Step 5: Verify watch is active
npx tsx scripts/setup-gmail-pubsub.ts verify-watch <ACCESS_TOKEN>
```

### Prerequisites

Before running the script, you need:

1. **Google Cloud Project** with Gmail API and Pub/Sub API enabled
2. **Service Account** with Pub/Sub Admin role
3. **Environment Variables** configured in `.env`:
   ```bash
   GOOGLE_CLOUD_PROJECT="your-project-id"
   GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
   GMAIL_PUBSUB_TOPIC="gmail-notifications"
   GMAIL_PUBSUB_SUBSCRIPTION="gmail-notifications-sub"
   WEBHOOK_BASE_URL="https://your-domain.com"
   ```

### Detailed Documentation

For complete setup instructions, see: [docs/gmail-pubsub-setup.md](../docs/gmail-pubsub-setup.md)

### Available Commands

| Command | Description |
|---------|-------------|
| `help` | Display setup instructions and documentation |
| `create-topic` | Create a Pub/Sub topic for Gmail notifications |
| `grant-publish` | Grant Gmail API permission to publish to the topic |
| `create-sub` | Create a push subscription to your webhook endpoint |
| `start-watch` | Start Gmail watch for a user (requires access token) |
| `verify-watch` | Verify that a Gmail watch is active (requires access token) |
| `stop-watch` | Stop Gmail watch for a user (requires access token) |

### Getting Access Tokens

Access tokens are needed for watch operations. You can get them from:

1. **Database**: Query the `EmailAccount` table
   ```sql
   SELECT "accessToken" FROM "EmailAccount"
   WHERE "provider" = 'google' AND "emailAddress" = 'user@gmail.com';
   ```

2. **API**: Call your authentication endpoint
   ```bash
   curl -H "Authorization: Bearer <session-token>" \
     http://localhost:3000/api/auth/tokens
   ```

### Watch Lifecycle

Gmail watches have a 7-day expiration. To maintain continuous push notifications:

1. **Initial Setup**: Run `start-watch` when a user first connects their Gmail account
2. **Monitor Expiration**: Store `expiration` timestamp in your database
3. **Auto Renewal**: Set up a cron job to renew watches before they expire
4. **Error Handling**: If a watch expires, notifications stop until renewed

### Production Notes

- **Webhook URL**: Must be publicly accessible HTTPS endpoint
- **Local Development**: Use ngrok or similar tunneling service
- **Security**: Implement webhook verification (see docs)
- **Monitoring**: Set up alerts for watch expiration
- **Rate Limits**: Gmail allows 10,000 watch requests per day per project

### Troubleshooting

If you encounter issues:

1. **Check prerequisites**: Ensure all APIs are enabled and credentials are set
2. **Verify permissions**: Service account needs Pub/Sub Admin role
3. **Test webhook**: Ensure your webhook URL is publicly accessible
4. **Check logs**: Review Cloud Console logs for Pub/Sub delivery failures
5. **Consult documentation**: See [docs/gmail-pubsub-setup.md](../docs/gmail-pubsub-setup.md)

### Examples

#### Complete Setup Flow

```bash
# 1. Set up infrastructure
npx tsx scripts/setup-gmail-pubsub.ts create-topic
npx tsx scripts/setup-gmail-pubsub.ts grant-publish
npx tsx scripts/setup-gmail-pubsub.ts create-sub

# 2. Get user's access token from database
ACCESS_TOKEN="ya29.a0AfH6SMB..."

# 3. Start watching their inbox
npx tsx scripts/setup-gmail-pubsub.ts start-watch $ACCESS_TOKEN

# 4. Verify it's working
npx tsx scripts/setup-gmail-pubsub.ts verify-watch $ACCESS_TOKEN

# 5. Send a test email to the user's Gmail account
# Check your server logs for webhook notification
```

#### Stopping Notifications

```bash
# Stop watch for a user
ACCESS_TOKEN="ya29.a0AfH6SMB..."
npx tsx scripts/setup-gmail-pubsub.ts stop-watch $ACCESS_TOKEN
```

## Future Scripts

Additional scripts will be added here for:
- Outlook Graph subscription management
- Database migrations and seeding
- Notification testing utilities
- Monitoring and health checks
