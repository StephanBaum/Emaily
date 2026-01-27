/**
 * Google Cloud Pub/Sub Signature Verification
 *
 * Verifies that webhook requests are genuinely from Google Cloud Pub/Sub
 * using JWT token verification.
 */

import { OAuth2Client } from 'google-auth-library';

const PUBSUB_VERIFICATION_TOKEN = process.env.PUBSUB_VERIFICATION_TOKEN;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = 'gmail-api-push@system.gserviceaccount.com';

/**
 * Verify Google Cloud Pub/Sub push notification authenticity
 *
 * @param authorizationHeader - Authorization header from request
 * @returns true if signature is valid, false otherwise
 */
export async function verifyPubSubSignature(
  authorizationHeader: string | null
): Promise<boolean> {
  if (!authorizationHeader) {
    return false;
  }

  // Extract Bearer token
  const token = authorizationHeader.replace('Bearer ', '');

  try {
    // Verify JWT token using Google Auth Library
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: PUBSUB_VERIFICATION_TOKEN,
    });

    const payload = ticket.getPayload();

    // Verify the token is from Google
    if (!payload || payload.email !== GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Pub/Sub signature verification failed:', error);
    return false;
  }
}

/**
 * Alternative: Verify using custom secret token
 * Simpler but less secure than JWT verification
 */
export function verifyPubSubToken(requestToken: string | null): boolean {
  if (!PUBSUB_VERIFICATION_TOKEN) {
    // If no token configured, log warning but allow (dev mode)
    console.warn('PUBSUB_VERIFICATION_TOKEN not configured - webhook authentication disabled');
    return true;
  }

  return requestToken === PUBSUB_VERIFICATION_TOKEN;
}
