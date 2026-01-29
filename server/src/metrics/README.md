# Metrics Service

Application metrics collection and observability.

## Files

- [`collector.ts`](collector.ts) - Metrics collection and aggregation
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

## Metrics Endpoint

Metrics can be exposed via an endpoint for monitoring tools:

```
GET /metrics
```

Returns metrics in a format compatible with Prometheus or similar monitoring systems.
