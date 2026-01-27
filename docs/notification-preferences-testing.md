# Notification Preferences Testing Guide

This guide explains how to test notification preference filtering to ensure users receive only the notifications they want based on their configured preferences.

## Overview

The notification preferences system allows users to control which emails trigger push notifications through three main settings:

1. **Notification Enabled/Disabled** - Master toggle for all notifications
2. **Priority-Only Mode** - Only send notifications for high-priority emails (priority ≤ 3)
3. **Do-Not-Disturb Hours** - Block notifications during specified time ranges

## Filtering Logic

The filtering logic is implemented in `apps/web/src/lib/email/sync.ts` in the `sendPushNotificationForNewEmail` method:

```typescript
// 1. Check if notifications are enabled
if (!preferences || !preferences.notificationEnabled) {
  return; // No notification sent
}

// 2. Check priority-only mode
if (preferences.priorityOnly) {
  const isHighPriority = savedEmail.priority && savedEmail.priority <= 3;
  if (!isHighPriority) {
    return; // No notification sent for low-priority emails
  }
}

// 3. Check do-not-disturb hours
if (preferences.doNotDisturbStart && preferences.doNotDisturbEnd) {
  if (this.isInDoNotDisturbHours(start, end)) {
    return; // No notification sent during DND hours
  }
}

// If all checks pass, send notification
```

## Email Priority Scale

The AI categorizes emails on a scale of 1-5:

- **Priority 1-3**: High priority (important emails, urgent messages)
  - Personal emails from known contacts
  - Emails with urgent keywords
  - Calendar invites
  - Direct messages

- **Priority 4-5**: Low priority (can be filtered in priority-only mode)
  - Newsletters
  - Promotional emails
  - Marketing content
  - Automated notifications

## Testing Scenarios

### Scenario 1: Notifications Disabled

**Setup:**
```javascript
{
  notificationEnabled: false,
  priorityOnly: false,
  doNotDisturbStart: null,
  doNotDisturbEnd: null
}
```

**Test:**
1. Send any test email
2. Verify NO notification received

**Expected Result:** ❌ No notification sent (correct)

---

### Scenario 2: Priority-Only Mode - Low Priority Email

**Setup:**
```javascript
{
  notificationEnabled: true,
  priorityOnly: true,
  doNotDisturbStart: null,
  doNotDisturbEnd: null
}
```

**Test:**
1. Send low-priority email (e.g., newsletter with subject "[Test] Newsletter")
2. Verify NO notification received

**Expected Result:** ❌ No notification sent (correct - filtered by priority)

**Tips for sending low-priority emails:**
- Use newsletter-like subjects
- Include words like "newsletter", "promotion", "sale"
- Send from a marketing-like email address

---

### Scenario 3: Priority-Only Mode - High Priority Email

**Setup:**
```javascript
{
  notificationEnabled: true,
  priorityOnly: true,
  doNotDisturbStart: null,
  doNotDisturbEnd: null
}
```

**Test:**
1. Send high-priority email (e.g., "URGENT: Test Message")
2. Verify notification IS received

**Expected Result:** ✅ Notification sent (correct - high priority allowed)

**Tips for sending high-priority emails:**
- Use urgent keywords: "URGENT", "IMPORTANT", "ACTION REQUIRED"
- Send from a personal email address
- Use a direct, personal tone

---

### Scenario 4: Do-Not-Disturb Hours

**Setup:**
```javascript
{
  notificationEnabled: true,
  priorityOnly: false,
  doNotDisturbStart: "HH:MM", // Current time - 30 minutes
  doNotDisturbEnd: "HH:MM",    // Current time + 30 minutes
}
```

**Test:**
1. Configure DND hours to include current time
2. Send any test email
3. Verify NO notification received

**Expected Result:** ❌ No notification sent (correct - in DND hours)

---

### Scenario 5: All Emails Mode

**Setup:**
```javascript
{
  notificationEnabled: true,
  priorityOnly: false,
  doNotDisturbStart: null,
  doNotDisturbEnd: null
}
```

**Test:**
1. Send any test email (any priority)
2. Verify notification IS received

**Expected Result:** ✅ Notification sent (correct - all emails allowed)

---

### Scenario 6: Overnight Do-Not-Disturb

**Setup:**
```javascript
{
  notificationEnabled: true,
  priorityOnly: false,
  doNotDisturbStart: "22:00",
  doNotDisturbEnd: "08:00"
}
```

