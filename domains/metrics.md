# Metrics

> In-memory metrics collection for real-time observability using counters and histograms.

The Metrics domain provides lightweight, in-memory metrics collection for tracking application performance and behavior. Unlike the Analytics domain (which persists events to the database), metrics are ephemeral and optimized for real-time monitoring dashboards and alerts.

Metrics answer questions like "How many requests per second?" and "What's the 95th percentile latency?" without the overhead of database writes. They're ideal for monitoring production systems and identifying performance issues.

## Counters

> Counters track cumulative values that only increase over time.

A counter is a monotonically increasing value used to count events: HTTP requests, errors, cache hits, etc. Counters never decrease (except when reset).

```typescript
export type Counter = {
  name: string; // Metric name (e.g., 'http_requests_total')
  labels: Record<string, string>; // Dimensions (e.g., {method: 'GET', status: '200'})
  value: number; // Current count
};
```

**Examples:**

- `http_requests_total{method="GET", status="200"}` = 1523
- `database_queries_total{query_type="select"}` = 8472
- `cache_hits_total{cache_type="redis"}` = 456

**Usage Pattern:** Increment counters when events occur. Monitoring systems (like Prometheus) calculate rates from counter changes.

## Histograms

> Histograms track distributions of values using buckets and summary statistics.

A histogram measures the distribution of values: request latency, response sizes, query durations. Histograms divide the range into buckets and count observations in each bucket.

```typescript
export type Histogram = {
  name: string; // Metric name (e.g., 'http_request_duration_ms')
  labels: Record<string, string>; // Dimensions (e.g., {method: 'GET', path: '/api/books'})
  count: number; // Total number of observations
  sum: number; // Sum of all observed values
  buckets: Map<number, number>; // Cumulative counts per bucket threshold
};
```

**Default Buckets (Latency in Milliseconds):**

```
[5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
```

These buckets enable calculating percentiles (p50, p95, p99) from the distribution.

**Examples:**

- `http_request_duration_ms{method="GET", path="/api/books"}`
  - count: 100 (100 requests)
  - sum: 3500 (total 3.5 seconds)
  - buckets: {5: 10, 10: 25, 25: 60, 50: 85, 100: 98, 250: 100, ...}

From this data:

- Average latency: sum/count = 3500/100 = 35ms
- p50 (median): ~25ms (50% of requests in ≤25ms bucket)
- p95: ~100ms (95% of requests in ≤100ms bucket)

## Metrics Snapshot

> Snapshots capture current metric values at a point in time for export or display.

A snapshot represents all metrics at a specific timestamp, with calculated averages for histograms:

```typescript
export type MetricsSnapshot = {
  counters: Counter[];
  histograms: Array<{
    name: string;
    labels: Record<string, string>;
    count: number;
    sum: number;
    avg: number; // Calculated: sum / count
    buckets: Record<string, number>; // Serialized from Map
  }>;
  timestamp: string; // ISO 8601 timestamp
};
```

**Use Cases:**

- Prometheus `/metrics` endpoint
- Health check dashboards
- Debugging performance issues
- Load testing analysis

## Metric Labels

> Labels provide dimensions for slicing and filtering metrics.

Labels are key-value pairs that categorize metrics. Each unique combination of labels creates a separate time series.

**Examples:**

```typescript
// HTTP requests by method and status
metrics.inc('http_requests_total', { method: 'GET', status: '200' });
metrics.inc('http_requests_total', { method: 'POST', status: '201' });
metrics.inc('http_requests_total', { method: 'GET', status: '404' });

// Request latency by method and path
metrics.observe('http_request_duration_ms', { method: 'GET', path: '/api/books' }, 42);
metrics.observe('http_request_duration_ms', { method: 'POST', path: '/api/books' }, 156);
```

**Cardinality Warning:** Each unique label combination creates a new time series. Avoid high-cardinality labels like user IDs or request IDs (use user_type or request_status instead).

## Global Metrics Collector

> A singleton collector instance tracks all metrics in memory.

The metrics system uses a global `metrics` singleton for simplicity. The collector provides these methods:

- `metrics.inc(name, labels?, value?)` - Increment a counter
- `metrics.observe(name, labels, value)` - Record a histogram observation
- `metrics.snapshot()` - Get snapshot of all metrics
- `metrics.reset()` - Reset all metrics (testing only)

## Usage Examples

### Counting Events

```typescript
import { metrics } from '@/server/src/metrics/collector';

// Count HTTP requests
metrics.inc('http_requests_total', {
  method: req.method,
  path: route.path,
  status: String(response.status),
});

// Count errors
metrics.inc('http_errors_total', {
  method: req.method,
  error_type: 'validation_error',
});

// Count cache hits/misses
if (cached) {
  metrics.inc('cache_hits_total', { cache_type: 'book_metadata' });
} else {
  metrics.inc('cache_misses_total', { cache_type: 'book_metadata' });
}
```

