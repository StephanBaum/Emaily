# Gmail Pub/Sub Setup Guide

This guide walks through setting up Google Cloud Pub/Sub for Gmail push notifications.

## Overview

Gmail push notifications allow your application to receive real-time updates when new emails arrive, instead of polling the Gmail API periodically. This uses Google Cloud Pub/Sub as a message queue between Gmail and your webhook endpoint.

## Architecture

```
Gmail → Pub/Sub Topic → Push Subscription → Your Webhook → Email Sync
```

1. **Gmail**: Publishes notifications when emails arrive
2. **Pub/Sub Topic**: Message queue in Google Cloud
3. **Push Subscription**: Delivers messages to your webhook via HTTPS POST
4. **Your Webhook**: `/api/webhooks/gmail` endpoint receives notifications
5. **Email Sync**: Triggers incremental sync to fetch new emails

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Public HTTPS URL** for your webhook (required for production)
4. **Gmail API** OAuth credentials already configured

## Quick Setup (Automated)

Run the automated setup script:

```bash
chmod +x scripts/setup-gmail-pubsub.sh
./scripts/setup-gmail-pubsub.sh
```

The script will:
1. Create Pub/Sub topic
2. Grant Gmail permissions to publish
3. Create push subscription to your webhook
4. Set up service account credentials
5. Update `.env` file with configuration

## Testing

Run the test script to verify Gmail watch is active:

```bash
node scripts/test-gmail-watch.js
```

Expected output:
```
✅ Watch activated successfully!

📊 Watch Details:
   History ID: 12345678
   Expiration: 1234567890000
   Expires At: 2024-02-03 10:30:00
   Days Until Expiration: 6.98
```

## References

- [Gmail Push Notifications Guide](https://developers.google.com/gmail/api/guides/push)
- [Google Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
