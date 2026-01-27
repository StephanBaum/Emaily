/**
 * Next.js Middleware for API Rate Limiting
 *
 * Implements IP-based rate limiting for authentication endpoints to prevent
 * brute force attacks and credential stuffing.
 *
 * Protected Routes:
 * - /api/auth/* - All authentication endpoints (5 requests per 15 minutes)
 *
 * Rate limit information is persisted to the database via the rateLimit utility,
 * which uses a sliding window algorithm for accurate tracking across server
 * restarts and load balanced deployments.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Extracts the client IP address from request headers.
 *
 * Checks x-forwarded-for and x-real-ip headers which are commonly set by
 * reverse proxies and load balancers. Falls back to "unknown" if no IP is found.
 *
 * @param request - The incoming Next.js request
 * @returns The client IP address or "unknown"
 */
function getClientIp(request: NextRequest): string {
  // Check x-forwarded-for header (may contain multiple IPs, take the first)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // Check x-real-ip header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback for when IP cannot be determined
  return "unknown";
}

/**
 * Middleware function that applies rate limiting to authentication endpoints.
 *
 * This middleware:
 * 1. Extracts the client IP address from request headers
 * 2. Checks the rate limit for the IP + endpoint combination
 * 3. Returns 429 with Retry-After header if limit exceeded
 * 4. Otherwise allows the request to proceed
 *
 * The rate limit is persisted to the database, so it works correctly across
 * server restarts, multiple instances, and in production environments.
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse - Either a 429 rate limit response or next()
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Extract client IP address
  const ip = getClientIp(request);

  // Get the request path for rate limit tracking
  const endpoint = request.nextUrl.pathname;

  // Check rate limit for this IP + endpoint
  const result = await rateLimit(ip, endpoint, RATE_LIMITS.AUTH);

  // If rate limit exceeded, return 429 response
  if (!result.success) {
    // Calculate seconds until rate limit resets
    const retryAfter = Math.ceil(
      (result.reset.getTime() - Date.now()) / 1000
    );

    return NextResponse.json(
      {
        error: "Rate Limit Exceeded",
        message: "Too many requests. Please try again later.",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMITS.AUTH.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": result.reset.toISOString(),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(RATE_LIMITS.AUTH.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", result.reset.toISOString());

  return response;
}

/**
 * Middleware configuration
 *
 * Specifies which routes this middleware should apply to.
 * Using matcher to only apply rate limiting to authentication endpoints.
 */
export const config = {
  matcher: "/api/auth/:path*",
};