**Logic:**
- If start time > end time, range wraps around midnight
- Current time is checked against either side of midnight

**Test Cases:**
| Current Time | In DND? | Notifications |
|-------------|---------|---------------|
| 21:30       | No      | ✅ Sent       |
| 22:00       | Yes     | ❌ Blocked    |
| 23:59       | Yes     | ❌ Blocked    |
| 00:30       | Yes     | ❌ Blocked    |
| 07:59       | Yes     | ❌ Blocked    |
| 08:00       | No      | ✅ Sent       |
| 08:01       | No      | ✅ Sent       |

## Automated Test Script

We provide a comprehensive test script that guides you through all scenarios:

```bash
node scripts/test-notification-preferences.js
```

### What the Script Does

1. **Finds connected email account** - Identifies your test account
2. **Checks push subscriptions** - Verifies devices are registered
3. **Runs 6 test scenarios:**
   - Test 1: Notifications disabled
   - Test 2: Priority-only with low-priority email
   - Test 3: Priority-only with high-priority email
   - Test 4: Do-not-disturb hours
   - Test 5: All emails mode
   - Test 6: Overnight DND logic verification

4. **Guides through verification:**
   - Updates database preferences for each test
   - Prompts you to send test emails
   - Asks you to verify notification behavior
   - Tracks pass/fail results

5. **Generates test report:**
   - Shows which tests passed/failed
   - Provides troubleshooting guidance
   - Links to relevant documentation

### Prerequisites

Before running the test script:

- [x] Connected email account (Gmail or Outlook)
- [x] Mobile device registered with push token (optional but recommended)
- [x] Database accessible
- [x] Development server running (`pnpm dev`)
- [x] Gmail Pub/Sub or Outlook subscriptions active

### Running the Test

```bash
# Navigate to project root
cd /path/to/project

# Ensure dependencies are installed
pnpm install

# Run the test script
node scripts/test-notification-preferences.js
```

### Expected Output

```
🧪 Notification Preferences Filtering Test Suite
================================================

Setup: Find Connected Email Account
====================================================================================

✓ Found connected email account:
  Email: user@example.com
  Provider: google
  User ID: abc123
  Account ID: xyz789

📱 Push Subscriptions: 1 active device(s)
✓ Push notifications will be sent to registered devices

...

Test Summary
====================================================================================

Tests Passed: 6/6

✅ PASS - Test 1: Notifications Disabled
✅ PASS - Test 2: Priority-Only (Low Priority)
✅ PASS - Test 3: Priority-Only (High Priority)
✅ PASS - Test 4: Do-Not-Disturb Hours
✅ PASS - Test 5: All Emails Mode
✅ PASS - Test 6: Overnight DND Logic

🎉 All tests passed! Notification preferences filtering works correctly.
```

## Manual Testing (Without Script)

If you prefer to test manually without the script:

### 1. Set Preferences via API

```bash
# Disable notifications
curl -X POST http://localhost:3000/api/notifications/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "emailAccountId": "your-account-id",
    "notificationEnabled": false
  }'

# Enable priority-only mode
curl -X POST http://localhost:3000/api/notifications/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "emailAccountId": "your-account-id",
    "notificationEnabled": true,
    "priorityOnly": true
  }'

# Set DND hours
curl -X POST http://localhost:3000/api/notifications/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "emailAccountId": "your-account-id",
    "notificationEnabled": true,
    "priorityOnly": false,
    "doNotDisturbStart": "22:00",
    "doNotDisturbEnd": "08:00"
  }'
```

### 2. Check Current Preferences

```bash
curl http://localhost:3000/api/notifications/preferences
```

### 3. Send Test Emails

- Low priority: Newsletter-style email
- High priority: Email with "URGENT" in subject
- Any email: Regular message

### 4. Verify Behavior

- Check mobile device for notifications
- Check database WebhookLog table
- Check email sync in database
- Review server logs

## Troubleshooting

### No Notifications Received (When Expected)

**Check Push Subscriptions:**
```sql
SELECT * FROM "PushSubscription"
WHERE "userId" = 'your-user-id'
AND active = true;
```

**Check Notification Preferences:**
```sql
SELECT * FROM "NotificationPreference"
WHERE "userId" = 'your-user-id';
```

**Check Webhook Logs:**
```sql
SELECT * FROM "WebhookLog"
ORDER BY "createdAt" DESC
LIMIT 10;
```

