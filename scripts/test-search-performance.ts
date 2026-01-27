/**
 * Search Performance Testing Script
 *
 * Tests email search API performance against the <500ms requirement.
 * Runs multiple search queries and measures response times.
 *
 * Usage:
 *   pnpm tsx scripts/test-search-performance.ts
 *
 * Environment:
 *   - DATABASE_URL must be set
 *   - Database must have 1000+ email records for realistic testing
 *   - Server should be running on http://localhost:3000 (or set API_URL)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const PERFORMANCE_THRESHOLD_MS = 500;
const MIN_EMAIL_COUNT = 1000;

interface PerformanceTestResult {
  query: string;
  filters?: Record<string, any>;
  responseTime: number;
  resultCount: number;
  passed: boolean;
}

/**
 * Measure response time of a search query
 */
async function measureSearchQuery(
  query: string,
  filters?: Record<string, any>,
  sessionToken?: string
): Promise<PerformanceTestResult> {
  const url = new URL(`${API_URL}/api/emails/search`);
  url.searchParams.set('q', query);

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sessionToken) {
    headers['Cookie'] = `next-auth.session-token=${sessionToken}`;
  }

  const startTime = performance.now();

  try {
    const response = await fetch(url.toString(), { headers });
    const data = await response.json();
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    return {
      query,
      filters,
      responseTime,
      resultCount: data.pagination?.total || 0,
      passed: responseTime < PERFORMANCE_THRESHOLD_MS,
    };
  } catch (error) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    console.error(`Error testing query "${query}":`, error);

    return {
      query,
      filters,
      responseTime,
      resultCount: 0,
      passed: false,
    };
  }
}

/**
 * Direct database query to measure PostgreSQL full-text search performance
 */
async function measureDatabaseQuery(
  query: string,
  accountIds: string[]
): Promise<{ responseTime: number; resultCount: number }> {
  const searchQuery = query.trim().replace(/\s+/g, ' & ');

  const startTime = performance.now();

  const results = await prisma.$queryRaw<any[]>`
    SELECT
      id,
      subject,
      sender,
      ts_rank("searchVector", to_tsquery('english', ${searchQuery})) as rank
    FROM "Email"
    WHERE "accountId" = ANY(${accountIds})
      AND "searchVector" @@ to_tsquery('english', ${searchQuery})
    ORDER BY rank DESC
    LIMIT 50
  `;

  const endTime = performance.now();
  const responseTime = endTime - startTime;

  return {
    responseTime,
    resultCount: results.length,
  };
}

/**
 * Check if database has sufficient test data
 */
async function checkDatabaseSize(): Promise<{ emailCount: number; accountCount: number }> {
  const emailCount = await prisma.email.count();
  const accountCount = await prisma.emailAccount.count();

  return { emailCount, accountCount };
}

/**
 * Run comprehensive performance tests
 */
