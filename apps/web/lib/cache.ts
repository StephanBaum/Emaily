import Redis from "ioredis";
import { REDIS_MAX_RETRIES, REDIS_MAX_BACKOFF_MS } from "@/lib/constants";

const CACHE_PREFIX = "emaily:cache:";

// TTL values in seconds
export const CACHE_TTL = {
  tags: 300, // 5 minutes - changes occasionally
  mailboxes: 600, // 10 minutes - rarely changes
  agents: 600, // 10 minutes - rarely changes
  aiSummary: 60, // 1 minute - real-time but expensive query
};

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(url, {
      maxRetriesPerRequest: REDIS_MAX_RETRIES,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > REDIS_MAX_RETRIES) return null;
        return Math.min(times * 100, REDIS_MAX_BACKOFF_MS);
      },
    });

    redis.on("error", (err) => {
      console.error("[Cache] Redis error:", err.message);
    });
  }
  return redis;
}

/**
 * Get cached value by key
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    const data = await client.get(CACHE_PREFIX + key);
    if (data) {
      return JSON.parse(data) as T;
    }
    return null;
  } catch (err) {
    console.warn("[Cache] Get failed:", key, err);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const client = getRedis();
    await client.setex(CACHE_PREFIX + key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.warn("[Cache] Set failed:", key, err);
  }
}

/**
 * Invalidate cache by key
 */
export async function cacheInvalidate(key: string): Promise<void> {
  try {
    const client = getRedis();
    await client.del(CACHE_PREFIX + key);
  } catch (err) {
    console.warn("[Cache] Invalidate failed:", key, err);
  }
}

/**
 * Invalidate all keys matching pattern
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    const keys = await client.keys(CACHE_PREFIX + pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (err) {
    console.warn("[Cache] Pattern invalidate failed:", pattern, err);
  }
}

/**
 * Cache key builders for consistent key generation
 */
export const cacheKeys = {
  tags: (teamId: string) => `tags:${teamId}`,
  mailboxes: (teamId: string) => `mailboxes:${teamId}`,
  agents: (teamId: string) => `agents:${teamId}`,
  aiSummary: (teamId: string, hours: number) => `ai-summary:${teamId}:${hours}h`,
};

/**
 * Cache with automatic fetch - gets from cache or fetches and caches
 */
export async function cacheOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Cache in background (don't block response)
  cacheSet(key, data, ttlSeconds).catch(() => {});

  return data;
}

// Rate limiting configuration
const RATE_LIMIT_PREFIX = "emaily:ratelimit:";

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in the window */
  current: number;
  /** Maximum requests allowed */
  limit: number;
  /** Seconds until the window resets */
  resetIn: number;
}

/**
 * Check and increment rate limit for a given key
 * Uses sliding window with Redis INCR + EXPIRE
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${RATE_LIMIT_PREFIX}${identifier}`;

  try {
    const client = getRedis();

    // Use multi to atomically increment and set expiry
    const pipeline = client.multi();
    pipeline.incr(key);
    pipeline.ttl(key);

    const results = await pipeline.exec();

    if (!results) {
      // Redis error - fail open (allow request)
      return { allowed: true, current: 0, limit: config.maxRequests, resetIn: 0 };
    }

    const count = results[0]?.[1] as number || 1;
    let ttl = results[1]?.[1] as number || -1;

    // Set expiry on first request in window
    if (ttl === -1) {
      await client.expire(key, config.windowSeconds);
      ttl = config.windowSeconds;
    }

    const allowed = count <= config.maxRequests;

    return {
      allowed,
      current: count,
      limit: config.maxRequests,
      resetIn: ttl > 0 ? ttl : config.windowSeconds,
    };
  } catch (err) {
    console.warn("[RateLimit] Check failed:", identifier, err);
    // Fail open on Redis errors - don't block users
    return { allowed: true, current: 0, limit: config.maxRequests, resetIn: 0 };
  }
}

/**
 * Rate limit presets for different endpoints
 */
export const rateLimits = {
  // AI processing: 10 requests per minute per team
  aiProcess: { maxRequests: 10, windowSeconds: 60 },
  // AI bulk processing: 2 requests per minute per team
  aiProcessAll: { maxRequests: 2, windowSeconds: 60 },
  // Sync: 5 requests per minute per team
  sync: { maxRequests: 5, windowSeconds: 60 },
};
