# Rate Limiting Manual Testing Guide

This document provides instructions for manually testing the rate limiting implementation across all API endpoints.

## Overview

Rate limiting has been implemented for the following endpoint categories:

| Endpoint Type | Rate Limit | Window | Identifier |
|--------------|------------|--------|------------|
| Auth endpoints (`/api/auth/*`) | 5 requests | 15 minutes | IP address |
| AI endpoints (`/api/ai/*`) | 20 requests | 1 minute | User ID |
| Email endpoints (`/api/emails`) | 100 requests | 1 minute | User ID |
| Sync endpoints (`/api/emails/sync`) | 10 requests | 5 minutes | User ID |

## Prerequisites

1. **Development Server**: Start the dev server
   ```bash
   pnpm dev:web
   ```

2. **Authentication** (for AI and Email endpoints):
   - Navigate to http://localhost:3000
   - Sign in to get a valid session
   - Get your session cookie from browser DevTools:
     - Open DevTools (F12)
     - Go to Application/Storage tab
     - Find `next-auth.session-token` cookie
     - Copy the full cookie string: `next-auth.session-token=<value>`

## Test Method 1: Automated Test Script

The automated test script can test all endpoints:

```bash
# Test auth endpoint only (no authentication required)
node test-rate-limits.js

# Test all endpoints (requires authentication)
node test-rate-limits.js "next-auth.session-token=your-session-token"
```

## Test Method 2: Manual cURL Commands

### Test 1: Auth Endpoint (IP-based)

**Expected behavior**: 6th request should return 429

```bash
# Make 6 requests to the auth session endpoint
for i in {1..6}; do
  echo "Request $i:"
  curl -i http://localhost:3000/api/auth/session
  echo ""
done
```

**Expected results**:
- Requests 1-5: Status 200 (or 401 if not authenticated)
- Request 6: Status 429 with:
  - `Retry-After` header indicating seconds until reset
  - `X-RateLimit-Limit: 5`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset` header with ISO timestamp
  - JSON body: `{"error": "Rate Limit Exceeded", "message": "Too many requests. Please try again later.", "retryAfter": <seconds>}`

### Test 2: AI Endpoint (User-based)

**Expected behavior**: 21st request should return 429

```bash
# Replace YOUR_SESSION_COOKIE with your actual session cookie
COOKIE="next-auth.session-token=your-session-token"

# Make 21 requests to the AI categorize endpoint
for i in {1..21}; do
  echo "Request $i:"
  curl -i -X POST http://localhost:3000/api/ai/categorize \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d '{"subject":"Test email '$i'","body":"This is a test email for rate limiting."}'
  echo ""
done
```

**Expected results**:
- Requests 1-20: Status 200 (successful categorization)
- Request 21: Status 429 with:
  - `Retry-After` header
  - `X-RateLimit-Limit: 20`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset` header
  - JSON body: `{"error": "Rate limit exceeded", "message": "Too many requests. Please try again in <N> seconds."}`

### Test 3: Email Endpoint (User-based)

**Expected behavior**: 101st request should return 429

```bash
# Replace YOUR_SESSION_COOKIE with your actual session cookie
COOKIE="next-auth.session-token=your-session-token"

# Make 101 requests to the emails endpoint
for i in {1..101}; do
  echo "Request $i:"
  curl -i http://localhost:3000/api/emails \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE"

  # Show progress every 10 requests
  if [ $((i % 10)) -eq 0 ]; then
    echo "Progress: $i/101"
  fi
done
```

**Expected results**:
- Requests 1-100: Status 200 (successful email list retrieval)
- Request 101: Status 429 with:
  - `Retry-After` header
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset` header

## Test Method 3: Browser Console

For authenticated endpoints, you can use the browser console:

```javascript
// Test AI endpoint (run in browser console while logged in)
async function testAIRateLimit() {
  for (let i = 1; i <= 21; i++) {
    const response = await fetch('/api/ai/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: `Test email ${i}`,
        body: 'This is a test email for rate limiting.'
      })
    });

    console.log(`Request ${i}: ${response.status}`);

    if (response.status === 429) {
      const data = await response.json();
      console.log('Rate limited:', data);
      console.log('Headers:', {
        'retry-after': response.headers.get('retry-after'),
        'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
        'x-ratelimit-reset': response.headers.get('x-ratelimit-reset')
      });
      break;
    }
  }
}

