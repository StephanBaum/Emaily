/**
 * Rate Limiting Test Script
 *
 * This script tests the rate limiting implementation for all API endpoints.
 * It makes multiple requests to each endpoint to verify that rate limits
 * are properly enforced.
 *
 * Prerequisites:
 * - Dev server must be running (pnpm dev:web)
 * - For authenticated endpoints, you need a valid session cookie
 *
 * Usage:
 * 1. Start the dev server: pnpm dev:web
 * 2. For authenticated endpoints: Login to http://localhost:3000 and get your session cookie
 * 3. Run this script: node test-rate-limits.js [AUTH_COOKIE]
 *
 * The script will:
 * - Test auth endpoint rate limit (5 requests per 15 minutes)
 * - Test AI endpoint rate limit (20 requests per minute)
 * - Test email endpoint rate limit (100 requests per minute)
 * - Test sync endpoint rate limit (10 requests per 5 minutes)
 * - Verify 429 responses include proper headers
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_COOKIE = process.argv[2]; // Pass session cookie as argument for authenticated tests

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Make an HTTP request with retry logic
 */
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    return {
      status: response.status,
      headers: {
        'retry-after': response.headers.get('retry-after'),
        'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
        'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
      },
      body: await response.json().catch(() => ({})),
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
    };
  }
}

/**
 * Test auth endpoint rate limiting (IP-based, no authentication required)
 */
async function testAuthEndpoint() {
  log('\n=== Testing Auth Endpoint Rate Limiting ===', 'cyan');
  log('Endpoint: /api/auth/session', 'blue');
  log('Limit: 5 requests per 15 minutes (IP-based)', 'blue');
  log('Expected: 6th request should return 429\n', 'blue');

  const results = [];

  for (let i = 1; i <= 6; i++) {
    log(`Request ${i}/6...`, 'yellow');
    const result = await makeRequest(`${BASE_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    results.push(result);

    if (result.status === 429) {
      log(`✓ Request ${i} rate limited (429)`, 'green');
      log(`  Retry-After: ${result.headers['retry-after']} seconds`, 'green');
      log(`  X-RateLimit-Limit: ${result.headers['x-ratelimit-limit']}`, 'green');
      log(`  X-RateLimit-Remaining: ${result.headers['x-ratelimit-remaining']}`, 'green');
      log(`  X-RateLimit-Reset: ${result.headers['x-ratelimit-reset']}`, 'green');
    } else {
      log(`  Status: ${result.status}`, 'yellow');
      log(`  X-RateLimit-Remaining: ${result.headers['x-ratelimit-remaining']}`, 'yellow');
    }
  }

  // Verify the 6th request was rate limited
  const sixthRequest = results[5];
  if (sixthRequest.status === 429) {
    log('\n✓ Auth endpoint rate limiting PASSED', 'green');
    log('  6th request correctly returned 429', 'green');
    log(`  Retry-After header present: ${sixthRequest.headers['retry-after']}`, 'green');
    return true;
  } else {
    log('\n✗ Auth endpoint rate limiting FAILED', 'red');
    log(`  6th request returned ${sixthRequest.status} instead of 429`, 'red');
    return false;
  }
}

/**
 * Test AI endpoint rate limiting (user-based, authentication required)
 */
async function testAIEndpoint() {
  if (!AUTH_COOKIE) {
    log('\n=== Skipping AI Endpoint Test (No Auth Cookie) ===', 'yellow');
    log('To test AI endpoints, provide a session cookie:', 'yellow');
    log('  node test-rate-limits.js "next-auth.session-token=your-token"', 'yellow');
    return null;
  }

  log('\n=== Testing AI Endpoint Rate Limiting ===', 'cyan');
  log('Endpoint: /api/ai/categorize', 'blue');
  log('Limit: 20 requests per minute (user-based)', 'blue');
  log('Expected: 21st request should return 429\n', 'blue');

  const results = [];

  for (let i = 1; i <= 21; i++) {
    if (i % 5 === 0) {
      log(`Request ${i}/21...`, 'yellow');
    }

    const result = await makeRequest(`${BASE_URL}/api/ai/categorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': AUTH_COOKIE,
      },
      body: JSON.stringify({
        subject: `Test email ${i}`,
        body: 'This is a test email for rate limiting verification.',
      }),
    });

    results.push(result);

    if (result.status === 429) {
      log(`✓ Request ${i} rate limited (429)`, 'green');
      log(`  Retry-After: ${result.headers['retry-after']} seconds`, 'green');
      log(`  X-RateLimit-Limit: ${result.headers['x-ratelimit-limit']}`, 'green');
      log(`  X-RateLimit-Remaining: ${result.headers['x-ratelimit-remaining']}`, 'green');
      break;
    }
  }

  // Verify the 21st request was rate limited
  const twentyFirstRequest = results[20];
  if (twentyFirstRequest && twentyFirstRequest.status === 429) {
    log('\n✓ AI endpoint rate limiting PASSED', 'green');
    log('  21st request correctly returned 429', 'green');
    log(`  Retry-After header present: ${twentyFirstRequest.headers['retry-after']}`, 'green');
    return true;
  } else {
    log('\n✗ AI endpoint rate limiting FAILED', 'red');
    if (twentyFirstRequest) {
      log(`  21st request returned ${twentyFirstRequest.status} instead of 429`, 'red');
    } else {
      log('  Did not reach 21st request', 'red');
    }
    return false;
  }
}

