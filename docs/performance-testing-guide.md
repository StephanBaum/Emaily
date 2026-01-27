# Email Search Performance Testing Guide

This guide documents how to verify that the email search feature meets the <500ms response time requirement.

## Performance Requirement

**Target:** All email search queries must complete in **less than 500ms** for databases with 1000+ emails.

## Testing Methods

### Method 1: Automated Performance Test Script

Run the automated performance test script:

```bash
# From project root
pnpm tsx scripts/test-search-performance.ts
```

This script:
- Checks if database has sufficient test data (1000+ emails recommended)
- Runs multiple search queries directly against the database
- Measures response times using PostgreSQL full-text search
- Calculates statistics (average, min, max response times)
- Reports pass/fail for each query against the 500ms threshold

**Expected Output:**
```
🔍 Email Search Performance Testing
============================================================
Target: All queries must complete in <500ms

📊 Checking database size...
   Emails: 1,500
   Accounts: 2
   ✓ Sufficient data for performance testing

============================================================
📈 Running Database Query Performance Tests

✓ "meeting"                         42.35ms  (   12 results)
✓ "urgent"                          38.21ms  (    8 results)
✓ "password reset"                  51.44ms  (    3 results)
...

============================================================
📊 Performance Summary

   Average response time:  45.23ms
   Minimum response time:  35.18ms
   Maximum response time:  68.92ms
   Pass rate:              100.0% (7/7)
   Threshold:              <500ms

✅ All queries passed the <500ms performance requirement!
```

### Method 2: Manual Browser Testing

Test search performance using browser DevTools:

1. **Start the development server:**
   ```bash
   pnpm dev:web
   ```

2. **Open the application:**
   - Navigate to http://localhost:3000/inbox
   - Ensure you're signed in with an account that has emails synced

3. **Open DevTools Network tab:**
   - Press `F12` to open DevTools
   - Click on the "Network" tab
   - Enable "Preserve log" to keep results between navigations

4. **Perform test searches:**
   - Use the search bar at the top of the inbox
   - Try various queries:
     - Single words: "meeting", "urgent", "invoice"
     - Multi-word phrases: "password reset", "quarterly report"
     - Sender filters: Use the filters panel to filter by sender
     - Date range filters: Filter emails from specific date ranges
     - Attachment filters: Toggle "Has Attachments" filter

5. **Measure response times:**
   - Find the `/api/emails/search?q=...` request in the Network tab
   - Check the "Time" column for the request duration
   - Verify it's consistently under 500ms

6. **Test with different scenarios:**
   - Empty query (should still respond quickly)
   - Very common terms (might return many results)
   - Rare terms (should return few results)
   - Multiple filters combined
   - Pagination (page 1, 2, 3, etc.)

### Method 3: API Performance Testing with curl

Test the API directly using curl with timing:

```bash
# Single query test
time curl -X GET \
  'http://localhost:3000/api/emails/search?q=meeting' \
  -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN'

# Query with filters
time curl -X GET \
  'http://localhost:3000/api/emails/search?q=invoice&hasAttachments=true&limit=50' \
  -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN'
```

To get your session token:
1. Open DevTools → Application → Cookies
2. Find the `next-auth.session-token` cookie
3. Copy its value

## Database Optimization

The search performance relies on these PostgreSQL optimizations:

### 1. GIN Index on searchVector

```sql
CREATE INDEX IF NOT EXISTS "Email_searchVector_idx"
ON "Email" USING gin("searchVector");
```

This index enables fast full-text search queries using the tsvector field.

### 2. Trigger for Automatic Search Vector Updates

```sql
CREATE OR REPLACE FUNCTION update_email_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.sender, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_search_vector_update
BEFORE INSERT OR UPDATE ON "Email"
FOR EACH ROW EXECUTE FUNCTION update_email_search_vector();
```

This ensures the search vector is always up-to-date without manual maintenance.

