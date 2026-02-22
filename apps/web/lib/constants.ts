// apps/web/lib/constants.ts

// Time constants
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = MS_PER_SECOND * 60;
export const MS_PER_HOUR = MS_PER_MINUTE * 60;
export const MS_PER_DAY = MS_PER_HOUR * 24;

export const STALE_THREAD_DAYS = 3;
export const STALE_THREAD_MS = STALE_THREAD_DAYS * MS_PER_DAY;

// API limits
export const NUDGE_LIMIT = 10;
export const DEFAULT_THREAD_LIMIT = 50;
export const MAX_THREAD_LIMIT = 100;
export const EMAIL_PREVIEW_LENGTH = 150;
export const SKELETON_THREAD_COUNT = 6;

// AI processing limits
export const AI_QA_PAIRS_LIMIT = 20;
export const AI_ACTIVITY_LOG_LIMIT = 20;
export const AI_COMMENTS_LIMIT = 10;
export const AI_BATCH_SIZE = 5;
export const AI_THREAD_EMAILS_LIMIT = 50;

// Redis retry config
export const REDIS_MAX_RETRIES = 3;
export const REDIS_MAX_BACKOFF_MS = 2000;
