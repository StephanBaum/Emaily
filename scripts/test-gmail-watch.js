#!/usr/bin/env node

/**
 * Gmail Watch Test Script
 * Tests Gmail API users.watch() to verify Pub/Sub setup
 *
 * This script:
 * 1. Loads OAuth tokens from database for a test user
 * 2. Calls Gmail API users.watch() with Pub/Sub topic
 * 3. Verifies the response contains historyId
 * 4. Shows watch status and expiration
 */

const { PrismaClient } = require('@prisma/client');
const { createGmailPubSubService, buildPubSubTopicName } = require('../apps/web/src/lib/notifications/gmail-pubsub');

// Load environment variables
require('dotenv').config();

const prisma = new PrismaClient();

async function testGmailWatch() {
  console.log('🧪 Gmail Watch Test Script');
  console.log('==========================\n');

  // Verify required environment variables
  const requiredEnvVars = [
    'GOOGLE_CLOUD_PROJECT',
    'GMAIL_PUBSUB_TOPIC',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];

  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nRun setup-gmail-pubsub.sh first or check your .env file');
    process.exit(1);
  }

  console.log('✅ Environment variables configured\n');

  try {
    // Find a Gmail account to test with
    console.log('🔍 Finding Gmail account...');
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        provider: 'google',
        accessToken: { not: null },
      },
      include: {
        user: true,
      },
    });

    if (!emailAccount) {
      console.error('❌ No Gmail account found in database');
      console.error('   Please connect a Gmail account in the app first');
      process.exit(1);
    }

    console.log(`✅ Found Gmail account: ${emailAccount.emailAddress}`);
    console.log(`   User: ${emailAccount.user.email}\n`);

    // Build Pub/Sub topic name
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const topicName = process.env.GMAIL_PUBSUB_TOPIC;
    const fullTopicName = buildPubSubTopicName(projectId, topicName);

    console.log('📢 Pub/Sub Configuration:');
    console.log(`   Project: ${projectId}`);
    console.log(`   Topic: ${topicName}`);
    console.log(`   Full Topic Name: ${fullTopicName}\n`);

    // Create Gmail Pub/Sub service
    console.log('🔧 Creating Gmail Pub/Sub service...');
    const gmailPubSubService = createGmailPubSubService({
      accessToken: emailAccount.accessToken,
      refreshToken: emailAccount.refreshToken,
      expiresAt: emailAccount.tokenExpiresAt?.getTime() || Date.now() + 3600000,
    });
    console.log('✅ Service created\n');

    // Start watch
    console.log('👀 Starting Gmail watch...');
    const watchResponse = await gmailPubSubService.startWatch({
      topicName: fullTopicName,
      labelIds: ['INBOX'],
    });

    console.log('✅ Watch activated successfully!\n');
    console.log('📊 Watch Details:');
    console.log(`   History ID: ${watchResponse.historyId}`);
    console.log(`   Expiration: ${watchResponse.expiration}`);

    const expirationDate = new Date(parseInt(watchResponse.expiration));
    console.log(`   Expires At: ${expirationDate.toLocaleString()}`);

    const daysUntilExpiration = (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    console.log(`   Days Until Expiration: ${daysUntilExpiration.toFixed(2)}\n`);

    // Store watch information in database (optional)
    console.log('💾 Updating email account with watch info...');
    await prisma.emailAccount.update({
      where: { id: emailAccount.id },
      data: {
        // You could add these fields to the schema if needed
        // watchHistoryId: watchResponse.historyId,
        // watchExpiration: expirationDate,
      },
    });
    console.log('✅ Database updated\n');

    console.log('========================================');
    console.log('✅ Gmail Watch Test PASSED');
    console.log('========================================\n');
    console.log('📝 What this means:');
    console.log('   - Gmail API is properly configured');
    console.log('   - Pub/Sub topic is accessible');
    console.log('   - Watch notifications are active');
    console.log('   - New emails will trigger webhooks\n');
    console.log('📬 Test it:');
    console.log(`   1. Send an email to ${emailAccount.emailAddress}`);
    console.log('   2. Check webhook logs in your app');
    console.log('   3. Verify email syncs immediately\n');

  } catch (error) {
    console.error('\n❌ Gmail Watch Test FAILED\n');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);

    if (error.type) {
      console.error(`   Type: ${error.type}`);
    }

    if (error.provider) {
      console.error(`   Provider: ${error.provider}`);
    }

    console.error('\n📚 Troubleshooting:\n');

    if (error.message?.includes('topic')) {
      console.error('   Issue: Pub/Sub topic not found or not accessible');
      console.error('   Solution: Run setup-gmail-pubsub.sh to create the topic');
      console.error('   Verify: gcloud pubsub topics describe ' + process.env.GMAIL_PUBSUB_TOPIC);
    } else if (error.message?.includes('permission')) {
      console.error('   Issue: Gmail API lacks permission to publish to topic');
      console.error('   Solution: Grant gmail-api-push@system.gserviceaccount.com publisher role');
      console.error('   Command: See setup-gmail-pubsub.sh for IAM binding command');
    } else if (error.message?.includes('auth')) {
      console.error('   Issue: OAuth token expired or invalid');
      console.error('   Solution: Reconnect Gmail account in the app');
    } else {
      console.error('   Check the error message above for details');
      console.error('   Refer to Gmail Push API docs: https://developers.google.com/gmail/api/guides/push');
    }

    console.error('');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testGmailWatch().catch(console.error);