testAIRateLimit();
```

```javascript
// Test Email endpoint (run in browser console while logged in)
async function testEmailRateLimit() {
  for (let i = 1; i <= 101; i++) {
    const response = await fetch('/api/emails');

    if (i % 10 === 0) {
      console.log(`Request ${i}: ${response.status}`);
    }

    if (response.status === 429) {
      const data = await response.json();
      console.log('Rate limited at request', i);
      console.log('Response:', data);
      console.log('Headers:', {
        'retry-after': response.headers.get('retry-after'),
        'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
        'x-ratelimit-reset': response.headers.get('x-ratelimit-reset')
      });
      break;
    }
  }
}

testEmailRateLimit();
```

## Verification Checklist

For each endpoint tested, verify:

- [ ] Rate limit triggers at the correct threshold (6th, 21st, 101st request)
- [ ] 429 status code is returned when rate limit is exceeded
- [ ] Response includes `Retry-After` header with seconds until reset
- [ ] Response includes `X-RateLimit-Limit` header with the limit value
- [ ] Response includes `X-RateLimit-Remaining` header (should be 0 when rate limited)
- [ ] Response includes `X-RateLimit-Reset` header with ISO timestamp
- [ ] Response body includes error message with helpful text
- [ ] After waiting for the rate limit window to expire, requests succeed again
- [ ] Rate limit counters are properly reset after the time window

## Rate Limit Reset Testing

To verify rate limits reset correctly:

1. Trigger a rate limit (reach the threshold)
2. Note the `X-RateLimit-Reset` timestamp
3. Wait for the time window to expire
4. Make another request
5. Verify it succeeds (not rate limited)

**For quick testing**: Temporarily modify the rate limit windows in `apps/web/src/lib/rate-limit.ts`:

```typescript
export const RATE_LIMITS = {
  AUTH: { limit: 5, windowMs: 30 * 1000 },  // 30 seconds instead of 15 minutes
  AI: { limit: 20, windowMs: 30 * 1000 },   // 30 seconds instead of 1 minute
  EMAIL: { limit: 100, windowMs: 30 * 1000 }, // 30 seconds instead of 1 minute
  SYNC: { limit: 10, windowMs: 30 * 1000 }, // 30 seconds instead of 5 minutes
};
```

**Important**: Remember to revert these changes after testing!

## Troubleshooting

### Issue: Auth endpoint not rate limiting

- Check that middleware is properly configured in `apps/web/src/middleware.ts`
- Verify the matcher config includes `/api/auth/:path*`
- Check server logs for any errors

### Issue: Authenticated endpoints return 401

- Ensure you're logged in to http://localhost:3000
- Verify your session cookie is correct and not expired
- Check the cookie name matches your NextAuth configuration

### Issue: Rate limit not resetting

- Check the `RateLimitLog` table in the database
- Verify `windowStart` timestamps are being set correctly
- Run the cleanup helper: See `cleanupRateLimitLogs()` in `apps/web/src/lib/rate-limit.ts`

### Issue: Tests fail due to existing rate limit records

- Clear the rate limit logs from the database:
  ```sql
  DELETE FROM "RateLimitLog";
  ```
- Or wait for the rate limit windows to expire

## Database Verification

Check the rate limit logs in the database:

```bash
pnpm db:studio
```

Then navigate to the `RateLimitLog` table to see:
- Identifier (IP address or user ID)
- Endpoint path
- Request count
- Window start time
- Created/updated timestamps

## Test Results

Document your test results:

| Test | Endpoint | Expected | Actual | Status |
|------|----------|----------|--------|--------|
| Auth Rate Limit | /api/auth/session | 429 on 6th | | |
| AI Rate Limit | /api/ai/categorize | 429 on 21st | | |
| Email Rate Limit | /api/emails | 429 on 101st | | |
| Headers Present | All | Retry-After, X-RateLimit-* | | |
| Reset Works | All | Succeeds after window expires | | |

## Next Steps

After completing manual testing:

1. Document any issues found in build-progress.txt
2. Update the implementation_plan.json to mark this subtask as completed
3. Commit the test results
4. Proceed to the next subtask (documentation updates)