/**
 * Test email endpoint rate limiting (user-based, authentication required)
 */
async function testEmailEndpoint() {
  if (!AUTH_COOKIE) {
    log('\n=== Skipping Email Endpoint Test (No Auth Cookie) ===', 'yellow');
    log('To test email endpoints, provide a session cookie:', 'yellow');
    log('  node test-rate-limits.js "next-auth.session-token=your-token"', 'yellow');
    return null;
  }

  log('\n=== Testing Email Endpoint Rate Limiting ===', 'cyan');
  log('Endpoint: /api/emails', 'blue');
  log('Limit: 100 requests per minute (user-based)', 'blue');
  log('Expected: 101st request should return 429\n', 'blue');

  const results = [];

  log('Making 101 requests...', 'yellow');
  for (let i = 1; i <= 101; i++) {
    if (i % 10 === 0) {
      log(`  Progress: ${i}/101`, 'yellow');
    }

    const result = await makeRequest(`${BASE_URL}/api/emails`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': AUTH_COOKIE,
      },
    });

    results.push(result);

    if (result.status === 429) {
      log(`✓ Request ${i} rate limited (429)`, 'green');
      log(`  Retry-After: ${result.headers['retry-after']} seconds`, 'green');
      log(`  X-RateLimit-Limit: ${result.headers['x-ratelimit-limit']}`, 'green');
      log(`  X-RateLimit-Remaining: ${result.headers['x-ratelimit-remaining']}`, 'green');
      break;
    }
  }

  // Verify the 101st request was rate limited
  const oneHundredFirstRequest = results[100];
  if (oneHundredFirstRequest && oneHundredFirstRequest.status === 429) {
    log('\n✓ Email endpoint rate limiting PASSED', 'green');
    log('  101st request correctly returned 429', 'green');
    log(`  Retry-After header present: ${oneHundredFirstRequest.headers['retry-after']}`, 'green');
    return true;
  } else {
    log('\n✗ Email endpoint rate limiting FAILED', 'red');
    if (oneHundredFirstRequest) {
      log(`  101st request returned ${oneHundredFirstRequest.status} instead of 429`, 'red');
    } else {
      log('  Did not reach 101st request', 'red');
    }
    return false;
  }
}

/**
 * Test sync endpoint rate limiting (user-based, authentication required)
 */
