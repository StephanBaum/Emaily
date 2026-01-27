# Outlook Graph Subscriptions Setup Guide

This guide walks through setting up Microsoft Graph subscriptions for Outlook push notifications.

## Overview

Microsoft Graph subscriptions allow your application to receive real-time webhook notifications when new emails arrive in Outlook/Microsoft 365 mailboxes. Unlike Gmail (which requires Google Cloud Pub/Sub infrastructure), Outlook uses direct webhook subscriptions via the Graph API.

## Architecture

```
Outlook → Microsoft Graph → Change Notification → Your Webhook → Email Sync
```

1. **Outlook**: User's Microsoft 365 or Outlook.com mailbox
2. **Microsoft Graph**: Microsoft's unified API for Microsoft 365 services
3. **Change Notification**: Webhook POST request when mailbox changes
4. **Your Webhook**: `/api/webhooks/outlook` endpoint receives notifications
5. **Email Sync**: Triggers incremental sync to fetch new emails

## Key Differences from Gmail

| Feature | Gmail (Pub/Sub) | Outlook (Graph) |
|---------|----------------|-----------------|
| Infrastructure | Requires Google Cloud Pub/Sub | Direct API subscriptions |
| Setup Complexity | Higher (cloud resources) | Lower (API only) |
| Max Duration | 7 days | ~3 days (4230 minutes) |
| Validation | None | Required on creation |
| Per-User Setup | Yes | Yes |

## Prerequisites

1. **Azure App Registration** with Microsoft Graph API permissions
2. **Public HTTPS URL** for your webhook (required)
3. **Microsoft OAuth** credentials already configured
4. **Webhook endpoint** that responds to validation requests

## Quick Setup (Automated)

Run the automated setup script:

```bash
chmod +x scripts/setup-outlook-subscriptions.sh
./scripts/setup-outlook-subscriptions.sh
```

The script will:
1. Update `.env` file with webhook URL
2. Provide Azure App registration instructions
3. Explain subscription lifecycle management
4. Show testing and monitoring commands

## Manual Setup

### Step 1: Configure Azure App Registration

1. Go to [Azure Portal - App Registrations](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps)

2. Select your app (or create a new one)

