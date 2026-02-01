# Metrics Service

Application metrics collection and observability.

## Files

- [`collector.ts`](collector.ts) - In-memory metrics collection (counters, histograms)
- [`prometheus.ts`](prometheus.ts) - Prometheus text format exporter
- [`request-metrics.ts`](request-metrics.ts) - HTTP request metrics middleware
- [`index.ts`](index.ts) - Public API exports

## Purpose

Collects operational metrics for monitoring application health and performance.

## Usage

```typescript
import { metrics, requestMetrics } from './metrics'

// Add request metrics middleware
app.use(requestMetrics())

// Custom metrics
metrics.increment('books.created')
metrics.gauge('database.connections', 42)
metrics.histogram('query.duration', 125)
```

## Collected Metrics

### HTTP Metrics

- Request count by endpoint and status
- Response time distribution
- Error rate
- Request rate

### Application Metrics

- Active connections
- Database query performance
- Cache hit/miss rates
- Custom business metrics

## Metrics Endpoints

Metrics are exposed via two endpoints:

### Prometheus Format

```
GET /metrics
```

Returns metrics in Prometheus text format for scraping:

```
# HELP http_requests_total Total count
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/health"} 42

# HELP http_request_duration_ms Histogram
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{method="GET",path="/health",status="200",le="5"} 38
http_request_duration_ms_sum{method="GET",path="/health",status="200"} 156
http_request_duration_ms_count{method="GET",path="/health",status="200"} 42
```

### JSON Format (Debugging)

```
GET /metrics/json
```

Returns metrics as JSON for debugging and inspection.