async function testSyncEndpoint() {
  if (!AUTH_COOKIE) {
    log('\n=== Skipping Sync Endpoint Test (No Auth Cookie) ===', 'yellow');
    return null;
  }

  log('\n=== Testing Sync Endpoint Rate Limiting ===', 'cyan');
  log('Endpoint: /api/emails/sync', 'blue');
  log('Limit: 10 requests per 5 minutes (user-based)', 'blue');
  log('Expected: 11th request should return 429\n', 'blue');

  const results = [];

  for (let i = 1; i <= 11; i++) {
    log(`Request ${i}/11...`, 'yellow');

    const result = await makeRequest(`${BASE_URL}/api/emails/sync`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': AUTH_COOKIE,
      },
    });

    results.push(result);

    if (result.status === 429) {
      log(`✓ Request ${i} rate limited (429)`, 'green');
      log(`  Retry-After: ${result.headers['retry-after']} seconds`, 'green');
      log(`  X-RateLimit-Limit: ${result.headers['x-ratelimit-limit']}`, 'green');
      log(`  X-RateLimit-Remaining: ${result.headers['x-ratelimit-remaining']}`, 'green');
      log(`  X-RateLimit-Reset: ${result.headers['x-ratelimit-reset']}`, 'green');
    } else {
      log(`  Status: ${result.status}`, 'yellow');
      log(`  X-RateLimit-Remaining: ${result.headers['x-ratelimit-remaining']}`, 'yellow');
    }
  }

  // Verify the 11th request was rate limited
  const eleventhRequest = results[10];
  if (eleventhRequest.status === 429) {
    log('\n✓ Sync endpoint rate limiting PASSED', 'green');
    log('  11th request correctly returned 429', 'green');
    log(`  X-RateLimit-Limit should be 10: ${eleventhRequest.headers['x-ratelimit-limit']}`, 'green');
    return true;
  } else {
    log('\n✗ Sync endpoint rate limiting FAILED', 'red');
    log(`  11th request returned ${eleventhRequest.status} instead of 429`, 'red');
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('╔════════════════════════════════════════════════════╗', 'cyan');
  log('║     Rate Limiting Integration Test Suite          ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝', 'cyan');

  log(`\nBase URL: ${BASE_URL}`, 'blue');
  log(`Auth Cookie: ${AUTH_COOKIE ? 'Provided' : 'Not provided (will skip authenticated tests)'}`, 'blue');

  const results = {
    auth: await testAuthEndpoint(),
    ai: await testAIEndpoint(),
    email: await testEmailEndpoint(),
    sync: await testSyncEndpoint(),
  };

  // Summary
  log('\n╔════════════════════════════════════════════════════╗', 'cyan');
  log('║                    TEST SUMMARY                    ║', 'cyan');
  log('╚════════════════════════════════════════════════════╝', 'cyan');

  const passed = Object.values(results).filter(r => r === true).length;
  const failed = Object.values(results).filter(r => r === false).length;
  const skipped = Object.values(results).filter(r => r === null).length;

  log(`\nTotal Tests: ${passed + failed + skipped}`, 'blue');
  log(`Passed: ${passed}`, passed > 0 ? 'green' : 'reset');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
  log(`Skipped: ${skipped}`, skipped > 0 ? 'yellow' : 'reset');

  if (failed === 0 && passed > 0) {
    log('\n✓ All rate limiting tests PASSED!', 'green');
    process.exit(0);
  } else if (skipped > 0 && failed === 0) {
    log('\n⚠ Some tests were skipped (provide auth cookie for full test suite)', 'yellow');
    process.exit(0);
  } else {
    log('\n✗ Some rate limiting tests FAILED!', 'red');
    process.exit(1);
  }
}

// Run the tests
runTests().catch((error) => {
  log(`\n✗ Test execution failed: ${error.message}`, 'red');
  process.exit(1);
});
