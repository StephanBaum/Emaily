#!/bin/bash

# Outlook Graph Subscription Setup Script
# This script helps set up Microsoft Graph subscriptions for Outlook push notifications
# Unlike Gmail (which requires Google Cloud Pub/Sub), Outlook subscriptions are created
# directly via the Graph API when a user connects their account.

set -e

echo "🚀 Outlook Graph Subscription Setup Script"
echo "==========================================="
echo ""

# Check if az CLI is installed (optional but recommended)
if command -v az &> /dev/null; then
    echo "✅ Azure CLI found (optional)"
    echo ""
else
    echo "ℹ️  Azure CLI not found (optional for enterprise apps)"
    echo "   For Microsoft 365 enterprise setup, install from: https://learn.microsoft.com/cli/azure/install-azure-cli"
    echo ""
fi

# Prompt for configuration
read -p "Enter your webhook base URL (must be HTTPS): " WEBHOOK_URL

# Validate webhook URL
if [[ ! "$WEBHOOK_URL" =~ ^https:// ]]; then
    echo "❌ Error: Webhook URL must use HTTPS"
    exit 1
fi

echo ""
echo "📋 Configuration:"
echo "  Webhook Base URL: $WEBHOOK_URL"
echo "  Webhook Endpoint: $WEBHOOK_URL/api/webhooks/outlook"
echo ""
echo "ℹ️  About Outlook Subscriptions:"
echo ""
echo "  Unlike Gmail (which uses Pub/Sub), Outlook subscriptions are created"
echo "  directly via the Microsoft Graph API. This script will:"
echo "  1. Update your .env file with webhook URL"
echo "  2. Provide instructions for Azure App registration"
echo "  3. Explain subscription lifecycle management"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Update .env file
echo ""
echo "📝 Updating .env file..."
if [ -f .env ]; then
    # Backup existing .env
    cp .env .env.backup
    echo "   Backed up existing .env to .env.backup"
fi

# Check if WEBHOOK_BASE_URL already exists
if grep -q "^WEBHOOK_BASE_URL=" .env 2>/dev/null; then
    # Update existing entry
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^WEBHOOK_BASE_URL=.*|WEBHOOK_BASE_URL=\"$WEBHOOK_URL\"|" .env
    else
        # Linux
        sed -i "s|^WEBHOOK_BASE_URL=.*|WEBHOOK_BASE_URL=\"$WEBHOOK_URL\"|" .env
    fi
    echo "   ✅ Updated WEBHOOK_BASE_URL in .env"
else
    # Add new entry
    {
        echo ""
        echo "# Outlook Graph Subscription Configuration (added by setup-outlook-subscriptions.sh)"
        echo "WEBHOOK_BASE_URL=\"$WEBHOOK_URL\""
    } >> .env
    echo "   ✅ Added WEBHOOK_BASE_URL to .env"
fi

echo ""
echo "=========================================="
echo "✅ Outlook Setup Configuration Complete!"
echo "=========================================="
echo ""
echo "📝 Azure App Registration Setup:"
echo ""
echo "1. Go to Azure Portal: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps"
echo ""
echo "2. Find your registered app (or create a new one)"
echo ""
echo "3. Required API Permissions:"
echo "   Microsoft Graph API permissions needed:"
echo "   - Mail.Read (Delegated)"
echo "   - Mail.ReadWrite (Delegated)"
echo "   - offline_access (Delegated)"
echo "   - User.Read (Delegated)"
echo ""
echo "4. Redirect URIs:"
echo "   Add these redirect URIs in 'Authentication':"
echo "   - Web: $WEBHOOK_URL/api/auth/callback/azure-ad"
echo "   - Mobile: exp://localhost:19000"
echo ""
echo "5. Client Secret:"
echo "   In 'Certificates & secrets', ensure you have a client secret"
echo "   Add it to your .env file as AZURE_CLIENT_SECRET"
echo ""
echo "📝 Webhook Configuration:"
echo ""
echo "Microsoft Graph will validate your webhook endpoint when creating a subscription."
echo "The validation process:"
echo ""
echo "1. Microsoft sends a POST request with a validation token:"
echo "   POST $WEBHOOK_URL/api/webhooks/outlook?validationToken=xxx"
echo ""
echo "2. Your endpoint must respond with status 200 and the token in plain text:"
echo "   Response: the-validation-token"
echo ""
echo "3. Your webhook endpoint at /api/webhooks/outlook is already configured to handle this!"
echo ""
echo "📝 Testing:"
echo ""
echo "Run the test script to create and verify a subscription:"
echo "  node scripts/test-outlook-subscription.js"
echo ""
echo "Or test the validation endpoint manually:"
echo "  curl \"$WEBHOOK_URL/api/webhooks/outlook?validationToken=test123\""
echo "  Expected: test123"
echo ""
echo "📝 Subscription Lifecycle:"
echo ""
echo "Microsoft Graph subscriptions have a maximum lifetime of ~3 days (4230 minutes)."
echo "Your application will automatically:"
echo "  - Create subscriptions when users connect Outlook accounts"
echo "  - Renew subscriptions before they expire (checked on email sync)"
echo "  - Delete subscriptions when users disconnect accounts"
echo ""
echo "📝 Monitoring:"
echo ""
echo "View active subscriptions (requires access token):"
echo "  curl -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\"
echo "    https://graph.microsoft.com/v1.0/subscriptions"
echo ""
echo "Or use the Microsoft Graph Explorer:"
echo "  https://developer.microsoft.com/graph/graph-explorer"
echo ""
echo "📚 Documentation:"
echo "  - Graph Subscriptions: https://learn.microsoft.com/graph/webhooks"
echo "  - Subscription Resource: https://learn.microsoft.com/graph/api/subscription-post-subscriptions"
echo "  - Mail Change Notifications: https://learn.microsoft.com/graph/webhooks-outlook-authz"
echo ""
echo "⚠️  Important:"
echo "  - Webhook URL must be publicly accessible via HTTPS"
echo "  - Webhook must respond to validation requests within 10 seconds"
echo "  - Subscriptions expire after ~3 days - app auto-renews them"
echo "  - Each user needs their own subscription (created per-account)"
echo ""
echo "🔍 Troubleshooting:"
echo ""
echo "If subscription creation fails:"
echo "  - Verify webhook URL is publicly accessible"
echo "  - Check webhook responds to validation requests"
echo "  - Ensure Microsoft Graph permissions are granted"
echo "  - Check access token is valid and not expired"
echo "  - Review webhook logs in your application"
echo ""
echo "📬 Next Steps:"
echo ""
echo "1. Test webhook validation endpoint:"
echo "   curl \"$WEBHOOK_URL/api/webhooks/outlook?validationToken=test123\""
echo ""
echo "2. Start your application:"
echo "   pnpm dev"
echo ""
echo "3. Test subscription creation:"
echo "   node scripts/test-outlook-subscription.js"
echo ""
echo "4. Connect an Outlook account in your app"
echo "   - The app will automatically create a subscription"
echo "   - Send a test email to verify webhook receives notification"
echo ""
