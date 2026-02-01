# Observability Stack

Quailcomp uses a comprehensive observability stack for monitoring, logging, and error tracking in production.

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

- **Counters:** HTTP requests, responses by status code
- **Histograms:** Request duration with configurable buckets
- **Labels:** Method, path, status code for filtering

**Endpoints:**

- `GET /metrics` - Prometheus text format
- `GET /metrics/json` - JSON format for debugging

**Implementation:**

- Collector: [server/src/metrics/collector.ts](../../server/src/metrics/collector.ts:1)
- Prometheus exporter: [server/src/metrics/prometheus.ts](../../server/src/metrics/prometheus.ts:1)

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

**Implementation:** [server/src/observability/sentry.ts](../../server/src/observability/sentry.ts:1)

Sentry is disabled by default. Enable it by setting:

```bash
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENABLED=true
```

### 4. Request Tracing (Request ID)

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