### Measuring Latency

```typescript
import { metrics } from '@/server/src/metrics/collector';

const start = Date.now();

try {
  const result = await handler(ctx, req);
  const duration = Date.now() - start;

  // Record successful request latency
  metrics.observe('http_request_duration_ms', {
    method: req.method,
    path: route.path,
    status: '200',
  }, duration);

  return result;
} catch (error) {
  const duration = Date.now() - start;

  // Record failed request latency
  metrics.observe('http_request_duration_ms', {
    method: req.method,
    path: route.path,
    status: '500',
  }, duration);

  throw error;
}
```

### Database Query Metrics

```typescript
import { metrics } from '@/server/src/metrics/collector';

async function queryDatabase<T>(sql: Sql, query: string): Promise<T[]> {
  const start = Date.now();

  try {
    const result = await sql.query<T>(query);
    const duration = Date.now() - start;

    metrics.inc('database_queries_total', { query_type: 'select', status: 'success' });
    metrics.observe('database_query_duration_ms', { query_type: 'select' }, duration);

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    metrics.inc('database_queries_total', { query_type: 'select', status: 'error' });
    metrics.observe('database_query_duration_ms', { query_type: 'select' }, duration);

    throw error;
  }
}
```

### External API Metrics

```typescript
import { metrics } from '@/server/src/metrics/collector';

async function fetchBookMetadata(provider: string, isbn: string): Promise<BookMetadata> {
  const start = Date.now();

  try {
    const metadata = await providerClient.lookup(isbn);
    const duration = Date.now() - start;

    metrics.inc('metadata_lookups_total', { provider, status: 'success' });
    metrics.observe('metadata_lookup_duration_ms', { provider }, duration);

    return metadata;
  } catch (error) {
    const duration = Date.now() - start;

    metrics.inc('metadata_lookups_total', { provider, status: 'error' });
    metrics.observe('metadata_lookup_duration_ms', { provider }, duration);

    throw error;
  }
}
```

### Metrics Endpoint (Prometheus Format)

```typescript
import { metrics } from '@/server/src/metrics/collector';
import type { RequestContext } from '@/server/src/context';

async function handleMetrics(ctx: RequestContext): Promise<Response> {
  const snapshot = metrics.snapshot();

  // Format counters
  const counterLines = snapshot.counters.map((c) => {
    const labelStr = Object.entries(c.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${c.name}{${labelStr}} ${c.value}`;
  });

  // Format histograms
  const histogramLines = snapshot.histograms.flatMap((h) => {
    const labelStr = Object.entries(h.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    const lines = [
      `${h.name}_count{${labelStr}} ${h.count}`,
      `${h.name}_sum{${labelStr}} ${h.sum}`,
    ];

    // Add bucket lines
    Object.entries(h.buckets).forEach(([bucket, count]) => {
      lines.push(`${h.name}_bucket{${labelStr},le="${bucket}"} ${count}`);
    });

    return lines;
  });

  const output = [...counterLines, ...histogramLines].join('\n');

  return new Response(output, {
    headers: { 'Content-Type': 'text/plain; version=0.0.4' },
  });
}
```

### Health Check with Metrics

```typescript
import { metrics } from '@/server/src/metrics/collector';

