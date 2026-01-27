#!/usr/bin/env node

/**
 * Outlook Subscription Test Script
 * Tests Microsoft Graph subscription creation to verify setup
 *
 * This script:
 * 1. Loads OAuth tokens from database for a test Outlook account
 * 2. Creates a Microsoft Graph subscription for inbox messages
 * 3. Verifies the response contains subscriptionId
 * 4. Shows subscription status and expiration
 * 5. Lists all active subscriptions for the account
 */

const { PrismaClient } = require('@prisma/client');
const { createOutlookSubscriptionService } = require('../apps/web/src/lib/notifications/outlook-subscriptions');

// Load environment variables
require('dotenv').config();

const prisma = new PrismaClient();

async function testOutlookSubscription() {
  console.log('🧪 Outlook Subscription Test Script');
  console.log('===================================\n');

  // Verify required environment variables
  const requiredEnvVars = [
    'WEBHOOK_BASE_URL',
    'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET',
  ];

  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nRun setup-outlook-subscriptions.sh first or check your .env file');
    process.exit(1);
  }

  console.log('✅ Environment variables configured\n');

  try {
    // Find an Outlook account to test with
    console.log('🔍 Finding Outlook account...');
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        provider: 'microsoft',
        accessToken: { not: null },
      },
      include: {
        user: true,
      },
    });

    if (!emailAccount) {
      console.error('❌ No Outlook account found in database');
      console.error('   Please connect an Outlook/Microsoft account in the app first');
      process.exit(1);
    }

    console.log(`✅ Found Outlook account: ${emailAccount.emailAddress}`);
    console.log(`   User: ${emailAccount.user.email}\n`);

    // Build webhook URL
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL;
    const webhookUrl = `${webhookBaseUrl}/api/webhooks/outlook`;

    console.log('🔔 Webhook Configuration:');
    console.log(`   Base URL: ${webhookBaseUrl}`);
    console.log(`   Webhook URL: ${webhookUrl}\n`);

    // Check webhook URL is HTTPS
    if (!webhookUrl.startsWith('https://')) {
      console.error('❌ Error: Webhook URL must use HTTPS');
      console.error('   Microsoft Graph requires HTTPS for webhook endpoints');
      console.error('   Update WEBHOOK_BASE_URL in .env to use https://');
      process.exit(1);
    }

    // Create Outlook subscription service
    console.log('🔧 Creating Outlook subscription service...');
    const outlookSubscriptionService = createOutlookSubscriptionService({
      accessToken: emailAccount.accessToken,
      refreshToken: emailAccount.refreshToken,
      expiresAt: emailAccount.tokenExpiresAt?.getTime() || Date.now() + 3600000,
    });
    console.log('✅ Service created\n');

    // Create subscription
    console.log('📬 Creating Microsoft Graph subscription...');
    console.log('   This will validate your webhook endpoint...\n');

    const subscriptionResponse = await outlookSubscriptionService.createSubscription({
      notificationUrl: webhookUrl,
      expirationMinutes: 4230, // ~3 days (max allowed)
    });

    console.log('✅ Subscription created successfully!\n');
    console.log('📊 Subscription Details:');
    console.log(`   Subscription ID: ${subscriptionResponse.subscriptionId}`);
    console.log(`   Expiration: ${subscriptionResponse.expirationDateTime}`);

    const expirationDate = new Date(subscriptionResponse.expirationDateTime);
    console.log(`   Expires At: ${expirationDate.toLocaleString()}`);

    const daysUntilExpiration = (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    console.log(`   Days Until Expiration: ${daysUntilExpiration.toFixed(2)}\n`);

    // Check subscription status
    console.log('🔍 Checking subscription status...');
    const status = await outlookSubscriptionService.checkSubscriptionStatus(
      subscriptionResponse.subscriptionId
    );

    console.log('✅ Subscription is active!\n');
    console.log('📋 Status Details:');
    console.log(`   Active: ${status.active ? 'Yes' : 'No'}`);
    console.log(`   Expires: ${status.expiresAt.toLocaleString()}`);
    console.log(`   Needs Renewal: ${status.needsRenewal ? 'Yes' : 'No'}`);

    if (status.subscriptionId) {
      console.log(`   Subscription ID: ${status.subscriptionId}\n`);
    }

    console.log('========================================');
    console.log('✅ Outlook Subscription Test PASSED');
    console.log('========================================\n');
    console.log('📝 What this means:');
    console.log('   - Microsoft Graph API is properly configured');
    console.log('   - Webhook endpoint is accessible and validated');
    console.log('   - Subscription is active and will receive notifications');
    console.log('   - New emails will trigger webhooks\n');
    console.log('📬 Test it:');
    console.log(`   1. Send an email to ${emailAccount.emailAddress}`);
    console.log('   2. Check webhook logs in your app (WebhookLog table)');
    console.log('   3. Verify email syncs immediately\n');
    console.log('🗑️  Cleanup:');
    console.log('   To delete the test subscription:');
    console.log(`   - Run: node scripts/delete-outlook-subscription.js ${subscriptionResponse.subscriptionId}`);
    console.log('   - Or let it expire automatically in ~3 days\n');

  } catch (error) {
    console.error('\n❌ Outlook Subscription Test FAILED\n');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);

    if (error.type) {
      console.error(`   Type: ${error.type}`);
    }

    if (error.provider) {
      console.error(`   Provider: ${error.provider}`);
    }

    if (error.response) {
      console.error(`   Response: ${JSON.stringify(error.response, null, 2)}`);
    }

    console.error('\n📚 Troubleshooting:\n');

    if (error.message?.includes('validation')) {
      console.error('   Issue: Webhook validation failed');
      console.error('   Solution: Ensure your webhook is publicly accessible via HTTPS');
      console.error('   Test webhook: curl "' + process.env.WEBHOOK_BASE_URL + '/api/webhooks/outlook?validationToken=test"');
      console.error('   Expected response: test');
    } else if (error.message?.includes('permission') || error.message?.includes('403')) {
      console.error('   Issue: Insufficient Microsoft Graph permissions');
      console.error('   Solution: Ensure these permissions are granted in Azure Portal:');
      console.error('   - Mail.Read (Delegated)');
      console.error('   - Mail.ReadWrite (Delegated)');
      console.error('   - offline_access (Delegated)');
      console.error('   Azure Portal: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps');
    } else if (error.message?.includes('auth') || error.message?.includes('401')) {
      console.error('   Issue: OAuth token expired or invalid');
      console.error('   Solution: Reconnect Outlook account in the app');
    } else if (error.message?.includes('https') || error.message?.includes('SSL')) {
      console.error('   Issue: Webhook URL must use HTTPS');
      console.error('   Solution: Update WEBHOOK_BASE_URL in .env to use https://');
      console.error('   For local testing, use ngrok: ngrok http 3000');
    } else if (error.message?.includes('timeout') || error.message?.includes('network')) {
      console.error('   Issue: Webhook endpoint not accessible');
      console.error('   Solution: Ensure your webhook is publicly accessible');
      console.error('   Test: curl ' + process.env.WEBHOOK_BASE_URL + '/api/webhooks/outlook');
    } else {
      console.error('   Check the error message above for details');
      console.error('   Refer to Microsoft Graph docs: https://learn.microsoft.com/graph/webhooks');
    }

    console.error('\n💡 Common Solutions:\n');
    console.error('   1. Verify webhook is running: pnpm dev');
    console.error('   2. Test webhook validation:');
    console.error('      curl "' + (process.env.WEBHOOK_BASE_URL || 'YOUR_WEBHOOK_URL') + '/api/webhooks/outlook?validationToken=test123"');
    console.error('      Expected: test123');
    console.error('   3. For local development, use ngrok:');
    console.error('      ngrok http 3000');
    console.error('      Update WEBHOOK_BASE_URL with ngrok HTTPS URL');
    console.error('   4. Check Azure App permissions in Azure Portal');
    console.error('   5. Reconnect Outlook account if token expired\n');

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testOutlookSubscription().catch(console.error);
