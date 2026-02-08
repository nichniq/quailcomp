# Observability Stack

Quailcomp uses a comprehensive observability stack for monitoring, logging, and error tracking in production.

## Architecture

Quailcomp follows **hexagonal architecture (ports & adapters)** for observability:

- **Application code** depends on **interfaces** (Tracer, MetricsRecorder, ErrorTracker)
- **Adapters** provide concrete implementations (NoOp, InMemory, Sentry, future OTel)
- Implementations can be swapped without changing application code

This design provides:

- **Flexibility** - Easy to switch from Sentry to OpenTelemetry later
- **Testability** - Simple to mock observability in tests
- **No vendor lock-in** - Application code is implementation-agnostic
- **Future-proof** - Tracing interfaces ready, implementation can be added when needed

See [server/src/observability/README.md](../../server/src/observability/README.md) for implementation details.

## Components

### 1. Structured Logging (Pino)

Production logging uses [Pino](https://getpino.io/), a fast JSON logger with:

- **Pretty printing** in development for readability
- **JSON output** in production for log aggregation
- **Automatic redaction** of sensitive fields (passwords, tokens, etc.)
- **Request ID correlation** for tracing requests across logs

**Implementation:** [server/src/logging/pino-logger.ts](../../server/src/logging/pino-logger.ts:1)

Example log output (development):

```
[23:02:28.193] INFO: Request started
    requestId: "ml4cj1wg-4ljs1gu"
    method: "GET"
    path: "/health"
```

### 2. Metrics Collection (Prometheus)

Metrics are collected using a lightweight in-memory collector and exposed in Prometheus text format:

- **Counters:** HTTP requests, responses by status code, errors
- **Histograms:** Request duration with configurable buckets
- **Gauges:** Current values (connections, queue depth, etc.)
- **Labels:** Method, path, status code for filtering

**Endpoints:**

- `GET /metrics` - Prometheus text format
- `GET /metrics/json` - JSON format for debugging

**Architecture:**

- Interface: [server/src/observability/metrics.ts](../../server/src/observability/metrics.ts) - `MetricsRecorder` interface
- Adapter: [server/src/observability/adapters/inmemory-metrics.ts](../../server/src/observability/adapters/inmemory-metrics.ts) - In-memory implementation
- Exporter: [server/src/metrics/prometheus.ts](../../server/src/metrics/prometheus.ts) - Prometheus format converter
- Middleware: [server/src/metrics/request-metrics.ts](../../server/src/metrics/request-metrics.ts) - HTTP metrics collection

**Usage in application code:**

```typescript
// Access via context
ctx.observability.metrics.incrementCounter("books_created", 1, { genre: "fiction" });
ctx.observability.metrics.recordHistogram("db_query_ms", 42, { table: "books" });
ctx.observability.metrics.recordGauge("active_sessions", 15);
```

Example Prometheus output:

```
# HELP http_requests_total Total count
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/health"} 42

# HELP http_request_duration_ms Histogram
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{method="GET",path="/health",status="200",le="5"} 38
http_request_duration_ms_bucket{method="GET",path="/health",status="200",le="10"} 42
http_request_duration_ms_sum{method="GET",path="/health",status="200"} 156
http_request_duration_ms_count{method="GET",path="/health",status="200"} 42
```

### 3. Error Tracking (Sentry)

[Sentry](https://sentry.io/) captures production errors with full context:

- **Automatic error capture** in error handler middleware
- **Breadcrumbs** for context leading up to errors
- **User context** when available (authenticated requests)
- **Request metadata** (path, method, request ID)
- **Graceful shutdown** with event flushing

**Architecture:**

- Interface: [server/src/observability/error-tracker.ts](../../server/src/observability/error-tracker.ts) - `ErrorTracker` interface
- Adapter: [server/src/observability/adapters/sentry-error-tracker.ts](../../server/src/observability/adapters/sentry-error-tracker.ts) - Sentry implementation
- No-op adapter: [server/src/observability/adapters/noop-error-tracker.ts](../../server/src/observability/adapters/noop-error-tracker.ts) - When disabled
- Middleware: [server/src/middleware/error-handler.ts](../../server/src/middleware/error-handler.ts) - Error capture

**Usage in application code:**

```typescript
// Capture error
ctx.observability.errors.captureError(error, {
  tags: { feature: "authentication" },
  extra: { userId: user.id },
});

// Add breadcrumb
ctx.observability.errors.addBreadcrumb("User logged in", { userId: user.id }, "auth");
```

Sentry is disabled by default. Enable it by setting:

```bash
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENABLED=true
```

When disabled, a no-op implementation is used (zero overhead).

### 4. Distributed Tracing (Future)

The codebase includes tracing interfaces ready for distributed tracing:

- **Interface:** [server/src/observability/tracer.ts](../../server/src/observability/tracer.ts) - `Tracer` and `Span` interfaces
- **Current implementation:** No-op (zero cost, does nothing)
- **Future:** Create OpenTelemetry adapter and swap it in

**Interface is ready today:**

```typescript
const span = ctx.observability.tracer.startSpan("process_book");
span.setAttribute("book_id", bookId);

try {
  span.addEvent("fetching_data");
  const data = await fetch();
  span.addEvent("processing_complete");
  return data;
} catch (error) {
  span.recordException(error);
  throw error;
} finally {
  span.end();
}
```

Currently this code runs with zero overhead (no-op). When you're ready for distributed tracing:

1. Create an OpenTelemetry adapter implementing the `Tracer` interface
2. Swap it in [server/src/index.ts](../../server/src/index.ts)
3. All existing span calls automatically start working!

### 5. Request Tracing (Request ID)

Every request gets a unique ID for correlation:

- **Extracted from headers** if client provides `X-Request-Id`
- **Generated automatically** if not provided (timestamp + random)
- **Echoed in response** headers for client visibility
- **Included in logs** for correlation
- **Sent to Sentry** for error context

**Implementation:** [server/src/middleware/request-id.ts](../../server/src/middleware/request-id.ts:1)

## Middleware Stack

The observability middleware is composed in this order:

1. **Error Handler** - Catches and reports errors to Sentry
2. **Request ID** - Generates/extracts request ID
3. **Request Logger** - Logs request start/completion with Pino
4. **Request Metrics** - Records metrics for Prometheus
5. **CORS** - Handles cross-origin requests

See [server/src/server.ts](../../server/src/server.ts:74) for the middleware composition.

## Production Setup

### Prometheus Scraping

Configure Prometheus to scrape the `/metrics` endpoint:

```yaml
scrape_configs:
  - job_name: 'quailcomp'
    static_configs:
      - targets: ['your-server:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Sentry Setup

1. Create a Sentry project at <https://sentry.io/>
2. Copy the DSN from project settings
3. Set environment variables:

   ```bash
   SENTRY_DSN=https://...@sentry.io/...
   SENTRY_ENABLED=true
   ```

4. (Optional) Set `RELEASE_VERSION` to track releases

### Log Aggregation

In production, Pino outputs JSON logs to stdout:

```json
{"level":30,"time":"2026-02-01T23:02:28.193Z","requestId":"ml4cj1wg-4ljs1gu","method":"GET","path":"/health","msg":"Request started"}
```

These can be:

- Collected by systemd journal (`journalctl -u quailcomp`)
- Shipped to log aggregators (Loki, Elasticsearch, etc.)
- Parsed and indexed for searching

## Local Development

In development:

- Pino uses pretty-printing for readability
- Sentry is disabled by default
- Metrics are available at `http://localhost:3000/metrics`
- Request IDs are logged but not critical

## Testing

Observability features are tested in [server/tests/observability.test.ts](../../server/tests/observability.test.ts:1):

```bash
bun test server/tests/observability.test.ts
```

Tests verify:

- Prometheus text format generation
- Request ID tracking and echoing
- Metrics collection for HTTP requests
- JSON metrics endpoint

## Related

- [Environment Variables](../reference/environment-variables.md) - Configuration options
- [Logging](../../server/src/logging/README.md) - Logging implementation
- [Metrics](../../server/src/metrics/README.md) - Metrics collection
