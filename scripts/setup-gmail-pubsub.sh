#!/bin/bash

# Gmail Pub/Sub Setup Script
# This script sets up Google Cloud Pub/Sub for Gmail push notifications
# Run this script when you have:
# 1. A Google Cloud Project with billing enabled
# 2. gcloud CLI installed and authenticated
# 3. A publicly accessible webhook URL (HTTPS required)

set -e

echo "🚀 Gmail Pub/Sub Setup Script"
echo "================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "   Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI found"
echo ""

# Prompt for configuration
read -p "Enter your Google Cloud Project ID: " PROJECT_ID
read -p "Enter Pub/Sub topic name (default: gmail-notifications): " TOPIC_NAME
TOPIC_NAME=${TOPIC_NAME:-gmail-notifications}
read -p "Enter subscription name (default: gmail-notifications-sub): " SUBSCRIPTION_NAME
SUBSCRIPTION_NAME=${SUBSCRIPTION_NAME:-gmail-notifications-sub}
read -p "Enter your webhook URL (must be HTTPS): " WEBHOOK_URL

# Validate webhook URL
if [[ ! "$WEBHOOK_URL" =~ ^https:// ]]; then
    echo "❌ Error: Webhook URL must use HTTPS"
    exit 1
fi

echo ""
echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Topic: $TOPIC_NAME"
echo "  Subscription: $SUBSCRIPTION_NAME"
echo "  Webhook: $WEBHOOK_URL"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Set the project
echo ""
echo "📦 Setting GCP project..."
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo ""
echo "🔧 Enabling required APIs..."
gcloud services enable pubsub.googleapis.com
gcloud services enable gmail.googleapis.com

# Create Pub/Sub topic
echo ""
echo "📢 Creating Pub/Sub topic..."
if gcloud pubsub topics describe "$TOPIC_NAME" &> /dev/null; then
    echo "   Topic '$TOPIC_NAME' already exists"
else
    gcloud pubsub topics create "$TOPIC_NAME"
    echo "   ✅ Topic created: $TOPIC_NAME"
fi

# Grant Gmail permission to publish to the topic
echo ""
echo "🔐 Granting Gmail permissions..."
gcloud pubsub topics add-iam-policy-binding "$TOPIC_NAME" \
    --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
    --role="roles/pubsub.publisher"
echo "   ✅ Permissions granted"

# Create push subscription to webhook
echo ""
echo "🔔 Creating push subscription..."
if gcloud pubsub subscriptions describe "$SUBSCRIPTION_NAME" &> /dev/null; then
    echo "   Subscription '$SUBSCRIPTION_NAME' already exists"
    read -p "   Delete and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gcloud pubsub subscriptions delete "$SUBSCRIPTION_NAME"
        gcloud pubsub subscriptions create "$SUBSCRIPTION_NAME" \
            --topic="$TOPIC_NAME" \
            --push-endpoint="$WEBHOOK_URL/api/webhooks/gmail" \
            --ack-deadline=10
        echo "   ✅ Subscription recreated"
    fi
else
    gcloud pubsub subscriptions create "$SUBSCRIPTION_NAME" \
        --topic="$TOPIC_NAME" \
        --push-endpoint="$WEBHOOK_URL/api/webhooks/gmail" \
        --ack-deadline=10
    echo "   ✅ Subscription created: $SUBSCRIPTION_NAME"
fi

# Create service account for application
echo ""
echo "👤 Creating service account..."
SERVICE_ACCOUNT_NAME="gmail-push-notifications"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &> /dev/null; then
    echo "   Service account already exists: $SERVICE_ACCOUNT_EMAIL"
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="Gmail Push Notifications Service Account"
    echo "   ✅ Service account created"
fi

# Grant necessary roles
echo ""
echo "🔑 Granting service account roles..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/pubsub.subscriber" \
    --condition=None 2>/dev/null || true

# Create and download service account key
echo ""
echo "🔐 Creating service account key..."
KEY_FILE="./service-account.json"
if [ -f "$KEY_FILE" ]; then
    echo "   ⚠️  Key file already exists: $KEY_FILE"
    read -p "   Overwrite? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gcloud iam service-accounts keys create "$KEY_FILE" \
            --iam-account="$SERVICE_ACCOUNT_EMAIL"
        echo "   ✅ New key created: $KEY_FILE"
    fi
else
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SERVICE_ACCOUNT_EMAIL"
    echo "   ✅ Key created: $KEY_FILE"
fi

# Update .env file
echo ""
echo "📝 Updating .env file..."
if [ -f .env ]; then
    # Backup existing .env
    cp .env .env.backup
    echo "   Backed up existing .env to .env.backup"
fi

# Add or update environment variables
{
    echo ""
    echo "# Gmail Pub/Sub Configuration (added by setup-gmail-pubsub.sh)"
    echo "GOOGLE_CLOUD_PROJECT=\"$PROJECT_ID\""
    echo "GOOGLE_APPLICATION_CREDENTIALS=\"./service-account.json\""
    echo "GMAIL_PUBSUB_TOPIC=\"$TOPIC_NAME\""
    echo "GMAIL_PUBSUB_SUBSCRIPTION=\"$SUBSCRIPTION_NAME\""
    echo "WEBHOOK_BASE_URL=\"$WEBHOOK_URL\""
    echo "PUBSUB_VERIFICATION_TOKEN=\"$WEBHOOK_URL/api/webhooks/gmail\""
} >> .env

echo "   ✅ Environment variables added to .env"

echo ""
echo "=========================================="
echo "Step 4: Configure Webhook Verification"
echo "=========================================="
echo ""
echo "Add this to your .env file:"
echo "PUBSUB_VERIFICATION_TOKEN=\"$WEBHOOK_URL/api/webhooks/gmail\""
echo ""
echo "This token is used to verify webhook requests are from Google Cloud Pub/Sub."
echo ""

echo ""
echo "=========================================="
echo "✅ Gmail Pub/Sub Setup Complete!"
echo "=========================================="
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Test the webhook endpoint:"
echo "   node scripts/test-gmail-watch.js"
echo ""
echo "2. Start your application:"
echo "   pnpm dev"
echo ""
echo "3. Activate Gmail watch for a user:"
echo "   - Log in to your app"
echo "   - Connect a Gmail account"
echo "   - The app will automatically set up watch notifications"
echo ""
echo "4. Monitor webhook logs:"
echo "   gcloud pubsub subscriptions pull $SUBSCRIPTION_NAME --limit=10"
echo ""
echo "📚 Documentation:"
echo "   - Gmail Push API: https://developers.google.com/gmail/api/guides/push"
echo "   - Pub/Sub Setup: https://cloud.google.com/pubsub/docs/push"
echo ""
echo "⚠️  Important:"
echo "   - Keep service-account.json secure (it's in .gitignore)"
echo "   - Webhook URL must be publicly accessible via HTTPS"
echo "   - Gmail watch expires after 7 days - app auto-renews"
echo ""
