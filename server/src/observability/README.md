# Observability

Observability interfaces and adapters for tracing, metrics, and error tracking.

## Architecture

Quailcomp uses **hexagonal architecture** (ports & adapters) for observability:

- **Interfaces** (ports) - Define contracts for tracing, metrics, and error tracking
- **Adapters** - Concrete implementations (no-op, in-memory, Sentry, future OTel)
- **Application code** - Depends only on interfaces, never on adapters

This design allows swapping implementations (e.g., from Sentry to OpenTelemetry) without changing application code.

## Files

### Interfaces (Ports)

- `tracer.ts` - Distributed tracing interface (Tracer, Span)
- `metrics.ts` - Metrics recorder interface (counters, histograms, gauges)
- `error-tracker.ts` - Error tracking interface (capture, breadcrumbs, user context)
- `context.ts` - ObservabilityContext that bundles all three interfaces

### Adapters (Implementations)

- `adapters/noop-tracer.ts` - No-op tracer (zero cost, used by default)
- `adapters/inmemory-metrics.ts` - In-memory metrics collector
- `adapters/sentry-error-tracker.ts` - Sentry error tracking adapter
- `adapters/noop-error-tracker.ts` - No-op error tracker (when Sentry disabled)

### Legacy Files

- `sentry.ts` - Legacy Sentry integration (now wrapped by SentryErrorTracker adapter)

## Usage

### Accessing Observability

Observability is available through the request context:

```typescript
import type { RequestContext } from "@/context";

async function myHandler(ctx: RequestContext) {
  // Access tracer
  const span = ctx.observability.tracer.startSpan("operation_name");

  // Access metrics
  ctx.observability.metrics.incrementCounter("my_counter", 1, { label: "value" });

  // Access error tracker
  ctx.observability.errors.captureError(error, { tags: { feature: "auth" } });
}
```

### Tracing

```typescript
async function processBook(ctx: RequestContext, bookId: number) {
  const span = ctx.observability.tracer.startSpan("process_book");
  span.setAttribute("book_id", bookId);

  try {
    span.addEvent("fetching_book");
    const book = await fetchBook(bookId);

    span.addEvent("processing_complete");
    return book;
  } catch (error) {
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}
```

**Note:** Tracing is currently no-op (zero cost). When you're ready for distributed tracing, create an OTel adapter and swap it in [index.ts](../index.ts).

### Metrics

```typescript
// Increment a counter
ctx.observability.metrics.incrementCounter("books_created", 1, {
  genre: "fiction"
});

// Record histogram (e.g., latency)
ctx.observability.metrics.recordHistogram("db_query_duration_ms", 42, {
  table: "books"
});

// Record gauge (e.g., current value)
ctx.observability.metrics.recordGauge("active_connections", 15);

// Get snapshot
const snapshot = ctx.observability.metrics.snapshot();
```

### Error Tracking

```typescript
try {
  // ... code that might fail
} catch (error) {
  ctx.observability.errors.captureError(error as Error, {
    tags: { feature: "book_creation", severity: "high" },
    extra: { bookId, userId: ctx.user?.userId },
    user: ctx.user ? {
      id: ctx.user.userId.toString(),
      email: ctx.user.email,
    } : undefined,
  });
}
```

#### Breadcrumbs

```typescript
ctx.observability.errors.addBreadcrumb(
  "User selected book",
  { bookId: 123 },
  "navigation"
);
```

#### User Context

```typescript
// Set user for all future errors in this request
ctx.observability.errors.setUser({
  id: user.userId.toString(),
  email: user.email,
  username: user.username ?? undefined,
});

// Clear user
ctx.observability.errors.clearUser();
```

## Initialization

Observability is initialized at application startup in [index.ts](../index.ts):

```typescript
import { createObservabilityContext } from "@/observability/context";
import {
  createNoOpTracer,
  createInMemoryMetrics,
  createSentryErrorTracker,
  createNoOpErrorTracker,
} from "@/observability/adapters";

// Create observability context
const observability = createObservabilityContext(
  createNoOpTracer(),
  createInMemoryMetrics(),
  env.SENTRY_ENABLED && env.SENTRY_DSN
    ? createSentryErrorTracker()
    : createNoOpErrorTracker()
);

// Pass to server
const server = createServer({ observability });
```

## Configuration

### Sentry

Enable Sentry error tracking:

```bash
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENABLED=true
```

When disabled, a no-op error tracker is used (zero cost).

## Future: OpenTelemetry Integration

When you're ready for distributed tracing and standardized observability:

1. **Create OTel adapters**:

   ```typescript
   // server/src/observability/adapters/otel-tracer.ts
   export class OTelTracer implements Tracer { ... }

   // server/src/observability/adapters/otel-metrics.ts
   export class OTelMetrics implements MetricsRecorder { ... }
   ```

2. **Swap in index.ts**:

   ```typescript
   // OLD:
   const tracer = createNoOpTracer();

   // NEW:
   const tracer = createOTelTracer({ endpoint: 'http://localhost:4318' });
   ```

3. **No application code changes needed!** ✨

All handlers, middleware, and services continue using `ctx.observability.*` - they don't know or care which implementation is behind the interface.

## Benefits of This Architecture

- **Testable** - Easy to mock observability in tests
- **Flexible** - Swap implementations without changing app code
- **Simple today** - No external infrastructure required
- **Future-proof** - Ready for OpenTelemetry when needed
- **Type-safe** - TypeScript interfaces enforce contracts

## Related

- [Observability Stack Documentation](../../../docs/explanation/observability.md)
- [Environment Variables](../../../docs/reference/environment-variables.md)
- [Metrics Implementation](../metrics/README.md)
- [Logging Implementation](../logging/README.md)
