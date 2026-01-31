# Analytics Service

This directory contains the analytics and observability infrastructure for QuailComp.

## Purpose

The analytics service records observability events to track:

- HTTP request performance and error rates
- External API provider performance (metadata lookups)
- User journey milestones (registration, first book, etc.)
- Feature adoption and usage patterns
- Session analytics

## Architecture

Analytics events are stored in the same `events` table as domain events, distinguished by the `analytics.*` event type prefix. This leverages the existing event-sourcing infrastructure while maintaining a 90-day retention policy for analytics data.

## Files

- [service.ts](service.ts) - Analytics service with type-safe event recording functions
- [queries.ts](queries.ts) - Common analytics query patterns (DAU, error rates, latency percentiles)
- [retention.ts](retention.ts) - Automated cleanup script for old analytics events
- [README.md](README.md) - This file

## Usage

### Recording Analytics Events

```typescript
import { analytics } from '@/analytics/service';

// HTTP request analytics (automatically recorded via middleware)
await analytics.recordHttpRequest({
  request_id: ctx.requestId,
  method: 'POST',
  path: '/api/books',
  status_code: 201,
  duration_ms: 45,
  user_id: ctx.user?.userId ?? null,
});

// Metadata lookup analytics
await analytics.recordMetadataLookup({
  request_id: ctx.requestId,
  identifier: '9780134757599',
  identifier_type: 'isbn',
  providers: [
    { name: 'google_books', success: true, duration_ms: 120 },
    { name: 'open_library', success: false, duration_ms: 5000, error_message: 'Timeout' },
  ],
  results_count: 1,
  user_id: ctx.user?.userId ?? null,
});

// User milestone analytics
await analytics.recordUserMilestone({
  user_id: 42,
  milestone: 'first_book_added',
  request_id: ctx.requestId,
});
```

### Querying Analytics Data

```typescript
import {
  getDailyActiveUsers,
  getHttpErrorRate,
  getMetadataProviderStats,
  getLatencyPercentiles,
} from '@/analytics/queries';

// Daily active users for last 7 days
const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const endDate = new Date();
const dau = await getDailyActiveUsers(startDate, endDate);

// HTTP error rate for specific endpoint
const errorRate = await getHttpErrorRate(startDate, endDate, '/api/books');

// Metadata provider performance
const providerStats = await getMetadataProviderStats(startDate, endDate);

// Latency percentiles (p50, p95, p99)
const latency = await getLatencyPercentiles(startDate, endDate, '/api/books');
```

### Running Retention Cleanup

```bash
# Manual cleanup
bun run server/src/analytics/retention.ts

# Add to cron (daily at 2am)
0 2 * * * cd /path/to/quailcomp && bun run server/src/analytics/retention.ts
```

## Event Types

All analytics events use the `analytics.*` prefix:

- `analytics.http_request` - HTTP request tracking
- `analytics.http_error` - Error details with stack traces
- `analytics.metadata_lookup` - Provider performance tracking
- `analytics.user_session_started` - Session initiation
- `analytics.user_session_ended` - Session termination
- `analytics.user_milestone` - User journey milestones
- `analytics.feature_used` - Feature adoption tracking
- `analytics.aggregated_summary` - Pre-aggregated metrics (created before retention cleanup)

See [domains/analytics.md](../../../domains/analytics.md) for complete event schemas.

## Retention Policy

- **Analytics events** (`analytics.*`): 90 days
- **Domain events** (all others): Indefinite
- **Aggregated summaries**: Indefinite

The retention script runs daily to void analytics events older than 90 days. Before voiding, key metrics are aggregated into `analytics.aggregated_summary` events for long-term trend analysis.

## Performance

Analytics recording is designed to have minimal impact on request latency:

- **Target overhead**: <5ms per request
- **Error handling**: Analytics failures don't break application functionality
- **Async recording**: Non-blocking where possible
- **Indexed queries**: Specialized indexes optimize analytics queries (see migration 003)

## Integration Points

Analytics events are recorded automatically via:

- **HTTP Middleware** ([server/src/metrics/request-metrics.ts](../metrics/request-metrics.ts)) - All HTTP requests
- **Metadata Lookup** ([server/src/routes/books.ts](../routes/books.ts)) - Book metadata searches
- **Authentication** ([server/src/auth/routes.ts](../auth/routes.ts)) - Registration, login
- **Book Operations** ([server/src/routes/books.ts](../routes/books.ts)) - CRUD operations

## Related Documentation

- [domains/analytics.md](../../../domains/analytics.md) - Analytics domain documentation with event schemas
- [docs/explanation/event-sourcing.md](../../../docs/explanation/event-sourcing.md) - Event-sourcing architecture
- [data/postgres/migrations/003_analytics_indexes.sql](../../../data/postgres/migrations/003_analytics_indexes.sql) - Analytics indexes

## Future Enhancements

- Frontend telemetry (page views, clicks)
- Materialized views for dashboards
- Real-time analytics endpoint
- OpenTelemetry exporter
- Anomaly detection
- Predictive analytics