### 3. Composite Indices

```sql
-- Index on (accountId, receivedAt) for filtering and sorting
CREATE INDEX "Email_accountId_receivedAt_idx" ON "Email"("accountId", "receivedAt");

-- Index on category for category filtering
CREATE INDEX "Email_category_idx" ON "Email"("category");
```

## Performance Benchmarks

Expected performance for various database sizes:

| Email Count | Avg Response Time | Notes |
|-------------|-------------------|-------|
| 100         | ~10-20ms          | Very fast, mostly overhead |
| 1,000       | ~30-50ms          | Well within target |
| 10,000      | ~80-150ms         | Still acceptable |
| 100,000     | ~200-350ms        | Should still pass |
| 1,000,000+  | ~400-600ms        | May need additional optimization |

## Troubleshooting Slow Queries

If queries are taking longer than 500ms:

### 1. Check if indices exist

```sql
-- List all indices on Email table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Email';
```

Expected indices:
- `Email_pkey` (primary key on id)
- `Email_messageId_key` (unique on messageId)
- `Email_searchVector_idx` (GIN on searchVector) ← Most important for search!
- `Email_accountId_receivedAt_idx` (composite)
- `Email_category_idx`

### 2. Verify search vector is populated

```sql
-- Check if searchVector is populated
SELECT
  COUNT(*) as total,
  COUNT("searchVector") as with_vector,
  COUNT(*) - COUNT("searchVector") as without_vector
FROM "Email";
```

If `without_vector` is not zero, run the backfill query from the migration.

### 3. Analyze query performance

```sql
-- Use EXPLAIN ANALYZE to see query execution plan
EXPLAIN ANALYZE
SELECT
  id, subject, sender,
  ts_rank("searchVector", to_tsquery('english', 'meeting')) as rank
FROM "Email"
WHERE "accountId" = 'some-account-id'
  AND "searchVector" @@ to_tsquery('english', 'meeting')
ORDER BY rank DESC
LIMIT 50;
```

Look for:
- "Bitmap Heap Scan" with "Bitmap Index Scan" on `Email_searchVector_idx` ← Good!
- "Seq Scan" on Email ← Bad! Index not being used

### 4. Rebuild indices if necessary

```sql
-- Rebuild GIN index (may take a while for large tables)
REINDEX INDEX "Email_searchVector_idx";

-- Vacuum and analyze for better query planning
VACUUM ANALYZE "Email";
```

### 5. Consider additional optimizations

If performance is still poor with large datasets:

- **Result caching:** Cache popular search queries using Redis
- **Partial indices:** Create indices for specific common filters
- **Materialized views:** Pre-compute common search patterns
- **Search result pagination:** Limit initial results to 20-30 items
- **Query result limiting:** Set a maximum result set size

## Success Criteria

The performance testing is considered **PASSED** if:

- ✅ All automated test queries complete in <500ms
- ✅ Manual browser testing shows consistent <500ms response times
- ✅ Database has 1000+ emails for realistic testing
- ✅ All required database indices are created
- ✅ Search vector field is populated for all emails

## Documentation

Performance test results should be documented in build-progress.txt:

```
[2026-01-27] Subtask subtask-5-1 COMPLETED
- Ran automated performance tests with 1,500 emails in database
- Results:
  * Average response time: 45.23ms
  * Maximum response time: 68.92ms
  * Pass rate: 100% (7/7 test queries)
  * All queries completed well under the 500ms threshold
- Manual browser testing confirmed:
  * Search bar responds instantly to input (debounced 300ms)
  * API requests complete in 40-80ms range
  * Network tab shows consistent performance
  * No performance degradation with filters applied
- Database optimization verified:
  * GIN index on searchVector: ✓ Created
  * Trigger for automatic updates: ✓ Active
  * All emails have searchVector populated: ✓ Confirmed
- Conclusion: ✅ Search performance meets <500ms requirement
```
