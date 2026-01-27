#!/usr/bin/env node

/**
 * End-to-End Notification Flow Test
 * Tests the complete flow from email arrival to push notification delivery
 *
 * This script:
 * 1. Verifies backend setup (webhooks, database, notification preferences)
 * 2. Guides user through sending test email
 * 3. Monitors webhook logs for incoming notification
 * 4. Verifies email sync to database
 * 5. Verifies push notification API calls
 * 6. Provides instructions for mobile device verification
 * 7. Guides through notification tap and navigation test
 *
 * Prerequisites:
 * - Gmail Pub/Sub or Outlook Graph subscription active
 * - Mobile device registered with push token
 * - Notification preferences configured
 * - Development server running (pnpm dev)
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

// Load environment variables
require('dotenv').config();

const prisma = new PrismaClient();

// Configure readline for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Promisified readline question
 */
function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print section header
 */
function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60) + '\n');
}

/**
 * Print step with emoji
 */
function printStep(emoji, text) {
  console.log(`${emoji} ${text}`);
}

/**
 * Main test flow
 */
async function testE2ENotificationFlow() {
  console.log('\n🧪 End-to-End Notification Flow Test');
  console.log('=====================================\n');

  try {
    // STEP 1: Verify prerequisites
    printHeader('STEP 1: Verifying Prerequisites');

    // Check environment variables
    printStep('🔍', 'Checking environment configuration...');
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    console.log(`   Webhook Base URL: ${webhookBaseUrl}`);

    // Find test user with connected email account
    printStep('🔍', 'Finding test email account...');
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        accessToken: { not: null },
      },
      include: {
        user: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!emailAccount) {
      console.error('\n❌ No connected email account found');
      console.error('   Please connect a Gmail or Outlook account in the app first\n');
      process.exit(1);
    }

    printStep('✅', `Found email account: ${emailAccount.emailAddress}`);
    console.log(`   Provider: ${emailAccount.provider}`);
    console.log(`   User: ${emailAccount.user.email}\n`);

    // Check notification preferences
    printStep('🔍', 'Checking notification preferences...');
    const notificationPref = await prisma.notificationPreference.findFirst({
      where: {
        userId: emailAccount.userId,
        emailAccountId: emailAccount.id,
      },
    });

    if (!notificationPref) {
      console.error('\n❌ No notification preferences found');
      console.error('   Please configure notification preferences in the app settings\n');
      console.error('   You can create preferences by:');
      console.error('   1. Opening the mobile app or web app');
      console.error('   2. Going to Settings → Notifications');
      console.error('   3. Enabling push notifications\n');
      process.exit(1);
    }

    printStep('✅', 'Notification preferences configured');
    console.log(`   Enabled: ${notificationPref.notificationEnabled ? 'Yes' : 'No'}`);
    console.log(`   Priority Only: ${notificationPref.priorityOnly ? 'Yes' : 'No'}`);
    if (notificationPref.doNotDisturbStart && notificationPref.doNotDisturbEnd) {
      console.log(`   DND Hours: ${notificationPref.doNotDisturbStart} - ${notificationPref.doNotDisturbEnd}`);
    }
    console.log();

    if (!notificationPref.notificationEnabled) {
      console.error('❌ Notifications are disabled for this account');
      console.error('   Please enable notifications in app settings\n');
      process.exit(1);
    }

    // Check push subscriptions
    printStep('🔍', 'Checking push subscriptions...');
    const pushSubscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: emailAccount.userId,
        active: true,
      },
    });

    if (pushSubscriptions.length === 0) {
      console.error('\n❌ No active push subscriptions found');
      console.error('   Please register a device for push notifications\n');
      console.error('   You can register by:');
      console.error('   1. Opening the mobile app');
      console.error('   2. Going to Settings');
      console.error('   3. Enabling "Push Notifications" toggle\n');
      process.exit(1);
    }

    printStep('✅', `Found ${pushSubscriptions.length} active push subscription(s)`);
    pushSubscriptions.forEach((sub, i) => {
      console.log(`   Device ${i + 1}: ${sub.platform} (${sub.expoToken ? 'Expo' : 'Native'})`);
    });
    console.log();

    // STEP 2: Guide user to send test email
    printHeader('STEP 2: Send Test Email');

    console.log('📧 Please send a test email to trigger the notification flow:\n');
    console.log(`   To: ${emailAccount.emailAddress}`);
    console.log(`   Subject: [TEST] E2E Notification Flow Test`);
    console.log(`   Body: This is a test email for the E2E notification flow.\n`);

    if (notificationPref.priorityOnly) {
      console.log('⚠️  Note: Priority-only mode is enabled.');
      console.log('   Make sure your test email will be classified as high priority.');
      console.log('   Use keywords like "urgent", "important", or send from important sender.\n');
    }

    const ready = await ask('Press ENTER when you have sent the test email...');

    // STEP 3: Monitor for webhook notification
    printHeader('STEP 3: Monitoring Webhook Logs');

    printStep('⏳', 'Waiting for webhook notification (timeout: 30 seconds)...');
    console.log('   Checking every 2 seconds...\n');

    const startTime = Date.now();
    const timeout = 30000; // 30 seconds
    let webhookLog = null;

    while (Date.now() - startTime < timeout) {
      // Find recent webhook logs
      const recentLogs = await prisma.webhookLog.findMany({
        where: {
          createdAt: {
            gte: new Date(startTime),
          },
          endpoint: {
            in: ['/api/webhooks/gmail', '/api/webhooks/outlook'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      if (recentLogs.length > 0) {
        webhookLog = recentLogs[0];
        break;
      }

      await sleep(2000); // Wait 2 seconds before next check
      process.stdout.write('.');
    }

    console.log('\n');

    if (!webhookLog) {
      console.error('❌ No webhook notification received within 30 seconds\n');
      console.error('📚 Troubleshooting:\n');

      if (emailAccount.provider === 'google') {
        console.error('   For Gmail:');
        console.error('   1. Verify Gmail Pub/Sub watch is active:');
        console.error('      node scripts/test-gmail-watch.js');
        console.error('   2. Check Gmail Pub/Sub topic has proper IAM permissions');
        console.error('   3. Verify webhook endpoint is publicly accessible');
        console.error('   4. Check Google Cloud Pub/Sub logs\n');
      } else if (emailAccount.provider === 'microsoft') {
        console.error('   For Outlook:');
        console.error('   1. Verify Microsoft Graph subscription is active:');
        console.error('      node scripts/test-outlook-subscription.js');
        console.error('   2. Check subscription hasn\'t expired (renew if needed)');
        console.error('   3. Verify webhook endpoint is publicly accessible via HTTPS');
        console.error('   4. Check Azure Portal → App Registrations → API permissions\n');
      }

      console.error('   General checks:');
      console.error('   - Ensure development server is running: pnpm dev');
      console.error('   - Check webhook is accessible: curl ' + webhookBaseUrl + '/api/webhooks/' + emailAccount.provider);
      console.error('   - Review application logs for errors\n');

      process.exit(1);
    }

    const webhookDelay = webhookLog.createdAt.getTime() - startTime;
    printStep('✅', `Webhook notification received in ${(webhookDelay / 1000).toFixed(1)} seconds`);
    console.log(`   Endpoint: ${webhookLog.endpoint}`);
    console.log(`   Status: ${webhookLog.statusCode || 'processing'}`);
    console.log(`   Response: ${webhookLog.response || 'pending'}\n`);

    // STEP 4: Verify email synced to database
    printHeader('STEP 4: Verifying Email Sync');

    printStep('⏳', 'Waiting for email to sync (timeout: 20 seconds)...');
    console.log('   Checking every 2 seconds...\n');

    const syncStartTime = Date.now();
    const syncTimeout = 20000; // 20 seconds
    let newEmail = null;

    while (Date.now() - syncStartTime < syncTimeout) {
      // Find recent emails
      const recentEmails = await prisma.email.findMany({
        where: {
          accountId: emailAccount.id,
          receivedAt: {
            gte: new Date(startTime - 60000), // 1 minute before test started
          },
        },
        orderBy: {
          receivedAt: 'desc',
        },
        take: 5,
      });

      // Look for test email by subject
      newEmail = recentEmails.find(
        (email) => email.subject && email.subject.includes('[TEST]')
      );

      if (newEmail) {
        break;
      }

      await sleep(2000); // Wait 2 seconds before next check
      process.stdout.write('.');
    }

    console.log('\n');

    if (!newEmail) {
      console.error('❌ Test email not found in database after sync\n');
      console.error('📚 Troubleshooting:\n');
      console.error('   - Check webhook log response for sync errors');
      console.error('   - Verify email account OAuth tokens are valid');
      console.error('   - Check application logs for sync service errors');
      console.error('   - Try manual sync: POST to /api/emails/sync\n');
      process.exit(1);
    }

    const syncDelay = newEmail.createdAt.getTime() - startTime;
    printStep('✅', `Email synced to database in ${(syncDelay / 1000).toFixed(1)} seconds`);
    console.log(`   Subject: ${newEmail.subject}`);
    console.log(`   From: ${newEmail.from}`);
    console.log(`   Message ID: ${newEmail.messageId}`);
    console.log(`   Priority: ${newEmail.priority || 'not set'}`);
    console.log(`   Category: ${newEmail.category || 'not set'}\n`);

    // Check priority filtering
    if (notificationPref.priorityOnly && newEmail.priority && newEmail.priority > 3) {
      console.error('⚠️  Warning: Email priority is ' + newEmail.priority + ' (low priority)');
      console.error('   Notification will NOT be sent because priority-only mode is enabled');
      console.error('   and this email is not high priority (priority > 3)\n');
      console.error('   To complete the test:');
      console.error('   1. Either disable priority-only mode');
      console.error('   2. Or send a high-priority email (urgent, important)\n');
      process.exit(1);
    }

    // STEP 5: Verify push notification sent
    printHeader('STEP 5: Verifying Push Notification');

    printStep('ℹ️', 'Note: Push notification sending happens during email sync');
    console.log('   The sync service automatically sends push notifications for new emails');
    console.log('   based on notification preferences and priority settings.\n');

    // We can't directly verify Expo Push API calls without intercepting requests
    // but we can verify the conditions are met
    printStep('✅', 'Push notification conditions verified:');
    console.log(`   ✓ Notifications enabled: ${notificationPref.notificationEnabled}`);
    console.log(`   ✓ Active push subscriptions: ${pushSubscriptions.length}`);
    console.log(`   ✓ New email received: ${newEmail.subject}`);

    if (notificationPref.priorityOnly) {
      const isPriority = newEmail.priority && newEmail.priority <= 3;
      console.log(`   ✓ Priority check: ${isPriority ? 'High priority' : 'Priority not set'}`);
    }

    // Check DND hours
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (notificationPref.doNotDisturbStart && notificationPref.doNotDisturbEnd) {
      const isInDND = isInDoNotDisturbHours(currentTime, notificationPref.doNotDisturbStart, notificationPref.doNotDisturbEnd);
      console.log(`   ${isInDND ? '⚠️' : '✓'} DND check: ${isInDND ? 'In DND hours (notification suppressed)' : 'Not in DND hours'}`);
    } else {
      console.log('   ✓ DND check: Not configured');
    }

    console.log('\n   If all conditions are met, push notification should be sent via Expo Push API');
    console.log('   to all registered devices.\n');

    // STEP 6: Mobile device verification
    printHeader('STEP 6: Mobile Device Verification');

    console.log('📱 Manual verification steps:\n');
    console.log('1. Check your mobile device for a push notification');
    console.log('   Expected notification:');
    console.log(`   Title: New email from ${newEmail.from?.split('<')[0].trim() || 'unknown'}`);
    console.log(`   Body: ${newEmail.subject}\n`);

    const notificationReceived = await ask('Did you receive the notification on your device? (y/n): ');

    if (notificationReceived.toLowerCase() !== 'y' && notificationReceived.toLowerCase() !== 'yes') {
      console.error('\n❌ Notification not received on device\n');
      console.error('📚 Troubleshooting:\n');
      console.error('   Mobile App:');
      console.error('   - Ensure app is built with expo-notifications package');
      console.error('   - Check notification permissions are granted');
      console.error('   - Verify device token is registered (check PushSubscription table)');
      console.error('   - Test on physical device (not simulator/emulator)\n');
      console.error('   Backend:');
      console.error('   - Check application logs for Expo Push API errors');
      console.error('   - Verify Expo tokens are valid (check expo.dev/push-receipts)');
      console.error('   - Ensure notification sending code is executed in sync service\n');
      console.error('   Expo:');
      console.error('   - Verify Expo project is configured correctly');
      console.error('   - Check Expo Push Notification tool: https://expo.dev/notifications');
      console.error('   - Review Expo push notification documentation\n');
      process.exit(1);
    }

    printStep('✅', 'Notification received on device!\n');

    // STEP 7: Navigation test
    printHeader('STEP 7: Navigation Test');

    console.log('📱 Tap notification navigation test:\n');
    console.log('1. Tap the notification on your device');
    console.log('2. The app should open and navigate to the email detail screen');
    console.log(`3. Verify the email displayed matches:\n`);
    console.log(`   Subject: ${newEmail.subject}`);
    console.log(`   From: ${newEmail.from}\n`);

    const navigationWorked = await ask('Did tapping the notification open the correct email? (y/n): ');

    if (navigationWorked.toLowerCase() !== 'y' && navigationWorked.toLowerCase() !== 'yes') {
      console.error('\n❌ Navigation not working correctly\n');
      console.error('📚 Troubleshooting:\n');
      console.error('   - Check notification tap handler in apps/mobile/app/_layout.tsx');
      console.error('   - Verify emailId is included in notification data');
      console.error('   - Check navigation implementation (Navigation.toEmailDetail)');
      console.error('   - Review Expo notification response listener setup');
      console.error('   - Check mobile app logs for errors\n');
      process.exit(1);
    }

    printStep('✅', 'Navigation working correctly!\n');

    // FINAL RESULT
    printHeader('🎉 END-TO-END TEST PASSED! 🎉');

    console.log('All verification steps completed successfully:\n');
    console.log('✅ Backend setup verified (webhooks, database, preferences)');
    console.log(`✅ Webhook received notification in ${(webhookDelay / 1000).toFixed(1)}s`);
    console.log(`✅ Email synced to database in ${(syncDelay / 1000).toFixed(1)}s`);
    console.log('✅ Push notification conditions met');
    console.log('✅ Notification received on mobile device');
    console.log('✅ Notification tap navigation working\n');

    console.log('📊 Test Summary:');
    console.log(`   Email Account: ${emailAccount.emailAddress}`);
    console.log(`   Provider: ${emailAccount.provider}`);
    console.log(`   Test Email: ${newEmail.subject}`);
    console.log(`   Total Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`   Webhook Delay: ${(webhookDelay / 1000).toFixed(1)}s`);
    console.log(`   Sync Delay: ${(syncDelay / 1000).toFixed(1)}s`);
    console.log(`   Push Subscriptions: ${pushSubscriptions.length}`);
    console.log(`   Notification Mode: ${notificationPref.priorityOnly ? 'Priority Only' : 'All Emails'}\n`);

    console.log('✨ The real-time push notification feature is working correctly!\n');

  } catch (error) {
    console.error('\n❌ Test Failed\n');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);

    if (error.stack) {
      console.error('\nStack Trace:');
      console.error(error.stack);
    }

    console.error('\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

/**
 * Check if current time is within do-not-disturb hours
 */
function isInDoNotDisturbHours(currentTime, startTime, endTime) {
  if (!startTime || !endTime) {
    return false;
  }

  const current = timeToMinutes(currentTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  // Handle overnight range (e.g., 22:00 to 08:00)
  if (start > end) {
    return current >= start || current <= end;
  }

  // Handle same-day range (e.g., 08:00 to 22:00)
  return current >= start && current <= end;
}

/**
 * Convert HH:MM time string to minutes since midnight
 */
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Run the test
testE2ENotificationFlow().catch(console.error);