**Check Email Sync:**
```sql
SELECT * FROM "Email"
WHERE "accountId" = 'your-account-id'
ORDER BY "receivedAt" DESC
LIMIT 5;
```

### Notifications Received (When Not Expected)

1. **Verify preferences are saved:**
   ```bash
   curl http://localhost:3000/api/notifications/preferences
   ```

2. **Check email priority in database:**
   ```sql
   SELECT id, subject, priority, category
   FROM "Email"
   WHERE "accountId" = 'your-account-id'
   ORDER BY "receivedAt" DESC
   LIMIT 1;
   ```

3. **Verify DND time calculation:**
   - Check server timezone
   - Verify time format (HH:MM)
   - Test with explicit times

### Email Not Syncing

1. **Check webhook is receiving notifications:**
   ```sql
   SELECT * FROM "WebhookLog"
   ORDER BY "createdAt" DESC
   LIMIT 1;
   ```

2. **Verify Gmail Pub/Sub or Outlook subscription is active:**
   ```bash
   # Gmail
   node scripts/test-gmail-watch.js

   # Outlook
   node scripts/test-outlook-subscription.js
   ```

3. **Check server logs for sync errors**

## Database Queries for Testing

### View All Preferences

```sql
SELECT
  u.email as user_email,
  ea.emailAddress as account_email,
  np.notificationEnabled,
  np.priorityOnly,
  np.doNotDisturbStart,
  np.doNotDisturbEnd
FROM "NotificationPreference" np
JOIN "User" u ON np."userId" = u.id
JOIN "EmailAccount" ea ON np."emailAccountId" = ea.id;
```

### View Recent Emails with Priority

```sql
SELECT
  subject,
  sender,
  priority,
  category,
  "receivedAt",
  "createdAt"
FROM "Email"
WHERE "accountId" = 'your-account-id'
ORDER BY "receivedAt" DESC
LIMIT 10;
```

### View Push Subscriptions

```sql
SELECT
  u.email,
  ps.platform,
  ps.active,
  ps."createdAt",
  ps."updatedAt"
FROM "PushSubscription" ps
JOIN "User" u ON ps."userId" = u.id
WHERE ps.active = true;
```

### View Recent Webhook Activity

```sql
SELECT
  endpoint,
  "statusCode",
  "createdAt",
  error
FROM "WebhookLog"
ORDER BY "createdAt" DESC
LIMIT 20;
```

## Performance Expectations

| Stage | Expected Time |
|-------|---------------|
| Email sent | 0s |
| Webhook receives notification | < 10s |
| Email synced to database | < 15s |
| Push notification sent to device | < 20s |
| Notification appears on device | < 25s |

Total end-to-end time: **Under 30 seconds** from email sent to notification displayed

## Integration with Mobile App

The mobile app settings UI allows users to configure preferences:

```typescript
// In apps/mobile/app/(tabs)/settings.tsx
<Switch
  value={notificationsEnabled}
  onValueChange={handleNotificationToggle}
/>

<Switch
  value={priorityOnly}
  onValueChange={handlePriorityOnlyToggle}
/>

<TimePicker
  value={doNotDisturbStart}
  onChange={handleDNDStartChange}
/>
```

When users toggle these settings, the mobile app calls:
```
POST /api/notifications/preferences
```

## Next Steps

After verifying preference filtering works:

1. **Test on multiple devices** - iOS and Android
2. **Test with multiple email accounts** - Different preferences per account
3. **Test edge cases** - Midnight DND transitions, timezone changes
4. **Load testing** - Multiple emails arriving simultaneously
5. **Monitor in production** - Track notification delivery rates

## Related Documentation

- [E2E Notification Testing](./e2e-notification-testing.md) - Full flow testing
- [Gmail Pub/Sub Setup](./gmail-pubsub-setup.md) - Gmail configuration
- [Outlook Subscriptions Setup](./outlook-subscriptions-setup.md) - Outlook configuration
- [Scripts README](../scripts/README.md) - All test scripts

## Reference Implementation

The preference filtering logic is implemented in:
- **Backend:** `apps/web/src/lib/email/sync.ts` (lines 405-471)
- **API:** `apps/web/src/app/api/notifications/preferences/route.ts`
- **Mobile:** `apps/mobile/app/(tabs)/settings.tsx`
- **Database:** `packages/database/prisma/schema.prisma` (NotificationPreference model)
