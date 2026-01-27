/**
 * Gmail Pub/Sub Setup Script
 *
 * This script helps set up and verify Gmail push notifications via Google Cloud Pub/Sub.
 *
 * Prerequisites:
 * 1. Google Cloud Project with billing enabled
 * 2. Gmail API enabled in Google Cloud Console
 * 3. Pub/Sub API enabled in Google Cloud Console
 * 4. Service account with appropriate permissions
 * 5. User OAuth tokens for Gmail API access
 *
 * Usage:
 *   npx tsx scripts/setup-gmail-pubsub.ts [command]
 *
 * Commands:
 *   create-topic    - Create Pub/Sub topic
 *   grant-publish   - Grant Gmail permission to publish to topic
 *   create-sub      - Create push subscription to webhook
 *   start-watch     - Start Gmail watch for a user
 *   verify-watch    - Verify watch is active
 *   stop-watch      - Stop Gmail watch
 */

import { google } from 'googleapis';
import { PubSub } from '@google-cloud/pubsub';

// Configuration from environment variables
const config = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
  topicName: process.env.GMAIL_PUBSUB_TOPIC || 'gmail-notifications',
  subscriptionName: process.env.GMAIL_PUBSUB_SUBSCRIPTION || 'gmail-notifications-sub',
  webhookUrl: process.env.WEBHOOK_BASE_URL
    ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/gmail`
    : 'http://localhost:3000/api/webhooks/gmail',
  serviceAccountEmail: process.env.GMAIL_SERVICE_ACCOUNT_EMAIL || '',
};

// Gmail service account that needs publish permissions
const GMAIL_SERVICE_ACCOUNT = 'gmail-api-push@system.gserviceaccount.com';

/**
 * Create Pub/Sub topic for Gmail notifications
 */
async function createTopic(): Promise<void> {
  console.log('Creating Pub/Sub topic...');

  if (!config.projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
  }

  const pubsub = new PubSub({ projectId: config.projectId });
  const topicName = `projects/${config.projectId}/topics/${config.topicName}`;

  try {
    const [topic] = await pubsub.createTopic(config.topicName);
    console.log(`✓ Topic created: ${topic.name}`);
    console.log(`  Full name: ${topicName}`);
  } catch (error: any) {
    if (error.code === 6) { // ALREADY_EXISTS
      console.log(`✓ Topic already exists: ${topicName}`);
    } else {
      throw error;
    }
  }
}

/**
 * Grant Gmail API permission to publish to the topic
 */
async function grantPublishPermission(): Promise<void> {
  console.log('Granting Gmail API publish permission...');

  if (!config.projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
  }

  const pubsub = new PubSub({ projectId: config.projectId });
  const topic = pubsub.topic(config.topicName);

  try {
    // Add IAM policy binding to allow Gmail to publish
    await topic.iam.setPolicy({
      bindings: [
        {
          role: 'roles/pubsub.publisher',
          members: [`serviceAccount:${GMAIL_SERVICE_ACCOUNT}`],
        },
      ],
    });

    console.log(`✓ Granted publish permission to ${GMAIL_SERVICE_ACCOUNT}`);
  } catch (error) {
    console.error('Failed to grant permission:', error);
    throw error;
  }
}

/**
 * Create push subscription to webhook endpoint
 */
async function createSubscription(): Promise<void> {
  console.log('Creating push subscription...');

  if (!config.projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
  }

  const pubsub = new PubSub({ projectId: config.projectId });
  const topic = pubsub.topic(config.topicName);

  try {
    const [subscription] = await topic.createSubscription(config.subscriptionName, {
      pushConfig: {
        pushEndpoint: config.webhookUrl,
      },
      ackDeadlineSeconds: 600, // 10 minutes
    });

    console.log(`✓ Subscription created: ${subscription.name}`);
    console.log(`  Webhook URL: ${config.webhookUrl}`);
  } catch (error: any) {
    if (error.code === 6) { // ALREADY_EXISTS
      console.log(`✓ Subscription already exists: ${config.subscriptionName}`);
      console.log(`  Webhook URL: ${config.webhookUrl}`);
    } else {
      throw error;
    }
  }
}

/**
 * Start Gmail watch for a user
 * Requires user OAuth access token
 */
async function startWatch(accessToken: string): Promise<void> {
  console.log('Starting Gmail watch...');

  if (!config.projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const topicName = `projects/${config.projectId}/topics/${config.topicName}`;

  try {
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
      },
    });

    console.log('✓ Gmail watch started successfully!');
    console.log(`  History ID: ${response.data.historyId}`);
    console.log(`  Expiration: ${new Date(parseInt(response.data.expiration || '0')).toISOString()}`);
    console.log(`  Topic: ${topicName}`);
  } catch (error) {
    console.error('Failed to start watch:', error);
    throw error;
  }
}

/**
 * Verify Gmail watch is active
 */
async function verifyWatch(accessToken: string): Promise<void> {
  console.log('Verifying Gmail watch status...');

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // Get user profile to check current watch status
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`✓ Connected to Gmail account: ${profile.data.emailAddress}`);
    console.log(`  History ID: ${profile.data.historyId}`);

    // Try to start a watch to see current status
    // If already watching, this will return the existing watch details
    const topicName = `projects/${config.projectId}/topics/${config.topicName}`;
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
      },
    });

    console.log('✓ Watch is active!');
    console.log(`  History ID: ${response.data.historyId}`);
    console.log(`  Expiration: ${new Date(parseInt(response.data.expiration || '0')).toISOString()}`);

    const expiresIn = parseInt(response.data.expiration || '0') - Date.now();
    const daysLeft = Math.floor(expiresIn / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((expiresIn % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    console.log(`  Time remaining: ${daysLeft} days, ${hoursLeft} hours`);
  } catch (error) {
    console.error('Failed to verify watch:', error);
    throw error;
  }
}

/**
 * Stop Gmail watch for a user
 */
async function stopWatch(accessToken: string): Promise<void> {
  console.log('Stopping Gmail watch...');

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    await gmail.users.stop({ userId: 'me' });
    console.log('✓ Gmail watch stopped successfully');
  } catch (error) {
    console.error('Failed to stop watch:', error);
    throw error;
  }
}

/**
 * Display setup instructions
 */
function showInstructions(): void {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Gmail Pub/Sub Setup Instructions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Prerequisites:

1. Google Cloud Project
   • Create project at: https://console.cloud.google.com/
   • Enable billing
   • Enable Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com
   • Enable Pub/Sub API: https://console.cloud.google.com/apis/library/pubsub.googleapis.com

2. Service Account (for Pub/Sub operations)
   • Create at: https://console.cloud.google.com/iam-admin/serviceaccounts
   • Grant roles: "Pub/Sub Admin"
   • Create and download JSON key
   • Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

3. OAuth Credentials (for Gmail API)
   • Already configured in .env file
   • GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

4. Environment Variables
   Add to .env file:

   GOOGLE_CLOUD_PROJECT="your-project-id"
   GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
   WEBHOOK_BASE_URL="https://your-domain.com"  # For production
   GMAIL_PUBSUB_TOPIC="gmail-notifications"
   GMAIL_PUBSUB_SUBSCRIPTION="gmail-notifications-sub"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Setup Steps:

Step 1: Create Pub/Sub Topic
   npx tsx scripts/setup-gmail-pubsub.ts create-topic

Step 2: Grant Gmail Publish Permission
   npx tsx scripts/setup-gmail-pubsub.ts grant-publish

Step 3: Create Push Subscription
   npx tsx scripts/setup-gmail-pubsub.ts create-sub

Step 4: Start Watch (requires user access token)
   npx tsx scripts/setup-gmail-pubsub.ts start-watch <ACCESS_TOKEN>

Step 5: Verify Watch
   npx tsx scripts/setup-gmail-pubsub.ts verify-watch <ACCESS_TOKEN>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Notes:

• Access tokens can be obtained from the database (EmailAccount table)
• Watches expire after 7 days and need renewal
• For production, ensure webhook URL is publicly accessible and uses HTTPS
• Local development requires tunneling (ngrok, cloudflare tunnel, etc.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Useful Links:

• Gmail Push: https://developers.google.com/gmail/api/guides/push
• Pub/Sub: https://cloud.google.com/pubsub/docs
• IAM Roles: https://cloud.google.com/iam/docs/understanding-roles

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

// Main CLI handler
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'create-topic':
        await createTopic();
        break;

      case 'grant-publish':
        await grantPublishPermission();
        break;

      case 'create-sub':
        await createSubscription();
        break;

      case 'start-watch':
        if (!arg) {
          console.error('Error: Access token required');
          console.log('Usage: npx tsx scripts/setup-gmail-pubsub.ts start-watch <ACCESS_TOKEN>');
          process.exit(1);
        }
        await startWatch(arg);
        break;

      case 'verify-watch':
        if (!arg) {
          console.error('Error: Access token required');
          console.log('Usage: npx tsx scripts/setup-gmail-pubsub.ts verify-watch <ACCESS_TOKEN>');
          process.exit(1);
        }
        await verifyWatch(arg);
        break;

      case 'stop-watch':
        if (!arg) {
          console.error('Error: Access token required');
          console.log('Usage: npx tsx scripts/setup-gmail-pubsub.ts stop-watch <ACCESS_TOKEN>');
          process.exit(1);
        }
        await stopWatch(arg);
        break;

      case 'help':
      case undefined:
        showInstructions();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "npx tsx scripts/setup-gmail-pubsub.ts help" for instructions');
        process.exit(1);
    }

    console.log('\n✓ Done!');
  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  createTopic,
  grantPublishPermission,
  createSubscription,
  startWatch,
  verifyWatch,
  stopWatch,
};
