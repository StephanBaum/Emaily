#!/usr/bin/env node

/**
 * Notification Preferences Filtering Test
 * Tests all notification preference modes and filtering logic
 *
 * This script tests:
 * 1. Notifications disabled - should not send
 * 2. Priority-only mode with low-priority email - should not send
 * 3. Priority-only mode with high-priority email - should send
 * 4. Do-not-disturb hours - should not send
 * 5. All emails mode - should send all
 *
 * Prerequisites:
 * - Connected email account (Gmail or Outlook)
 * - Mobile device registered with push token (optional, for manual verification)
 * - Database accessible
 * - Development server running (pnpm dev) if testing actual notifications
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
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Print test result
 */
function printResult(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${testName}`);
  if (details) {
    console.log(`       ${details}`);
  }
}

/**
 * Get current time in HH:MM format
 */
function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Add minutes to HH:MM time string
 */
function addMinutes(timeStr, minutesToAdd) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

/**
 * Check if time is in DND hours (same logic as sync.ts)
 */
function isInDoNotDisturbHours(startTime, endTime) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startTimeInMinutes = startHour * 60 + startMinute;

  const [endHour, endMinute] = endTime.split(':').map(Number);
  const endTimeInMinutes = endHour * 60 + endMinute;

  // Handle overnight DND (e.g., 22:00 to 08:00)
  if (startTimeInMinutes > endTimeInMinutes) {
    return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
  }

  // Normal DND range
  return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
}

/**
 * Test 1: Verify notifications disabled prevents sending
 */
async function testNotificationsDisabled(emailAccountId, userId) {
  printHeader('Test 1: Notifications Disabled');

  // Update preferences to disable notifications
  await prisma.notificationPreference.upsert({
    where: {
      userId_emailAccountId: {
        userId,
        emailAccountId,
      },
    },
    create: {
      userId,
      emailAccountId,
      notificationEnabled: false,
      priorityOnly: false,
    },
    update: {
      notificationEnabled: false,
      priorityOnly: false,
      doNotDisturbStart: null,
      doNotDisturbEnd: null,
    },
  });

  console.log('✓ Set notificationEnabled = false');
  console.log('\nTest Configuration:');
  console.log('  - notificationEnabled: false');
  console.log('  - priorityOnly: false');
  console.log('  - doNotDisturbStart: null');
  console.log('  - doNotDisturbEnd: null');

  console.log('\n📧 Verification Instructions:');
  console.log('  1. Send a test email to your connected account');
  console.log('  2. Wait 15-20 seconds for sync to complete');
  console.log('  3. Check your mobile device - you should NOT receive a notification');
  console.log('  4. This is correct behavior when notifications are disabled\n');

  const response = await ask('Did you receive a notification? (yes/no): ');
  const passed = response.toLowerCase() === 'no' || response.toLowerCase() === 'n';

  printResult(
    'Notifications disabled',
    passed,
    passed ? 'No notification sent (correct)' : 'ERROR: Notification was sent when disabled'
  );

  return passed;
}

/**
 * Test 2: Verify priority-only mode filters low-priority emails
 */
async function testPriorityOnlyLowPriority(emailAccountId, userId) {
  printHeader('Test 2: Priority-Only Mode - Low Priority Email');

  // Update preferences to priority-only mode
  await prisma.notificationPreference.upsert({
    where: {
      userId_emailAccountId: {
        userId,
        emailAccountId,
      },
    },
    create: {
      userId,
      emailAccountId,
      notificationEnabled: true,
      priorityOnly: true,
    },
    update: {
      notificationEnabled: true,
      priorityOnly: true,
      doNotDisturbStart: null,
      doNotDisturbEnd: null,
    },
  });

  console.log('✓ Set notificationEnabled = true, priorityOnly = true');
  console.log('\nTest Configuration:');
  console.log('  - notificationEnabled: true');
  console.log('  - priorityOnly: true');
  console.log('  - doNotDisturbStart: null');
  console.log('  - doNotDisturbEnd: null');

  console.log('\n📧 Verification Instructions:');
  console.log('  1. Send a LOW-PRIORITY test email (e.g., newsletter, promotional)');
  console.log('     Subject suggestion: "[Test] Newsletter - Low Priority"');
  console.log('  2. Wait 15-20 seconds for sync to complete');
  console.log('  3. Check your mobile device - you should NOT receive a notification');
  console.log('  4. This is correct because priority-only mode filters out low-priority emails');
  console.log('\n  Note: AI assigns priority 4-5 to newsletters/promotions (low priority)');
  console.log('        Priority 1-3 is considered high priority\n');

  const response = await ask('Did you receive a notification for the low-priority email? (yes/no): ');
  const passed = response.toLowerCase() === 'no' || response.toLowerCase() === 'n';

  printResult(
    'Priority-only filters low-priority emails',
    passed,
    passed ? 'No notification sent for low-priority email (correct)' : 'ERROR: Notification sent for low-priority email'
  );

  return passed;
}

/**
 * Test 3: Verify priority-only mode allows high-priority emails
 */
async function testPriorityOnlyHighPriority(emailAccountId, userId) {
  printHeader('Test 3: Priority-Only Mode - High Priority Email');

  // Preferences should already be set from previous test
  console.log('✓ Using existing priority-only configuration');
  console.log('\nTest Configuration:');
  console.log('  - notificationEnabled: true');
  console.log('  - priorityOnly: true');
  console.log('  - doNotDisturbStart: null');
  console.log('  - doNotDisturbEnd: null');

  console.log('\n📧 Verification Instructions:');
  console.log('  1. Send a HIGH-PRIORITY test email (e.g., from important contact)');
  console.log('     Subject suggestion: "URGENT: Test - High Priority"');
  console.log('  2. Wait 15-20 seconds for sync to complete');
  console.log('  3. Check your mobile device - you SHOULD receive a notification');
  console.log('  4. This is correct because priority-only mode allows high-priority emails');
  console.log('\n  Note: AI assigns priority 1-3 to important emails (high priority)');
  console.log('        Include words like "urgent", "important" to help AI categorize\n');

  const response = await ask('Did you receive a notification for the high-priority email? (yes/no): ');
  const passed = response.toLowerCase() === 'yes' || response.toLowerCase() === 'y';

  printResult(
    'Priority-only allows high-priority emails',
    passed,
    passed ? 'Notification sent for high-priority email (correct)' : 'ERROR: No notification for high-priority email'
  );

  return passed;
}

/**
 * Test 4: Verify do-not-disturb hours prevent notifications
 */
async function testDoNotDisturbHours(emailAccountId, userId) {
  printHeader('Test 4: Do-Not-Disturb Hours');

  // Set DND hours to current time +/- 30 minutes (so we're in DND period)
  const currentTime = getCurrentTime();
  const dndStart = addMinutes(currentTime, -30);
  const dndEnd = addMinutes(currentTime, 30);

  await prisma.notificationPreference.upsert({
    where: {
      userId_emailAccountId: {
        userId,
        emailAccountId,
      },
    },
    create: {
      userId,
      emailAccountId,
      notificationEnabled: true,
      priorityOnly: false,
      doNotDisturbStart: dndStart,
      doNotDisturbEnd: dndEnd,
    },
    update: {
      notificationEnabled: true,
      priorityOnly: false,
      doNotDisturbStart: dndStart,
      doNotDisturbEnd: dndEnd,
    },
  });

  // Verify we're actually in DND hours
  const inDND = isInDoNotDisturbHours(dndStart, dndEnd);

  console.log('✓ Set do-not-disturb hours');
  console.log('\nTest Configuration:');
  console.log('  - notificationEnabled: true');
  console.log('  - priorityOnly: false');
  console.log(`  - doNotDisturbStart: ${dndStart}`);
  console.log(`  - doNotDisturbEnd: ${dndEnd}`);
  console.log(`  - Current time: ${currentTime}`);
  console.log(`  - In DND hours: ${inDND ? 'Yes ✓' : 'No ✗'}`);

  if (!inDND) {
    console.log('\n⚠️  WARNING: Current time is not in DND range!');
    console.log('This test may not work correctly. Consider adjusting the times.');
  }

  console.log('\n📧 Verification Instructions:');
  console.log('  1. Send a test email to your connected account');
  console.log('  2. Wait 15-20 seconds for sync to complete');
  console.log('  3. Check your mobile device - you should NOT receive a notification');
  console.log('  4. This is correct because current time is in do-not-disturb hours\n');

  const response = await ask('Did you receive a notification during DND hours? (yes/no): ');
  const passed = response.toLowerCase() === 'no' || response.toLowerCase() === 'n';

  printResult(
    'Do-not-disturb hours prevent notifications',
    passed,
    passed ? 'No notification sent during DND hours (correct)' : 'ERROR: Notification sent during DND hours'
  );

  return passed;
}

/**
 * Test 5: Verify all emails mode sends all notifications
 */
async function testAllEmailsMode(emailAccountId, userId) {
  printHeader('Test 5: All Emails Mode');

  // Set preferences to send all emails (no filtering)
  await prisma.notificationPreference.upsert({
    where: {
      userId_emailAccountId: {
        userId,
        emailAccountId,
      },
    },
    create: {
      userId,
      emailAccountId,
      notificationEnabled: true,
      priorityOnly: false,
    },
    update: {
      notificationEnabled: true,
      priorityOnly: false,
      doNotDisturbStart: null,
      doNotDisturbEnd: null,
    },
  });

  console.log('✓ Set all emails mode (no filtering)');
  console.log('\nTest Configuration:');
  console.log('  - notificationEnabled: true');
  console.log('  - priorityOnly: false');
  console.log('  - doNotDisturbStart: null');
  console.log('  - doNotDisturbEnd: null');

  console.log('\n📧 Verification Instructions:');
  console.log('  1. Send ANY test email to your connected account');
  console.log('     (can be low priority, high priority, any type)');
  console.log('  2. Wait 15-20 seconds for sync to complete');
  console.log('  3. Check your mobile device - you SHOULD receive a notification');
  console.log('  4. This is correct because all emails mode sends notifications for all emails\n');

  const response = await ask('Did you receive a notification? (yes/no): ');
  const passed = response.toLowerCase() === 'yes' || response.toLowerCase() === 'y';

  printResult(
    'All emails mode sends all notifications',
    passed,
    passed ? 'Notification sent for all emails (correct)' : 'ERROR: No notification in all emails mode'
  );

  return passed;
}

/**
 * Test 6: Verify overnight DND hours (e.g., 22:00 to 08:00)
 */
async function testOvernightDND(emailAccountId, userId) {
  printHeader('Test 6: Overnight Do-Not-Disturb Hours');

  // This test is informational - shows how overnight DND works
  console.log('This test demonstrates overnight DND hours (e.g., 22:00 to 08:00)');
  console.log('\nOvernight DND Logic:');
  console.log('  - If start time > end time, range wraps around midnight');
  console.log('  - Example: 22:00 to 08:00 means notifications blocked from 10PM to 8AM');
  console.log('  - Current time is checked against either side of midnight');

  console.log('\n📋 Testing Scenarios:');
  console.log('  Scenario 1: DND 22:00 - 08:00');
  console.log('    - 21:30: Not in DND ✓');
  console.log('    - 22:00: In DND (no notifications)');
  console.log('    - 23:59: In DND (no notifications)');
  console.log('    - 00:30: In DND (no notifications)');
  console.log('    - 07:59: In DND (no notifications)');
  console.log('    - 08:00: Not in DND ✓');
  console.log('    - 08:01: Not in DND ✓');

  // Test the logic with sample times
  const testCases = [
    { start: '22:00', end: '08:00', testTime: { hour: 21, minute: 30 }, expected: false },
    { start: '22:00', end: '08:00', testTime: { hour: 22, minute: 0 }, expected: true },
    { start: '22:00', end: '08:00', testTime: { hour: 23, minute: 59 }, expected: true },
    { start: '22:00', end: '08:00', testTime: { hour: 0, minute: 30 }, expected: true },
    { start: '22:00', end: '08:00', testTime: { hour: 7, minute: 59 }, expected: true },
    { start: '22:00', end: '08:00', testTime: { hour: 8, minute: 0 }, expected: false },
  ];

  console.log('\n🔍 Logic Verification:');
  let allPassed = true;
  for (const tc of testCases) {
    const testTimeStr = `${String(tc.testTime.hour).padStart(2, '0')}:${String(tc.testTime.minute).padStart(2, '0')}`;

    // Manually calculate using same logic as isInDoNotDisturbHours
    const currentTimeInMinutes = tc.testTime.hour * 60 + tc.testTime.minute;
    const [startHour, startMinute] = tc.start.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const [endHour, endMinute] = tc.end.split(':').map(Number);
    const endTimeInMinutes = endHour * 60 + endMinute;

    let inDND;
    if (startTimeInMinutes > endTimeInMinutes) {
      inDND = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    } else {
      inDND = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    }

    const passed = inDND === tc.expected;
    allPassed = allPassed && passed;

    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${testTimeStr}: ${inDND ? 'In DND' : 'Not in DND'} (expected: ${tc.expected ? 'In DND' : 'Not in DND'})`);
  }

  printResult(
    'Overnight DND logic verification',
    allPassed,
    allPassed ? 'All test cases passed' : 'Some test cases failed'
  );

  console.log('\n💡 To manually test overnight DND:');
  console.log('  1. Set DND hours that include current time (e.g., 2 hours before to 2 hours after)');
  console.log('  2. Send test email - should NOT receive notification');
  console.log('  3. Wait for DND period to end');
  console.log('  4. Send another test email - should receive notification');

  return allPassed;
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('🧪 Notification Preferences Filtering Test Suite');
    console.log('================================================\n');

    // Step 1: Find connected email account
    printHeader('Setup: Find Connected Email Account');

    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        accessToken: { not: null },
      },
      include: {
        user: true,
      },
    });

    if (!emailAccount) {
      console.error('❌ No connected email account found.');
      console.error('Please connect a Gmail or Outlook account first.');
      process.exit(1);
    }

    console.log('✓ Found connected email account:');
    console.log(`  Email: ${emailAccount.emailAddress}`);
    console.log(`  Provider: ${emailAccount.provider}`);
    console.log(`  User ID: ${emailAccount.userId}`);
    console.log(`  Account ID: ${emailAccount.id}`);

    const userId = emailAccount.userId;
    const emailAccountId = emailAccount.id;

    // Step 2: Check if push subscriptions exist (optional)
    const pushSubscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId,
        active: true,
      },
    });

    console.log(`\n📱 Push Subscriptions: ${pushSubscriptions.length} active device(s)`);
    if (pushSubscriptions.length === 0) {
      console.log('⚠️  Warning: No active push subscriptions found.');
      console.log('   You can still run tests, but notifications won\'t be sent to devices.');
      console.log('   Register a device first for complete end-to-end testing.');
    } else {
      console.log('✓ Push notifications will be sent to registered devices');
    }

    // Confirm to proceed
    console.log('\n⚠️  Important Notes:');
    console.log('  - Make sure development server is running (pnpm dev)');
    console.log('  - Gmail Pub/Sub or Outlook subscriptions should be active');
    console.log('  - Have access to the email account to send test emails');
    console.log('  - Each test will modify notification preferences');
    console.log('  - You\'ll need to send test emails and verify on mobile device');

    const proceed = await ask('\nReady to start tests? (yes/no): ');
    if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
      console.log('\nTests cancelled.');
      process.exit(0);
    }

    // Run all tests
    const results = {
      test1: false,
      test2: false,
      test3: false,
      test4: false,
      test5: false,
      test6: false,
    };

    // Test 1: Notifications disabled
    results.test1 = await testNotificationsDisabled(emailAccountId, userId);
    await sleep(2000);

    // Test 2: Priority-only with low-priority email
    results.test2 = await testPriorityOnlyLowPriority(emailAccountId, userId);
    await sleep(2000);

    // Test 3: Priority-only with high-priority email
    results.test3 = await testPriorityOnlyHighPriority(emailAccountId, userId);
    await sleep(2000);

    // Test 4: Do-not-disturb hours
    results.test4 = await testDoNotDisturbHours(emailAccountId, userId);
    await sleep(2000);

    // Test 5: All emails mode
    results.test5 = await testAllEmailsMode(emailAccountId, userId);
    await sleep(2000);

    // Test 6: Overnight DND (logic verification)
    results.test6 = await testOvernightDND(emailAccountId, userId);

    // Print summary
    printHeader('Test Summary');

    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    console.log(`Tests Passed: ${passedCount}/${totalCount}\n`);

    printResult('Test 1: Notifications Disabled', results.test1);
    printResult('Test 2: Priority-Only (Low Priority)', results.test2);
    printResult('Test 3: Priority-Only (High Priority)', results.test3);
    printResult('Test 4: Do-Not-Disturb Hours', results.test4);
    printResult('Test 5: All Emails Mode', results.test5);
    printResult('Test 6: Overnight DND Logic', results.test6);

    console.log('\n' + '='.repeat(80));

    if (passedCount === totalCount) {
      console.log('🎉 All tests passed! Notification preferences filtering works correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the results above.');
      console.log('\nTroubleshooting Tips:');
      console.log('  - Ensure development server is running');
      console.log('  - Check webhook logs in database');
      console.log('  - Verify email sync is working');
      console.log('  - Check push subscription status');
      console.log('  - Review notification preferences in database');
    }

    console.log('\n📚 For more information, see:');
    console.log('  - docs/e2e-notification-testing.md');
    console.log('  - scripts/test-e2e-notification-flow.js');
    console.log('  - apps/web/src/lib/email/sync.ts (sendPushNotificationForNewEmail method)');

  } catch (error) {
    console.error('\n❌ Test error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
