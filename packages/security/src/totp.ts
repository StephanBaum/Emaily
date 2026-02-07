import { authenticator } from "otplib";

// Configure authenticator
authenticator.options = {
  window: 1, // Allow 1 step before/after for clock drift
};

/**
 * Generate a new TOTP secret for a user
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate a URI for authenticator apps (Google Authenticator, Authy, etc.)
 */
export function generateTotpUri(
  secret: string,
  email: string,
  issuer: string = "EmailAutomation"
): string {
  return authenticator.keyuri(email, issuer, secret);
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Generate a current TOTP token (mainly for testing)
 */
export function generateTotpToken(secret: string): string {
  return authenticator.generate(secret);
}

/**
 * Get remaining seconds until current token expires
 */
export function getTotpTimeRemaining(): number {
  return authenticator.timeRemaining();
}