3. **Add API Permissions**:
   - Navigate to "API permissions"
   - Add permissions → Microsoft Graph → Delegated permissions
   - Select these permissions:
     - `Mail.Read` - Read user mail
     - `Mail.ReadWrite` - Read and write access to user mail
     - `offline_access` - Maintain access to data
     - `User.Read` - Sign in and read user profile
   - Click "Grant admin consent" (if you're an admin)

4. **Configure Redirect URIs**:
   - Navigate to "Authentication"
   - Add platform → Web
   - Add redirect URI: `https://your-domain.com/api/auth/callback/azure-ad`
   - For mobile: `exp://localhost:19000`

5. **Create Client Secret**:
   - Navigate to "Certificates & secrets"
   - New client secret
   - Copy the secret value (only shown once!)
   - Add to `.env` as `AZURE_CLIENT_SECRET`

### Step 2: Configure Webhook URL

Update your `.env` file:

```bash
# Outlook Graph Subscription Configuration
WEBHOOK_BASE_URL="https://your-domain.com"
AZURE_CLIENT_ID="your-azure-client-id"
AZURE_CLIENT_SECRET="your-azure-client-secret"
AZURE_TENANT_ID="common"  # or your tenant ID
```

**Important**:
- Webhook URL MUST use HTTPS (required by Microsoft)
- For local development, use [ngrok](https://ngrok.com/): `ngrok http 3000`

### Step 3: Test Webhook Validation

Microsoft Graph validates your webhook before creating a subscription:

```bash
# Test validation endpoint
curl "https://your-domain.com/api/webhooks/outlook?validationToken=test123"
# Expected response: test123
```

Your webhook endpoint at `/api/webhooks/outlook` already handles validation:

```typescript
// GET request with validationToken
export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("OK", { status: 200 });
}
```

## Testing

### Test Subscription Creation

Run the test script to create and verify a subscription:

```bash
node scripts/test-outlook-subscription.js
```

The script will:
1. Find an Outlook account in your database
2. Create a Microsoft Graph subscription
3. Verify the subscription is active
4. Show subscription details and expiration

Expected output:
```
✅ Subscription created successfully!

📊 Subscription Details:
   Subscription ID: a1b2c3d4-e5f6-...
   Expiration: 2024-01-30T12:00:00.000Z
   Expires At: 1/30/2024, 12:00:00 PM
   Days Until Expiration: 2.97
```

### Test End-to-End Flow

1. **Start your application**:
   ```bash
   pnpm dev
   ```

2. **Connect an Outlook account** in your app

3. **Send a test email** to the connected Outlook address

4. **Verify webhook received notification**:
   - Check logs: `tail -f logs/app.log`
   - Query database: `SELECT * FROM WebhookLog ORDER BY createdAt DESC LIMIT 5;`
   - Check incremental sync triggered

5. **Verify email appears** in your app immediately

## Subscription Lifecycle Management

### Automatic Management

Your application automatically handles subscription lifecycle:

1. **Creation**: When user connects Outlook account
   - Calls `outlookSubscriptionService.createSubscription()`
   - Stores subscription ID with email account
   - Subscription active for ~3 days

2. **Renewal**: Before subscription expires
   - Checked during email sync operations
   - Renews if less than 1 day remaining
   - Updates expiration date

3. **Deletion**: When user disconnects account
   - Calls `outlookSubscriptionService.deleteSubscription()`
   - Cleans up Microsoft Graph subscription

### Manual Management

**List active subscriptions**:
```bash
# Using Microsoft Graph Explorer
# Visit: https://developer.microsoft.com/graph/graph-explorer
# Run: GET https://graph.microsoft.com/v1.0/subscriptions

# Or with curl (requires access token)
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://graph.microsoft.com/v1.0/subscriptions
```

**Delete a subscription**:
```bash
# Using the test script
node scripts/delete-outlook-subscription.js SUBSCRIPTION_ID

# Or with Graph API
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://graph.microsoft.com/v1.0/subscriptions/SUBSCRIPTION_ID
```

**Check subscription status**:
```typescript
const service = createOutlookSubscriptionService(tokens);
const status = await service.checkSubscriptionStatus(subscriptionId);

console.log('Active:', status.active);
console.log('Expires:', status.expiresAt);
console.log('Needs Renewal:', status.needsRenewal);
```

## Usage Examples

### Create Subscription

```typescript
import { createOutlookSubscriptionService } from '@/lib/notifications/outlook-subscriptions';

const service = createOutlookSubscriptionService({
  accessToken: account.accessToken,
  refreshToken: account.refreshToken,
  expiresAt: account.tokenExpiresAt.getTime(),
});

const subscription = await service.createSubscription({
  notificationUrl: 'https://your-domain.com/api/webhooks/outlook',
  expirationMinutes: 4230, // ~3 days (max)
});

console.log('Subscription ID:', subscription.subscriptionId);
console.log('Expires:', subscription.expirationDateTime);
```

### Renew Subscription

```typescript
const renewed = await service.renewSubscription(
  subscriptionId,
  4230 // Extend for another ~3 days
);

console.log('New expiration:', renewed.expirationDateTime);
```

### Delete Subscription

```typescript
await service.deleteSubscription(subscriptionId);
console.log('Subscription deleted');
```

### Check Status

```typescript
const status = await service.checkSubscriptionStatus(subscriptionId);

if (status.needsRenewal) {
  await service.renewSubscription(subscriptionId);
}
```

## Webhook Payload

When a change occurs, Microsoft Graph sends a POST request:

```json
{
  "value": [
    {
      "subscriptionId": "a1b2c3d4-e5f6-...",
      "clientState": "optional-client-state",
      "expirationDateTime": "2024-01-30T12:00:00.000Z",
      "resource": "Users/user-id/Messages/message-id",
      "resourceData": {
        "@odata.type": "#Microsoft.Graph.Message",
        "@odata.id": "Users/user-id/Messages/message-id",
        "@odata.etag": "etag-value",
        "id": "message-id"
      },
      "changeType": "created",
      "tenantId": "tenant-id"
    }
  ]
}
```

Your webhook handler processes this and triggers email sync.

## Monitoring

### View Webhook Logs

Query the `WebhookLog` table:

```sql
SELECT
  endpoint,
  method,
  statusCode,
  error,
  createdAt
FROM WebhookLog
WHERE endpoint = '/api/webhooks/outlook'
ORDER BY createdAt DESC
LIMIT 20;
```

### Monitor Subscription Health

Check subscription expiration dates:

```typescript
// In your application
const accounts = await prisma.emailAccount.findMany({
  where: { provider: 'microsoft' },
});

for (const account of accounts) {
  const service = createOutlookSubscriptionService(account);
  const status = await service.checkSubscriptionStatus(
    account.subscriptionId
  );

  if (status.needsRenewal) {
    console.log(`⚠️  Subscription expiring soon: ${account.emailAddress}`);
  }
}
```

### Graph API Monitoring

Use [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) to:
- List active subscriptions
- View subscription details
- Test Graph API calls
- Debug permission issues

## Troubleshooting

### Subscription Creation Fails

**Error: "Validation request failed"**
- **Cause**: Webhook not accessible or not responding correctly
- **Solution**:
  - Verify webhook is publicly accessible via HTTPS
  - Test: `curl "https://your-domain.com/api/webhooks/outlook?validationToken=test"`
  - Expected response: `test`
  - For local dev, use ngrok: `ngrok http 3000`

**Error: "Insufficient privileges"**
- **Cause**: Missing Microsoft Graph API permissions
- **Solution**:
  - Go to Azure Portal → Your App → API permissions
  - Ensure `Mail.Read`, `Mail.ReadWrite`, `offline_access` are granted
  - Click "Grant admin consent"

**Error: "Invalid authentication token"**
- **Cause**: Access token expired or invalid
- **Solution**:
  - Reconnect Outlook account in your app
  - Check token refresh logic is working
  - Verify `AZURE_CLIENT_SECRET` in `.env`

### Webhook Not Receiving Notifications

1. **Check subscription is active**:
   ```bash
   node scripts/test-outlook-subscription.js
   ```

2. **Verify webhook endpoint**:
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/outlook \
     -H "Content-Type: application/json" \
     -d '{"value":[]}'
   ```

3. **Check webhook logs**:
   ```sql
   SELECT * FROM WebhookLog
   WHERE endpoint = '/api/webhooks/outlook'
   ORDER BY createdAt DESC;
   ```

4. **Verify subscription hasn't expired**:
   - Subscriptions last ~3 days
   - Check expiration date in database
   - Auto-renewal should occur 1 day before expiry

### Local Development with ngrok

For testing webhooks locally:

```bash
# Start ngrok
ngrok http 3000

# Copy HTTPS URL (e.g., https://abc123.ngrok.io)

# Update .env
WEBHOOK_BASE_URL="https://abc123.ngrok.io"

# Restart your app
pnpm dev

# Test webhook validation
curl "https://abc123.ngrok.io/api/webhooks/outlook?validationToken=test"
```

## Security Considerations

### Webhook Authentication

Consider adding webhook authentication:

```typescript
// Optional: Verify requests are from Microsoft
const clientState = process.env.OUTLOOK_CLIENT_STATE;

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Verify clientState matches (if configured)
  if (clientState && body.value[0]?.clientState !== clientState) {
    return NextResponse.json({ error: 'Invalid client state' }, { status: 403 });
  }

  // Process notification...
}
```

### Access Token Security

- Never log access tokens
- Store tokens encrypted in database
- Use refresh tokens to renew access
- Implement token rotation

### HTTPS Required

- Microsoft Graph requires HTTPS webhooks
- Use valid SSL certificates (not self-signed)
- For production, use proper domain with SSL

## Cost Considerations

Microsoft Graph subscriptions are:
- **Free** for standard Microsoft 365 and Outlook.com accounts
- No per-request charges
- No infrastructure costs (unlike Gmail Pub/Sub)
- Included in Microsoft Graph API quotas

**API Rate Limits**:
- Most Microsoft 365 plans: 10,000 requests per 10 minutes per user
- Consumer Outlook.com: Lower limits
- Webhooks don't count against user quota

## Best Practices

1. **Subscription Management**:
   - Store subscription ID with email account
   - Track expiration dates
   - Implement auto-renewal before expiry
   - Clean up subscriptions on account disconnect

2. **Webhook Reliability**:
   - Return 200 OK quickly (< 10 seconds)
   - Process notifications asynchronously
   - Log all webhook requests for debugging
   - Handle duplicate notifications gracefully

3. **Error Handling**:
   - Implement retry logic for failed subscriptions
   - Alert on repeated subscription failures
   - Fallback to polling if webhooks fail
   - Monitor webhook error rates

4. **Testing**:
   - Test webhook validation before production
   - Verify notifications arrive promptly
   - Test subscription renewal logic
   - Test with multiple Outlook accounts

## Additional Resources

- **Microsoft Graph Webhooks**: https://learn.microsoft.com/graph/webhooks
- **Subscription Resource**: https://learn.microsoft.com/graph/api/subscription-post-subscriptions
- **Change Notifications**: https://learn.microsoft.com/graph/webhooks-outlook-authz
- **Graph Explorer**: https://developer.microsoft.com/graph/graph-explorer
- **Azure Portal**: https://portal.azure.com/
- **Graph API Reference**: https://learn.microsoft.com/graph/api/overview

## Support

For issues with:
- **Subscription creation**: Check Azure permissions and webhook accessibility
- **Webhook validation**: Ensure endpoint returns validation token correctly
- **Notifications not arriving**: Verify subscription is active and not expired
- **Permission errors**: Review Azure App registration permissions

## Summary

Outlook Graph subscriptions provide real-time push notifications with:
- ✅ Simple setup (no cloud infrastructure required)
- ✅ Direct API integration
- ✅ Automatic lifecycle management
- ✅ Free (no additional costs)
- ⚠️  Shorter lifetime (~3 days vs Gmail's 7 days)
- ⚠️  Requires webhook validation
- ⚠️  HTTPS mandatory

Once configured, subscriptions enable instant email notifications for a responsive, real-time email experience.
