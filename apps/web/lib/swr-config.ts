import type { SWRConfiguration } from "swr";

/**
 * SWR configuration presets optimized for different data types
 */

// For frequently changing data (threads, inbox)
// - Polls every 30s
// - Revalidates on focus (user expects fresh data)
// - Dedupes requests within 5s
// - Shows stale data while revalidating
export const realtimeConfig: SWRConfiguration = {
  refreshInterval: 30000,
  revalidateOnFocus: true,
  dedupingInterval: 5000,
  keepPreviousData: true,
  errorRetryCount: 3,
};

// For semi-stable data (tags, AI summary)
// - Polls every 60s
// - No revalidation on focus (reduces request storms)
// - Dedupes requests within 10s
// - Shows stale data while revalidating
export const stableConfig: SWRConfiguration = {
  refreshInterval: 60000,
  revalidateOnFocus: false,
  dedupingInterval: 10000,
  keepPreviousData: true,
  errorRetryCount: 3,
};

// For rarely changing data (mailboxes, agents)
// - Polls every 2 minutes
// - No revalidation on focus
// - Dedupes requests within 30s
// - Shows stale data while revalidating
export const staticConfig: SWRConfiguration = {
  refreshInterval: 120000,
  revalidateOnFocus: false,
  dedupingInterval: 30000,
  keepPreviousData: true,
  errorRetryCount: 2,
};

// For expensive aggregation queries (AI summary, analytics)
// - Polls every 2 minutes
// - No revalidation on focus
// - Aggressive deduping (15s)
// - Shows stale data while revalidating
// - Fewer retries to avoid hammering expensive endpoints
export const expensiveConfig: SWRConfiguration = {
  refreshInterval: 120000,
  revalidateOnFocus: false,
  dedupingInterval: 15000,
  keepPreviousData: true,
  errorRetryCount: 2,
};

// Default fetcher with error handling
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch: ${res.status}`);
  }
  return res.json();
}
