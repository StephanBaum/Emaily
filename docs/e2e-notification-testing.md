# End-to-End Notification Flow Testing Guide

Complete guide for testing the real-time push notification feature from email arrival to mobile device notification.

## Overview

The E2E notification flow test verifies the complete journey of an email notification:

```
Email Arrives → Webhook Triggered → Email Synced → Push Sent → Device Displays → Tap Opens Email
```

## Prerequisites

Before running the E2E test, ensure all components are properly configured:

### 1. Backend Setup

- ✅ Development server running (`pnpm dev`)
- ✅ Database connection active (PostgreSQL)
- ✅ Gmail Pub/Sub **OR** Outlook Graph subscription configured
- ✅ Webhook endpoints accessible (publicly via HTTPS for production, or via ngrok for local development)

### 2. Email Account Setup

- ✅ Gmail or Outlook account connected in the app
- ✅ OAuth tokens valid and not expired
- ✅ Email account has active webhook subscription:
  - Gmail: Run `node scripts/test-gmail-watch.js` to verify
  - Outlook: Run `node scripts/test-outlook-subscription.js` to verify

### 3. Notification Configuration

- ✅ Notification preferences created for the email account
- ✅ Notifications enabled (`notificationEnabled: true`)
- ✅ Priority mode configured as desired (`priorityOnly: true/false`)
- ✅ Do-not-disturb hours configured (optional)

### 4. Mobile Device Setup

- ✅ Mobile app built and installed on physical device (not simulator)
- ✅ Notification permissions granted
- ✅ Device registered with push token (check `PushSubscription` table)
- ✅ App configured with correct API URL

## Running the E2E Test

### Automated Test Script

The automated test script handles backend verification and guides you through manual mobile device checks:

```bash
node scripts/test-e2e-notification-flow.js
```

### Test Flow

The script will guide you through 7 steps:

#### Step 1: Verify Prerequisites ✅
- Checks environment configuration
- Finds connected email account
- Verifies notification preferences
- Confirms push subscriptions active

#### Step 2: Send Test Email 📧
- Script displays the email address to send to
- Provides recommended subject line: `[TEST] E2E Notification Flow Test`
- Waits for user confirmation

#### Step 3: Monitor Webhook Logs 🔍
- Polls database for webhook log entries
- Timeout: 30 seconds
- Verifies webhook received and processed successfully

#### Step 4: Verify Email Sync 💾
- Polls database for synced email
- Timeout: 20 seconds
- Confirms email matches test message

#### Step 5: Verify Push Notification Conditions ✅
- Checks all notification conditions are met:
  - Notifications enabled
  - Active push subscriptions exist
  - Email meets priority criteria (if priority-only mode)
  - Not in do-not-disturb hours

#### Step 6: Mobile Device Verification 📱
- User manually checks device for notification
- Confirms notification displays correctly:
  - Title: "New email from [Sender]"
  - Body: Email subject line

#### Step 7: Navigation Test 🎯
- User taps notification on device
- Verifies app opens to correct email detail screen
- Confirms email content matches

### Expected Output

When successful, you'll see:

```
🎉 END-TO-END TEST PASSED! 🎉

All verification steps completed successfully:

✅ Backend setup verified (webhooks, database, preferences)
✅ Webhook received notification in 2.3s
✅ Email synced to database in 4.7s
✅ Push notification conditions met
✅ Notification received on mobile device
✅ Notification tap navigation working

📊 Test Summary:
   Email Account: user@example.com
   Provider: google
   Test Email: [TEST] E2E Notification Flow Test
   Total Time: 45.2s
   Webhook Delay: 2.3s
   Sync Delay: 4.7s
   Push Subscriptions: 1
   Notification Mode: All Emails

✨ The real-time push notification feature is working correctly!
```

## Manual Testing (Without Script)

If you prefer manual testing or need to debug specific components:

### 1. Verify Backend is Running

```bash
# Start development server
pnpm dev

# Check webhook endpoints are accessible
curl http://localhost:3000/api/webhooks/gmail
curl http://localhost:3000/api/webhooks/outlook
```

### 2. Check Database Configuration

```bash
# Open Prisma Studio to inspect data
pnpm db:studio

# Verify tables exist:
# - NotificationPreference
# - PushSubscription
# - WebhookLog
# - Email
```

### 3. Configure Notification Preferences

**Via API:**
```bash
curl -X POST http://localhost:3000/api/notifications/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "emailAccountId": "account-id",
    "notificationEnabled": true,
    "priorityOnly": false
  }'
```

**Via Mobile App:**
1. Open app → Settings
2. Enable "Push Notifications" toggle
3. Configure preferences as desired

### 4. Register Device for Push Notifications

**Via Mobile App:**
1. Open app → Settings
2. Toggle "Push Notifications" on
3. Grant permission when prompted

**Verify in Database:**
```sql
SELECT * FROM "PushSubscription" WHERE active = true;
```

### 5. Send Test Email

Send an email to your connected account:
- **To:** Your connected email address
- **Subject:** [TEST] Push Notification Test
- **From:** Any address

For priority-only mode, use high-priority keywords:
- "urgent", "important", "critical"
- Or send from an important contact

### 6. Monitor Webhook Logs

**Via Database:**
```sql
SELECT * FROM "WebhookLog"
ORDER BY "createdAt" DESC
LIMIT 10;
```

**Via API (if you add an endpoint):**
```bash
curl http://localhost:3000/api/webhooks/logs
```

