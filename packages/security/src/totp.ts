import {
  generateSecret,
  generate,
  verify,
  generateURI,
} from "otplib";

const EPOCH_TOLERANCE = 30; // Allow 1 step (30s) for clock drift
const PERIOD = 30; // TOTP period in seconds

/**
 * Generate a new TOTP secret for a user
 */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Generate a URI for authenticator apps (Google Authenticator, Authy, etc.)
 */
export async function generateTotpUri(
  secret: string,
  email: string,
  issuer: string = "EmailAutomation"
): Promise<string> {
  return generateURI({ secret, label: email, issuer });
}

/**
 * Verify a TOTP token against a secret
 */
export async function verifyTotpToken(
  secret: string,
  token: string
): Promise<boolean> {
  try {
    const result = await verify({ token, secret, epochTolerance: EPOCH_TOLERANCE });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Generate a current TOTP token (mainly for testing)
 */
export async function generateTotpToken(secret: string): Promise<string> {
  return generate({ secret });
}

/**
 * Get remaining seconds until current token expires
 */
export function getTotpTimeRemaining(): number {
  const epoch = Math.floor(Date.now() / 1000);
  return PERIOD - (epoch % PERIOD);
}
