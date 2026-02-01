# Analytics

> Observability and telemetry tracking for application behavior and performance.

Analytics events capture facts about how the system is being used, track performance metrics, and provide insights into user behavior. Unlike domain events (which record business facts like "book acquired"), analytics events record observability data like HTTP requests, error rates, and user interactions.

All analytics events use the `analytics.*` prefix in their event_type and are stored in the same `events` table as domain events, following the event-sourcing pattern. See [Retention Policy](#retention-policy) below for cleanup details.

## HTTP Request Analytics

> Tracks API request performance, errors, and usage patterns.

Every HTTP request to the API is recorded with performance metrics, status codes, and user context. This enables analysis of API usage patterns, error rates, latency percentiles, and endpoint performance.

```typescript
export type HttpRequestEvent = {
  request_id: string;
  method: string;
  path: string; // Normalized: /api/books/{id}
  status_code: number;
  duration_ms: number;
  user_id: number | null;
  user_agent?: string;
};
```

**Event type:** `analytics.http_request`

**Example data:**

```json
{
  "request_id": "req_abc123",
  "method": "POST",
  "path": "/api/books",
  "status_code": 201,
  "duration_ms": 45,
  "user_id": 42,
  "user_agent": "Mozilla/5.0..."
}
```

## HTTP Error Analytics

> Captures detailed error information for debugging and monitoring.

When requests fail, we record comprehensive error details including stack traces, error messages, and request context. This enables root cause analysis and error pattern detection.

```typescript
export type HttpErrorEvent = {
  request_id: string;
  method: string;
  path: string;
  error_message: string;
  error_stack?: string;
  error_code?: string;
  user_id: number | null;
};
```

**Event type:** `analytics.http_error`

**Example data:**

```json
{
  "request_id": "req_xyz789",
  "method": "GET",
  "path": "/api/books/{id}",
  "error_message": "Book not found",
  "error_code": "BOOK_NOT_FOUND",
  "user_id": 42
}
```

## Metadata Lookup Analytics

> Tracks external provider performance and success rates.

Book metadata lookups query multiple external APIs (Google Books, Open Library, etc.). We track each provider's response time, success rate, and which identifiers work best with which providers.

```typescript
export type MetadataProviderResult = {
  name: string;
  success: boolean;
  duration_ms: number;
  error_message?: string;
};

export type MetadataLookupEvent = {
  request_id: string;
  identifier: string;
  identifier_type: 'isbn' | 'lccn' | 'oclc' | 'title';
  providers: MetadataProviderResult[];
  results_count: number;
  user_id: number | null;
};
```

**Event type:** `analytics.metadata_lookup`

**Example data:**

```json
{
  "request_id": "req_lookup_123",
  "identifier": "9780134757599",
  "identifier_type": "isbn",
  "providers": [
    {
      "name": "google_books",
      "success": true,
      "duration_ms": 120
    },
    {
      "name": "open_library",
      "success": false,
      "duration_ms": 5000,
      "error_message": "Timeout"
    },
    {
      "name": "loc",
      "success": true,
      "duration_ms": 340
    }
  ],
  "results_count": 2,
  "user_id": 42
}
```

**Insights enabled:**

- Which provider is fastest/most reliable
- Which identifiers have best success rates (ISBNs vs LCCNs)
- Provider degradation detection
- Optimal provider ordering for performance

## User Session Analytics

> Tracks user session lifecycle and duration.

Sessions track when users start and end their authenticated activity, enabling session duration analysis, activity patterns, and user retention metrics.

```typescript
export type UserSessionStartedEvent = {
  user_id: number;
  session_id: string;
  auth_method: 'password' | 'passkey' | 'oauth_google' | 'oauth_github' | 'api_key';
  request_id: string;
};

export type UserSessionEndedEvent = {
  user_id: number;
  session_id: string;
  duration_seconds: number;
  request_id: string;
};
```

**Event types:**

- `analytics.user_session_started`
- `analytics.user_session_ended`

**Example data (session start):**

```json
{
  "user_id": 42,
  "session_id": "sess_abc123",
  "auth_method": "password",
  "request_id": "req_login_789"
}
```

## User Milestone Analytics

> Captures significant user journey events.

Milestones track key moments in the user lifecycle: registration, first book added, feature adoption, etc. This enables cohort analysis, onboarding funnel optimization, and retention tracking.

```typescript
export type UserMilestoneEvent = {
  user_id: number;
  milestone:
    | 'registration'
    | 'first_book_added'
    | 'first_metadata_lookup'
    | 'first_book_deleted'
    | 'collection_size_10'
    | 'collection_size_50'
    | 'collection_size_100';
  auth_method?: string;
  request_id: string;
  metadata?: Record<string, unknown>;
  days_since_registration?: number;
};
```

**Event type:** `analytics.user_milestone`

**Example data:**

```json
{
  "user_id": 42,
  "milestone": "first_book_added",
  "request_id": "req_book_create_456",
  "metadata": {
    "book_entity_id": 100,
    "book_type": "physical"
  },
  "days_since_registration": 0
}
```

**Milestones tracked:**

- `registration` - User account created
- `first_book_added` - First book in collection
- `first_metadata_lookup` - First use of metadata search
- `first_book_deleted` - First deletion (collection curation)
- `collection_size_10/50/100` - Collection growth milestones

## Feature Usage Analytics

> Tracks adoption and usage of specific application features.

Feature usage events track which features are being used, by whom, and how often. This informs product decisions about which features to invest in.

```typescript
export type FeatureUsageEvent = {
  user_id: number | null;
  feature: string;
  action: string;
  request_id: string;
  metadata?: Record<string, unknown>;
};
```

**Event type:** `analytics.feature_used`

**Example data:**

```json
{
  "user_id": 42,
  "feature": "metadata_lookup",
  "action": "searched_isbn",
  "request_id": "req_feature_123",
  "metadata": {
    "provider": "google_books",
    "success": true
  }
}
```

## Retention Policy

> Analytics events have a 90-day retention window, domain events are kept indefinitely.

Analytics events are voided (soft-deleted) after 90 days to manage storage growth while preserving recent data for analysis. Before voiding, key metrics are aggregated into summary events.

**Retention by event type:**

- `analytics.*` events: 90 days
- Domain events (`book_acquired`, `user_registered`, etc.): Indefinite
- `analytics.aggregated_summary`: Indefinite (contains pre-aggregated metrics)

**Storage estimates:**

- ~1KB per HTTP request event
- 10,000 requests/day = 10MB/day ≈ 300MB/month
- With 90-day retention: ~900MB steady state for HTTP analytics
- Total analytics storage (all types): ~1-2GB

**Automated cleanup:**

Retention is configurable via `ANALYTICS_RETENTION_DAYS` (default: 90). Schedule automatic cleanup:

- See [How to Schedule Analytics Cleanup](../docs/how-to/schedule-analytics-cleanup.md)
- Run manually: `bun run scripts/cleanup-analytics.ts`
- Test first: `bun run scripts/cleanup-analytics.ts --dry-run`

## Query Patterns

> Common analytics queries leverage the specialized indexes created in migration 003.

### Time-range queries by event type

```typescript
// Get all HTTP requests from the last 7 days
const recentRequests = await events.getByTimeRange(
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  new Date()
);
const httpRequests = recentRequests.filter(
  e => e.eventType === 'analytics.http_request' && !e.voidedAt
);
```

**Uses index:** `idx_events_analytics_type_occurred`

### Filter by JSONB properties

```sql
-- Find all 500 errors from the last day
SELECT * FROM events
WHERE event_type = 'analytics.http_request'
  AND data @> '{"status_code": 500}'::jsonb
  AND occurred_at >= NOW() - INTERVAL '1 day'
  AND voided_at IS NULL
ORDER BY occurred_at DESC;
```

**Uses index:** `idx_events_analytics_data` (GIN index on JSONB)

### Daily active users

```typescript
// Count unique users who logged in each day
const loginEvents = await events.getByType('analytics.user_session_started');
const dau = new Map<string, Set<number>>();

for (const event of loginEvents) {
  const date = event.occurredAt.toISOString().split('T')[0];
  const userId = (event.data as UserSessionStartedEvent).user_id;
  if (!dau.has(date)) dau.set(date, new Set());
  dau.get(date)!.add(userId);
}

const dailyCounts = new Map(
  [...dau].map(([date, users]) => [date, users.size])
);
```

### Latency percentiles

```typescript
// Calculate p50, p95, p99 latencies for an endpoint
const requests = await events.findByData('analytics.http_request', {
  path: '/api/books'
});

const durations = requests
  .map(e => (e.data as HttpRequestEvent).duration_ms)
  .sort((a, b) => a - b);

const p50 = durations[Math.floor(durations.length * 0.50)];
const p95 = durations[Math.floor(durations.length * 0.95)];
const p99 = durations[Math.floor(durations.length * 0.99)];
```

### Provider performance comparison

```sql
-- Average response time by metadata provider
SELECT
  provider->>'name' as provider_name,
  AVG((provider->>'duration_ms')::numeric) as avg_duration_ms,
  SUM(CASE WHEN provider->>'success' = 'true' THEN 1 ELSE 0 END) as success_count,
  COUNT(*) as total_calls,
  ROUND(
    100.0 * SUM(CASE WHEN provider->>'success' = 'true' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as success_rate_pct
FROM events,
  jsonb_array_elements(data->'providers') as provider
WHERE event_type = 'analytics.metadata_lookup'
  AND occurred_at >= NOW() - INTERVAL '30 days'
  AND voided_at IS NULL
GROUP BY provider->>'name'
ORDER BY avg_duration_ms ASC;
```

## Performance Considerations

> Analytics recording adds <5ms overhead per request and uses partial indexes for efficiency.

**Write performance:**

- Analytics events recorded asynchronously (non-blocking)
- Database connection pooling handles concurrent writes
- Target overhead: <5ms per HTTP request
- Error handling: analytics failures don't break app functionality

**Query performance:**

- Partial indexes reduce index size (only analytics events)
- GIN indexes enable fast JSONB filtering
- Time-range queries optimized with composite index
- Target: <100ms for typical 7-day analytics queries

**Storage optimization:**

- 90-day retention policy prevents unbounded growth
- Partial indexes (exclude voided events) save space
- JSONB compression reduces storage overhead
- Pre-aggregation before voiding preserves trends

## Integration Points

> Analytics events are recorded automatically via middleware and route handlers.

**HTTP Middleware** ([server/src/metrics/request-metrics.ts](../server/src/metrics/request-metrics.ts)):

- Records `analytics.http_request` for every request
- Records `analytics.http_error` for failed requests
- Captures duration, status, user context

**Metadata Lookup** ([server/src/routes/books.ts](../server/src/routes/books.ts)):

- Records `analytics.metadata_lookup` after provider queries
- Tracks provider performance and success rates

**Authentication** ([server/src/auth/routes.ts](../server/src/auth/routes.ts)):

- Records `analytics.user_milestone` on registration
- Records `analytics.user_session_started` on login
- Records `analytics.user_session_ended` on logout

**Book Operations** ([server/src/routes/books.ts](../server/src/routes/books.ts)):

- Records `analytics.user_milestone` for first book
- Records `analytics.feature_used` for various features

## Related Documentation

- [Event Sourcing](../docs/explanation/event-sourcing.md) - Events vs entities architecture
- [Run Migrations](../docs/how-to/run-migrations.md) - Database migration guide
- [Analytics Service](../server/src/analytics/README.md) - Service layer implementation
- [Analytics Queries](../server/src/analytics/queries.ts) - Common query patterns

## Future Enhancements

**Short-term:**

- Frontend telemetry (page views, clicks)
- Materialized views for dashboards
- Real-time analytics endpoint

**Medium-term:**

- Session duration tracking
- User cohort analysis
- A/B testing framework
- OpenTelemetry exporter

**Long-term:**

- Anomaly detection
- Predictive analytics
- Data warehouse export
- Custom dashboards
