import { prisma } from "@/lib/prisma";

/**
 * Rate limit configuration options.
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the time window.
   */
  limit: number;
  /**
   * Time window in milliseconds (e.g., 60000 for 1 minute).
   */
  windowMs: number;
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed (true) or rate limited (false).
   */
  success: boolean;
  /**
   * Number of requests remaining in the current window.
   * Will be 0 if rate limit is exceeded.
   */
  remaining: number;
  /**
   * Timestamp when the rate limit window resets.
   */
  reset: Date;
}

/**
 * Predefined rate limit configurations for different endpoint types.
 */
export const RATE_LIMITS = {
  /**
   * Strict rate limit for authentication endpoints.
   * 5 requests per 15 minutes to prevent brute force attacks.
   */
  AUTH: { limit: 5, windowMs: 15 * 60 * 1000 },
  /**
   * Moderate rate limit for AI endpoints.
   * 20 requests per minute to prevent cost abuse.
   */
  AI: { limit: 20, windowMs: 60 * 1000 },
  /**
   * Generous rate limit for email operations.
   * 100 requests per minute for normal user activity.
   */
  EMAIL: { limit: 100, windowMs: 60 * 1000 },
  /**
   * Strict rate limit for resource-intensive sync operations.
   * 10 requests per 5 minutes.
   */
  SYNC: { limit: 10, windowMs: 5 * 60 * 1000 },
} as const;

/**
 * Implements sliding window rate limiting with Prisma persistence.
 *
 * This function tracks API requests per identifier (userId or IP address) and
 * enforces configurable rate limits using a sliding window algorithm. Rate limit
 * data is persisted in the database to work across server restarts and load balanced
 * deployments.
 *
 * Algorithm:
 * 1. Calculate the current window start time
 * 2. Find or create a rate limit record for the identifier + endpoint
 * 3. If the record is within the current window, increment the count
 * 4. If the record is from a previous window, reset the count
 * 5. Return success/failure with remaining requests and reset time
 *
 * @param identifier - Unique identifier for the requester (userId or IP address)
 * @param endpoint - API endpoint path (e.g., "/api/ai/categorize")
 * @param config - Rate limit configuration (limit and window size)
 * @returns Promise resolving to rate limit result
 *
 * @example
 * ```typescript
 * // Check rate limit for authenticated user
 * const result = await rateLimit(session.user.id, "/api/ai/categorize", RATE_LIMITS.AI);
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: "Rate limit exceeded" },
 *     { status: 429, headers: { "Retry-After": String(Math.ceil((result.reset.getTime() - Date.now()) / 1000)) } }
 *   );
 * }
 *
 * // Check rate limit for unauthenticated request by IP
 * const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
 * const result = await rateLimit(ip, "/api/auth/signin", RATE_LIMITS.AUTH);
 * ```
 */
export async function rateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const windowStart = new Date(now - config.windowMs);

    // Find the most recent rate limit record for this identifier and endpoint
    const existingRecord = await prisma.rateLimitLog.findFirst({
      where: {
        identifier,
        endpoint,
      },
      orderBy: {
        windowStart: "desc",
      },
    });

    let requestCount = 1;
    let recordWindowStart = new Date(now);

    if (existingRecord) {
      // Check if the existing record is within the current window
      if (existingRecord.windowStart >= windowStart) {
        // Still within the current window, increment the count
        requestCount = existingRecord.requestCount + 1;
        recordWindowStart = existingRecord.windowStart;

        // Update the existing record
        await prisma.rateLimitLog.update({
          where: { id: existingRecord.id },
          data: {
            requestCount,
            updatedAt: new Date(),
          },
        });
      } else {
        // Window has expired, create a new record
        await prisma.rateLimitLog.create({
          data: {
            identifier,
            endpoint,
            requestCount: 1,
            windowStart: recordWindowStart,
          },
        });
      }
    } else {
      // No existing record, create a new one
      await prisma.rateLimitLog.create({
        data: {
          identifier,
          endpoint,
          requestCount: 1,
          windowStart: recordWindowStart,
        },
      });
    }

    // Calculate when the current window resets
    const reset = new Date(recordWindowStart.getTime() + config.windowMs);

    // Determine if the request should be allowed
    const success = requestCount <= config.limit;
    const remaining = Math.max(0, config.limit - requestCount);

    return {
      success,
      remaining,
      reset,
    };
  } catch (error) {
    // On error, fail open to avoid blocking legitimate requests
    // Log error in development mode for debugging
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Rate limit check failed:", error);
    }

    // Return a permissive result to avoid service disruption
    return {
      success: true,
      remaining: config.limit - 1,
      reset: new Date(Date.now() + config.windowMs),
    };
  }
}

/**
 * Helper function to clean up old rate limit records.
 *
 * This should be called periodically (e.g., via a cron job) to prevent
 * the RateLimitLog table from growing indefinitely. It deletes records
 * older than the specified retention period.
 *
 * @param retentionMs - How long to keep rate limit records (default: 24 hours)
 * @returns Promise resolving to the number of deleted records
 *
 * @example
 * ```typescript
 * // Clean up records older than 24 hours
 * const deletedCount = await cleanupRateLimitLogs();
 * console.log(`Deleted ${deletedCount} old rate limit records`);
 * ```
 */
export async function cleanupRateLimitLogs(
  retentionMs: number = 24 * 60 * 60 * 1000
): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - retentionMs);

    const result = await prisma.rateLimitLog.deleteMany({
      where: {
        windowStart: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to clean up rate limit logs:", error);
    }
    return 0;
  }
}
