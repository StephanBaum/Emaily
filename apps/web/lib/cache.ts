import Redis from "ioredis";

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
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
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
