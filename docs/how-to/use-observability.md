# How to Use Observability

This guide shows how to add observability (metrics, tracing, error tracking) to your handlers and services.

## Access Observability

Observability is available through the request context:

```typescript
import type { RequestContext } from "@/context";

export async function myHandler(ctx: RequestContext) {
  // Observability is available here
  const { tracer, metrics, errors } = ctx.observability;
}
```

## Record Metrics

### Increment Counters

Use counters for things that accumulate over time:

```typescript
// Simple counter
ctx.observability.metrics.incrementCounter("books_created");

// Counter with labels
ctx.observability.metrics.incrementCounter("books_created", 1, {
  genre: "fiction",
  format: "digital"
});

// Increment by custom amount
ctx.observability.metrics.incrementCounter("items_processed", 10, {
  batch_id: "abc123"
});
```

### Record Histograms

Use histograms for distributions (latency, size, etc.):

```typescript
const start = Date.now();
const result = await database.query();
const duration = Date.now() - start;

ctx.observability.metrics.recordHistogram("db_query_duration_ms", duration, {
  table: "books",
  operation: "select"
});
```

### Record Gauges

Use gauges for current values:

```typescript
// Active connections
ctx.observability.metrics.recordGauge("active_websocket_connections", connectionCount);

// Queue depth
ctx.observability.metrics.recordGauge("pending_jobs", jobQueue.length, {
  queue: "high_priority"
});

// Memory usage
ctx.observability.metrics.recordGauge("memory_usage_mb", process.memoryUsage().heapUsed / 1024 / 1024);
```

## Capture Errors

### Basic Error Capture

```typescript
try {
  await riskyOperation();
} catch (error) {
  ctx.observability.errors.captureError(error as Error);
  throw error; // Re-throw or handle as needed
}
```

### Error with Context

```typescript
try {
  await createBook(bookData);
} catch (error) {
  ctx.observability.errors.captureError(error as Error, {
    tags: {
      feature: "book_creation",
      severity: "high",
    },
    extra: {
      bookTitle: bookData.title,
      userId: ctx.user?.userId,
      attemptNumber: retryCount,
    },
    user: ctx.user ? {
      id: ctx.user.userId.toString(),
      email: ctx.user.email,
      username: ctx.user.username ?? undefined,
    } : undefined,
  });
  throw error;
}
```

### Capture Messages (Non-Errors)

```typescript
// Info message
ctx.observability.errors.captureMessage(
  "User performed bulk import",
  "info",
  {
    tags: { feature: "import" },
    extra: { itemCount: 1000 },
  }
);

// Warning
ctx.observability.errors.captureMessage(
  "Rate limit approaching",
  "warning",
  {
    tags: { feature: "api" },
    extra: { currentRate: 95, limit: 100 },
  }
);
```

### Add Breadcrumbs

Breadcrumbs create a trail of events leading up to errors:

```typescript
// When user starts an action
ctx.observability.errors.addBreadcrumb(
  "User started book creation",
  { title: bookData.title },
  "user_action"
);

// When calling external API
ctx.observability.errors.addBreadcrumb(
  "Fetching metadata from Google Books",
  { isbn: bookData.isbn },
  "api_call"
);

// When database operation
ctx.observability.errors.addBreadcrumb(
  "Saving book to database",
  { bookId: book.id },
  "database"
);

// If an error occurs later, all breadcrumbs are included in the error report
```

### Set User Context

```typescript
// After authentication
ctx.observability.errors.setUser({
  id: user.userId.toString(),
  email: user.email,
  username: user.username ?? undefined,
});

// Clear on logout
ctx.observability.errors.clearUser();
```

## Add Tracing (Future)

Tracing interfaces are ready but currently no-op. You can add spans now, and they'll become active when you plug in OpenTelemetry:

```typescript
export async function processBook(ctx: RequestContext, bookId: number) {
  const span = ctx.observability.tracer.startSpan("process_book");
  span.setAttribute("book_id", bookId);

  try {
    // Add events at key points
    span.addEvent("fetching_book_data");
    const book = await fetchBook(bookId);

    span.addEvent("enriching_metadata");
    await enrichMetadata(book);

    span.addEvent("validating");
    validate(book);

    span.addEvent("processing_complete");
    span.setAttribute("page_count", book.pageCount);

    return book;
  } catch (error) {
    // Record exception in span
    span.recordException(error as Error);
    throw error;
  } finally {
    // Always end the span
    span.end();
  }
}
```

### Nested Spans

```typescript
export async function enrichMetadata(ctx: RequestContext, book: Book) {
  const parentSpan = ctx.observability.tracer.startSpan("enrich_metadata");

  try {
    // Child span for external API call
    const apiSpan = ctx.observability.tracer.startSpan("fetch_google_books");
    apiSpan.setAttribute("isbn", book.isbn);
    try {
      const metadata = await googleBooksAPI.fetch(book.isbn);
      apiSpan.addEvent("metadata_received");
      return metadata;
    } finally {
      apiSpan.end();
    }
  } finally {
    parentSpan.end();
  }
}
```

## Best Practices

### Metrics

- **Use consistent naming:** `feature_action_metric` (e.g., `books_created_total`, `db_query_duration_ms`)
- **Add useful labels:** Make metrics filterable (genre, format, status)
- **Don't over-label:** Too many label combinations = too many time series
- **Use appropriate types:**
  - Counters: Things that go up (requests, errors, items created)
  - Histograms: Distributions (latency, size, duration)
  - Gauges: Current values (connections, queue depth, memory)

### Error Tracking

- **Include context:** Tags and extra data help debug
- **Set user context:** Makes it easier to reach out to affected users
- **Use breadcrumbs:** Create a trail of what happened before the error
- **Don't capture sensitive data:** Avoid passwords, tokens, credit cards in error context

### Tracing

- **Span one logical operation:** Function call, API call, database query
- **Name spans clearly:** Use `feature.operation` pattern (e.g., `books.create`, `api.google_books.fetch`)
- **Add attributes early:** Set important attributes before the operation
- **Record exceptions:** Always call `span.recordException()` in catch blocks
- **Always end spans:** Use try/finally to ensure spans end

### General

- **Observability doesn't replace logs:** Use both - logs for debugging, observability for monitoring
- **Start simple:** Add basic metrics/error tracking first, add more as needed
- **Monitor what matters:** Don't add metrics you won't look at

## Testing with Observability

In tests, observability uses no-op implementations by default. To test metrics:

```typescript
import { createInMemoryMetrics } from "@/observability/adapters";
import { createObservabilityContext } from "@/observability/context";

test("increments counter", async () => {
  const metrics = createInMemoryMetrics();
  const observability = createObservabilityContext(
    createNoOpTracer(),
    metrics,
    createNoOpErrorTracker()
  );

  const ctx = createContext(request, sql, observability);

  await myHandler(ctx);

  const snapshot = metrics.snapshot();
  const counter = snapshot.counters.find(c => c.name === "my_counter");
  expect(counter?.value).toBe(1);
});
```

## Related

- [Observability Stack](../explanation/observability.md) - Architecture overview
- [Observability Implementation](../../server/src/observability/README.md) - Code documentation
- [Environment Variables](../reference/environment-variables.md) - Configuration