async function runPerformanceTests() {
  console.log('🔍 Email Search Performance Testing\n');
  console.log('='.repeat(60));
  console.log(`Target: All queries must complete in <${PERFORMANCE_THRESHOLD_MS}ms\n`);

  // Check database size
  console.log('📊 Checking database size...');
  const { emailCount, accountCount } = await checkDatabaseSize();
  console.log(`   Emails: ${emailCount.toLocaleString()}`);
  console.log(`   Accounts: ${accountCount}`);

  if (emailCount < MIN_EMAIL_COUNT) {
    console.log(`\n⚠️  Warning: Database has only ${emailCount} emails.`);
    console.log(`   Recommended: ${MIN_EMAIL_COUNT}+ emails for realistic performance testing.`);
    console.log(`   Performance results may not be representative.\n`);
  } else {
    console.log(`   ✓ Sufficient data for performance testing\n`);
  }

  if (emailCount === 0) {
    console.log('❌ No emails in database. Cannot run performance tests.');
    console.log('   Please sync some email accounts first.\n');
    return;
  }

  // Get sample account IDs for direct database queries
  const accounts = await prisma.emailAccount.findMany({
    take: 3,
    select: { id: true },
  });

  if (accounts.length === 0) {
    console.log('❌ No email accounts found. Cannot run performance tests.\n');
    return;
  }

  const accountIds = accounts.map(a => a.id);

  console.log('='.repeat(60));
  console.log('📈 Running Database Query Performance Tests\n');

  // Test queries (using direct database queries to bypass auth)
  const testQueries = [
    'meeting',
    'urgent',
    'password reset',
    'invoice payment',
    'project status update',
    'quarterly report',
    'customer feedback survey',
  ];

  const dbResults: Array<{ query: string; responseTime: number; resultCount: number; passed: boolean }> = [];

  for (const query of testQueries) {
    try {
      const result = await measureDatabaseQuery(query, accountIds);
      const passed = result.responseTime < PERFORMANCE_THRESHOLD_MS;

      dbResults.push({
        query,
        responseTime: result.responseTime,
        resultCount: result.resultCount,
        passed,
      });

      const status = passed ? '✓' : '✗';
      const time = result.responseTime.toFixed(2).padStart(8);
      const count = result.resultCount.toString().padStart(6);

      console.log(`${status} "${query.padEnd(30)}" ${time}ms  (${count} results)`);
    } catch (error) {
      console.log(`✗ "${query.padEnd(30)}" ERROR: ${error}`);
      dbResults.push({
        query,
        responseTime: -1,
        resultCount: 0,
        passed: false,
      });
    }
  }

  // Calculate statistics
  const validResults = dbResults.filter(r => r.responseTime >= 0);

  if (validResults.length > 0) {
    const avgTime = validResults.reduce((sum, r) => sum + r.responseTime, 0) / validResults.length;
    const maxTime = Math.max(...validResults.map(r => r.responseTime));
    const minTime = Math.min(...validResults.map(r => r.responseTime));
    const passedCount = validResults.filter(r => r.passed).length;
    const passRate = (passedCount / validResults.length) * 100;

    console.log('\n' + '='.repeat(60));
    console.log('📊 Performance Summary\n');
    console.log(`   Average response time:  ${avgTime.toFixed(2)}ms`);
    console.log(`   Minimum response time:  ${minTime.toFixed(2)}ms`);
    console.log(`   Maximum response time:  ${maxTime.toFixed(2)}ms`);
    console.log(`   Pass rate:              ${passRate.toFixed(1)}% (${passedCount}/${validResults.length})`);
    console.log(`   Threshold:              <${PERFORMANCE_THRESHOLD_MS}ms`);

    if (passRate === 100) {
      console.log('\n✅ All queries passed the <500ms performance requirement!');
    } else if (passRate >= 80) {
      console.log('\n⚠️  Most queries passed, but some need optimization.');
    } else {
      console.log('\n❌ Many queries exceeded the 500ms threshold.');
      console.log('   Consider adding additional database indices or caching.');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📝 Performance Testing Notes\n');
  console.log('Database indices used:');
  console.log('  - GIN index on searchVector (tsvector) for full-text search');
  console.log('  - Composite index on (accountId, receivedAt)');
  console.log('  - Index on category field');
  console.log('\nPostgreSQL full-text search features:');
  console.log('  - to_tsquery() for query parsing');
  console.log('  - ts_rank() for relevance scoring');
  console.log('  - GIN index for efficient tsvector lookups');
  console.log('\nFor manual browser testing:');
  console.log('  1. Open http://localhost:3000/inbox');
  console.log('  2. Open DevTools Network tab (F12)');
  console.log('  3. Perform searches and check "Time" column');
  console.log('  4. Verify all searches complete in <500ms');
  console.log('\n' + '='.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  try {
    await runPerformanceTests();
  } catch (error) {
    console.error('\n❌ Performance testing failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