### 7. Check Email Sync

**Via Database:**
```sql
SELECT * FROM "Email"
WHERE "accountId" = 'your-account-id'
ORDER BY "receivedAt" DESC
LIMIT 10;
```

**Via API:**
```bash
curl http://localhost:3000/api/emails
```

### 8. Verify Push Notification

**Check Mobile Device:**
- Notification should appear in notification center
- Title: "New email from [Sender Name]"
- Body: Email subject line
- Icon: App icon

**Check Expo Push Receipts (if using Expo):**
```bash
curl -X POST https://exp.host/--/api/v2/push/getReceipts \
  -H "Content-Type: application/json" \
  -d '{"ids": ["receipt-id-from-send-response"]}'
```

### 9. Test Navigation

**On Mobile Device:**
1. Tap the notification
2. App should open (or come to foreground)
3. Should navigate to email detail screen
4. Email content should match notification

## Troubleshooting

### Webhook Not Received

**Gmail:**
```bash
# Check watch status
node scripts/test-gmail-watch.js

# Verify Pub/Sub topic
gcloud pubsub topics describe gmail-notifications

# Check IAM permissions
gcloud pubsub topics get-iam-policy gmail-notifications
```

**Outlook:**
```bash
# Check subscription status
node scripts/test-outlook-subscription.js

# Verify webhook is accessible
curl "https://your-domain.com/api/webhooks/outlook?validationToken=test"
# Should return: test
```

**General:**
- Ensure webhook URL is publicly accessible
- Check firewall/network settings
- Review server logs for errors
- Verify HTTPS for production webhooks

### Email Not Syncing

**Check OAuth Tokens:**
```sql
SELECT "emailAddress", "provider", "tokenExpiresAt"
FROM "EmailAccount"
WHERE "accessToken" IS NOT NULL;
```

If tokens expired:
- Disconnect and reconnect account in app
- Implement token refresh logic

**Check Sync Service:**
- Review application logs for sync errors
- Test manual sync: `POST /api/emails/sync`
- Verify provider API credentials

### Push Notification Not Received

**Device Registration:**
```sql
SELECT * FROM "PushSubscription"
WHERE "userId" = 'user-id' AND active = true;
```

**Notification Preferences:**
```sql
SELECT * FROM "NotificationPreference"
WHERE "userId" = 'user-id';
```

**Common Issues:**
- Device token not registered → Re-enable notifications in app
- Simulator/emulator → Use physical device
- Permissions denied → Check device settings
- Priority filtering → Send high-priority email or disable priority-only
- DND hours → Check current time vs DND settings
- Expo token invalid → Rebuild app with valid Expo project

**Test Expo Push API directly:**
```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[xxxxxx]",
    "title": "Test Notification",
    "body": "Testing push notifications",
    "data": {"test": true}
  }'
```

### Navigation Not Working

**Check Notification Data:**
Ensure notification includes `emailId`:
```typescript
{
  to: expoPushToken,
  title: "New email from ...",
  body: subject,
  data: {
    emailId: email.id,  // ← Required for navigation
    messageId: email.messageId,
    priority: email.priority,
  }
}
```

**Check Tap Handler:**
File: `apps/mobile/app/_layout.tsx`
```typescript
Notifications.addNotificationResponseReceivedListener((response) => {
  const emailId = response.notification.request.content.data.emailId;
  if (emailId) {
    Navigation.toEmailDetail(emailId);
  }
});
```

**Check Navigation Implementation:**
File: `apps/mobile/src/navigation/AppNavigator.tsx`
```typescript
toEmailDetail: (emailId: string) => {
  router.push(`/emails/${emailId}`);
}
```

## Performance Benchmarks

Expected timing for each step:

| Step | Target | Acceptable | Action Needed |
|------|--------|------------|---------------|
| Webhook Received | < 5s | < 10s | Check provider subscription |
| Email Synced | < 5s | < 10s | Optimize sync service |
| Push Sent | < 1s | < 3s | Check Expo API |
| Device Displayed | < 2s | < 5s | Check device/network |
| **Total (Email → Notification)** | **< 10s** | **< 15s** | Review full pipeline |

## Next Steps

After successful E2E testing:

1. **Test Priority Filtering**
   - Run `node scripts/test-notification-preferences.js` (if exists)
   - Send low-priority email with priority-only mode enabled
   - Verify notification NOT sent
   - Send high-priority email
   - Verify notification IS sent

2. **Test Do-Not-Disturb**
   - Configure DND hours
   - Send email during DND period
   - Verify notification suppressed
   - Send email outside DND period
   - Verify notification sent

3. **Test Multiple Devices**
   - Register multiple devices
   - Send test email
   - Verify notification on all devices

4. **Performance Testing**
   - Send multiple emails rapidly
   - Verify all notifications delivered
   - Check for rate limiting issues

5. **Error Recovery**
   - Disconnect device from internet
   - Send email
   - Reconnect device
   - Verify notification eventually delivered (if FCM/APNS handles queuing)

## Documentation Links

- [Gmail Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Microsoft Graph Webhooks](https://learn.microsoft.com/graph/webhooks)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Prisma Client](https://www.prisma.io/docs/concepts/components/prisma-client)

## Support

If you encounter issues not covered in this guide:

1. Check application logs
2. Review error messages carefully
3. Search documentation for specific error codes
4. Check GitHub issues for similar problems
5. Ask for help with detailed error information
