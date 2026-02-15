import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";

export interface AccessTokenPayload {
  userId: string;
  teamId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  familyId: string;
  tokenId: string;
}

const ACCESS_TOKEN_EXPIRY = "15m";

/**
 * Generate an access token (short-lived JWT)
 */
export function generateAccessToken(
  payload: AccessTokenPayload,
  secret: string
): string {
  return jwt.sign(payload, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: "HS256",
  });
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(
  token: string,
  secret: string
): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as AccessTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Generate a refresh token
 * Returns the token and its hash (store the hash in DB, return token to client)
 */
export function generateRefreshToken(): {
  token: string;
  tokenHash: string;
  familyId: string;
  tokenId: string;
  expiresAt: Date;
} {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const familyId = nanoid();
  const tokenId = nanoid();

  // 7 days from now
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    token,
    tokenHash,
    familyId,
    tokenId,
    expiresAt,
  };
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a secure random string for various purposes
 */
export function generateSecureId(length: number = 21): string {
  return nanoid(length);
}

/**
 * Parse expiry string to milliseconds
 */
export function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}