async function handleHealthCheck(): Promise<Response> {
  const snapshot = metrics.snapshot();

  // Calculate error rate
  const requestsCounter = snapshot.counters.find((c) =>
    c.name === 'http_requests_total'
  );
  const errorsCounter = snapshot.counters.find((c) =>
    c.name === 'http_errors_total'
  );

  const totalRequests = requestsCounter?.value ?? 0;
  const totalErrors = errorsCounter?.value ?? 0;
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

  // Check average latency
  const latencyHistogram = snapshot.histograms.find((h) =>
    h.name === 'http_request_duration_ms'
  );
  const avgLatency = latencyHistogram?.avg ?? 0;

  const health = {
    status: errorRate < 0.05 && avgLatency < 1000 ? 'healthy' : 'degraded',
    error_rate: errorRate,
    avg_latency_ms: avgLatency,
    total_requests: totalRequests,
  };

  return new Response(JSON.stringify(health), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Metrics vs Analytics

> Metrics (ephemeral, real-time) complement Analytics (persistent, historical).

**Metrics:**

- In-memory, ephemeral (lost on restart)
- Optimized for real-time dashboards
- Low overhead (no database writes)
- Aggregated data (counts, sums, distributions)
- Good for: request rates, latency percentiles, error rates

**Analytics:**

- Persistent in database
- Optimized for historical analysis
- Higher overhead (database writes)
- Individual event records with full details
- Good for: user behavior, feature adoption, debugging specific requests

**Use Both:** Use metrics for real-time monitoring and analytics for historical analysis and debugging.

## Integration Points

- **[Configuration Domain](./configuration.md)** - Uses `env.PROMETHEUS_ENABLED` to enable/disable metrics endpoint
- **[Logging Domain](./logging.md)** - Logs complement metrics for observability
- **[HTTP Domain](./http.md)** - HTTP middleware records request metrics
- **[Analytics Domain](./analytics.md)** - Metrics (real-time) vs Analytics (persistent)
- **[Book Metadata Services Domain](./book-metadata-services.md)** - External API call metrics

## Invariants

1. **Monotonic Counters** - Counters never decrease (except on reset)
2. **Cumulative Buckets** - Histogram buckets are cumulative (each bucket includes all lower values)
3. **Label Consistency** - The same metric name must always use the same label keys
4. **In-Memory Only** - Metrics are not persisted (ephemeral)
5. **Global Singleton** - Only one metrics collector exists per process

## Use Cases

### Real-Time Dashboard

```typescript
// Periodically poll metrics for dashboard
setInterval(async () => {
  const snapshot = metrics.snapshot();

  const requestRate = calculateRate(snapshot.counters, 'http_requests_total');
  const errorRate = calculateErrorRate(snapshot.counters);
  const p95Latency = calculateP95(snapshot.histograms, 'http_request_duration_ms');

  await updateDashboard({
    request_rate: requestRate,
    error_rate: errorRate,
    p95_latency: p95Latency,
  });
}, 5000); // Poll every 5 seconds
```

### Alerting

```typescript
// Check metrics and trigger alerts
async function checkAlerts() {
  const snapshot = metrics.snapshot();

  const latencyHistogram = snapshot.histograms.find((h) =>
    h.name === 'http_request_duration_ms' && h.labels.path === '/api/books'
  );

  if (latencyHistogram && latencyHistogram.avg > 1000) {
    await sendAlert({
      severity: 'warning',
      message: 'High latency on /api/books endpoint',
      avg_latency_ms: latencyHistogram.avg,
    });
  }
}
```

### Load Testing Analysis

```typescript
// Analyze metrics after load test
async function analyzeLoadTest() {
  const snapshot = metrics.snapshot();

  const latencyHistogram = snapshot.histograms.find((h) =>
    h.name === 'http_request_duration_ms'
  );

  if (!latencyHistogram) return;

  console.log('Load Test Results:');
  console.log(`Total requests: ${latencyHistogram.count}`);
  console.log(`Average latency: ${latencyHistogram.avg.toFixed(2)}ms`);
  console.log(`Total duration: ${latencyHistogram.sum}ms`);

  // Calculate percentiles from buckets
  const p50 = findPercentileBucket(latencyHistogram.buckets, 0.5, latencyHistogram.count);
  const p95 = findPercentileBucket(latencyHistogram.buckets, 0.95, latencyHistogram.count);
  const p99 = findPercentileBucket(latencyHistogram.buckets, 0.99, latencyHistogram.count);

  console.log(`p50 latency: ≤${p50}ms`);
  console.log(`p95 latency: ≤${p95}ms`);
  console.log(`p99 latency: ≤${p99}ms`);
}
```

## Best Practices

### 1. Use Consistent Label Names

```typescript
// ✅ Good - consistent labels across metrics
metrics.inc('http_requests_total', { method: 'GET', path: '/api/books' });
metrics.observe('http_request_duration_ms', { method: 'GET', path: '/api/books' }, 42);

// ❌ Bad - inconsistent label names
metrics.inc('http_requests_total', { http_method: 'GET', route: '/api/books' });
metrics.observe('http_request_duration_ms', { method: 'GET', path: '/api/books' }, 42);
```

### 2. Avoid High-Cardinality Labels

```typescript
// ❌ Bad - user_id creates millions of time series
metrics.inc('requests_total', { user_id: String(userId) });

// ✅ Good - user_type has low cardinality
metrics.inc('requests_total', { user_type: user.is_premium ? 'premium' : 'free' });
```

### 3. Name Metrics Clearly

```typescript
// ✅ Good - clear names with units
metrics.inc('http_requests_total');
metrics.observe('http_request_duration_ms', labels, duration);
metrics.observe('database_query_duration_ms', labels, duration);

// ❌ Bad - unclear names without units
metrics.inc('requests');
metrics.observe('latency', labels, duration);
```

### 4. Reset Metrics Only in Tests

```typescript
// ✅ Good - reset in test teardown
afterEach(() => {
  metrics.reset();
});

// ❌ Bad - resetting in production loses data
if (isProduction()) {
  metrics.reset(); // Never do this!
}
```

## Related Documentation

- [Logging Domain](./logging.md) - Structured logging for observability
- [Analytics Domain](./analytics.md) - Persistent event tracking
- [Configuration Domain](./configuration.md) - PROMETHEUS_ENABLED setting
- [HTTP Domain](./http.md) - HTTP request metrics middleware
