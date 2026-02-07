# Events

> Immutable event recording for facts about what happened, when, and why.

The Events domain captures historical facts as append-only, never-deleted records. Unlike entities (which represent mutable state), events represent immutable facts: actions that occurred, changes that happened, or observations that were made at specific points in time.

Events are the foundation of analytics, audit trails, and temporal queries. They answer questions like "what happened?", "when did it happen?", and "how often does this occur?" The append-only structure ensures events are never lost, supporting compliance, debugging, and data science workflows.

## Events vs Entities

> Events are immutable facts (verbs); entities are mutable state (nouns).

The distinction between events and entities is fundamental to the system architecture:

**Entities (Nouns):**

- **What they represent:** Current state of a thing (user, book, series)
- **Mutability:** Can be updated (append new version) or deleted (soft delete)
- **Purpose:** Answer "what is the current state?"
- **Examples:** user profile, book metadata, series information

**Events (Verbs):**

- **What they represent:** Facts about what happened
- **Mutability:** Immutable (never updated or deleted, only voided)
- **Purpose:** Answer "what happened?" and "when did it happen?"
- **Examples:** user_logged_in, book_added_to_library, search_performed

**Use Both Together:**

- Entity updated → Record event about the change
- User action → Update entity state + record event about the action
- Analytics → Query events for insights, entities for current state

## Core Types

### Event Entry

> A single version of an event at a point in time.

```typescript
export type EventEntry<T = unknown> = {
  entryId: number;         // Unique ID for this entry (auto-generated)
  enteredAt: Date;         // When this entry was created
  eventType: string;       // Event type (e.g., 'user_logged_in', 'book_acquired')
  occurredAt: Date;        // When the event actually occurred
  data: T;                 // Event data (JSONB, type-safe)
  eventId: number;         // Event ID (multiple entries share this for enrichment)
  voidedAt: Date | null;   // Void timestamp (null if not voided)
};
```

**Key Fields:**

- `entryId` - Unique identifier for this specific entry (primary key)
- `eventId` - Shared identifier for all versions of this event (for enrichment)
- `occurredAt` - When the event happened (user-provided, critical for analytics)
- `enteredAt` - When the entry was recorded in the database (system-generated)
- `eventType` - Event classification for filtering and grouping
- `data` - Event payload, stored as JSONB, type-safe via generic `T`
- `voidedAt` - Void marker (non-null means event was voided)

**Invariants:**

- `entryId` is globally unique across all events
- `eventId` is shared by all versions of the same logical event (for enrichment)
- `occurredAt` is immutable (never changes across enrichments)
- Voided events have latest entry with non-null `voidedAt`

### CRUD Input Types

```typescript
export type RecordEventInput<T = unknown> = {
  eventType: string;   // Event type
  occurredAt: Date;    // When event occurred
  data: T;             // Event data
};

export type EnrichEventInput<T = unknown> = {
  eventId: number;     // Which event to enrich
  eventType: string;   // Event type (must match existing)
  occurredAt: Date;    // When event occurred (must match existing)
  data: T;             // Enriched event data
};

export type VoidEventInput<T = unknown> = {
  eventId: number;     // Which event to void
  eventType: string;   // Event type (must match existing)
  occurredAt: Date;    // When event occurred (must match existing)
  data: T;             // Final event data (preserved for audit)
};
```

**Design Notes:**

- `RecordEventInput` has no `eventId` (auto-generated)
- `EnrichEventInput` requires `eventId` to append enriched version
- `VoidEventInput` includes `data` to preserve final state
- `occurredAt` is preserved across all versions of an event

### Query Options

```typescript
export type EventQueryOptions = {
  /** Include voided events (default: false) */
  includeVoided?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
};
```

## EventsClient

> Type-safe client for recording, enriching, and querying immutable events.

The `EventsClient` provides methods for working with events while maintaining the immutability invariant.

### Record Operations

**Record Single Event:**

```typescript
const client = createEventsClient(sql);

const event = await client.record({
  eventType: 'user_logged_in',
  occurredAt: new Date(),
  data: { userId: 123, ipAddress: '192.168.1.1' },
});

// event.eventId is auto-generated
// event.entryId is unique for this entry
```

**Record Multiple Events (Transactional):**

```typescript
const events = await client.recordMany([
  {
    eventType: 'book_added',
    occurredAt: new Date(),
    data: { bookId: 1, userId: 123 },
  },
  {
    eventType: 'book_added',
    occurredAt: new Date(),
    data: { bookId: 2, userId: 123 },
  },
]);

// All succeed or all fail (wrapped in transaction)
```

### Enrich Operations

**Enrich Event (Append Enriched Version):**

```typescript
// Original event
const event = await client.record({
  eventType: 'book_searched',
  occurredAt: new Date(),
  data: { query: 'tolkien', userId: 123 },
});

// Later: enrich with search results
const enriched = await client.enrich({
  eventId: event.eventId,
  eventType: event.eventType,
  occurredAt: event.occurredAt, // Must match original
  data: {
    query: 'tolkien',
    userId: 123,
    resultCount: 42,
    executionTimeMs: 15,
  },
});

// Creates new entry with same eventId, enriched data
// Previous entry remains in database
```

### Void Operations

**Void Event (Mark as Invalid):**

```typescript
const voided = await client.void({
  eventId: 123,
  eventType: 'user_logged_in',
  occurredAt: event.occurredAt,
  data: event.data,
});

// Creates new entry with voidedAt set
// Event no longer returned by default queries
```

**Restore Voided Event:**

```typescript
const restored = await client.restore({
  eventId: 123,
  eventType: 'user_logged_in',
  occurredAt: event.occurredAt,
  data: event.data,
});

// Creates new entry with voidedAt = null
// Event is active again
```

### Read Operations

**Get Latest Version by Event ID:**

```typescript
const event = await client.getById<LoginEventData>(123);

if (!event) {
  // Event doesn't exist or is voided
}

// Include voided events
const voidedEvent = await client.getById<LoginEventData>(123, { includeVoided: true });
```

**Get All Versions (History):**

```typescript
const history = await client.getHistory<SearchEventData>(123);

// Returns all entries for event 123, ordered oldest to newest
// Shows how event was enriched over time
history.forEach((entry) => {
  console.log(`Version at ${entry.enteredAt}:`, entry.data);
});
```

**Get All Events of a Type:**

```typescript
const logins = await client.getByType<LoginEventData>('user_logged_in');

// Returns latest entry for each login event
// Excludes voided by default

const allLogins = await client.getByType<LoginEventData>('user_logged_in', {
  includeVoided: true,
});
```

**Get Events in Time Range:**

```typescript
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-01-31');

const events = await client.getByTimeRange<ActivityEventData>(
  startDate,
  endDate,
  { limit: 100 },
);

// Returns events that occurred in January 2024
// Sorted by occurredAt descending (most recent first)
```

**Count Events:**

```typescript
const activeCount = await client.countByType('user_logged_in');
const totalCount = await client.countByType('user_logged_in', { includeVoided: true });
```

**Check Existence:**

```typescript
const exists = await client.exists(123);

// Returns true if event exists and is not voided
```

### Search Operations

**Search by JSONB Data:**

```typescript
// Find login events from specific user
const userLogins = await client.findByData<LoginEventData>(
  'user_logged_in',
  { userId: 123 },
);

// Find search events with specific query
const searches = await client.findByData<SearchEventData>(
  'book_searched',
  { query: 'tolkien' },
  { limit: 10 },
);
```

**Find Events for Entity:**

```typescript
// Find all events related to book 123
const bookEvents = await client.findForEntity(
  'bookId',
  123,
);

// Returns events where data.bookId = 123
// Across all event types
```

## Usage Examples

### Basic Event Lifecycle

```typescript
import { createEventsClient } from '@quailcomp/data';
import { getConnection } from '@quailcomp/data';

const sql = getConnection();
const client = createEventsClient(sql);

// 1. Record event
const event = await client.record({
  eventType: 'user_logged_in',
  occurredAt: new Date(),
  data: { userId: 123, ipAddress: '192.168.1.1' },
});

console.log('Recorded:', event.eventId);

// 2. Enrich with additional data
const enriched = await client.enrich({
  eventId: event.eventId,
  eventType: event.eventType,
  occurredAt: event.occurredAt,
  data: {
    userId: 123,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    sessionId: 'abc123',
  },
});

// 3. View history
const history = await client.getHistory(event.eventId);
console.log('History:', history.length, 'versions');

// 4. Void event (e.g., detected as fraudulent)
await client.void({
  eventId: event.eventId,
  eventType: event.eventType,
  occurredAt: event.occurredAt,
  data: enriched.data,
});

// 5. Verify voided
const voided = await client.getById(event.eventId);
console.log('Voided:', voided === null); // true
```

### Type-Safe Event Data

```typescript
// Define event data types
type LoginEventData = {
  userId: number;
  ipAddress: string;
  userAgent?: string;
  sessionId?: string;
};

type SearchEventData = {
  userId: number;
  query: string;
  resultCount?: number;
  executionTimeMs?: number;
};

// Type-safe operations
const login = await client.record<LoginEventData>({
  eventType: 'user_logged_in',
  occurredAt: new Date(),
  data: {
    userId: 123,
    ipAddress: '192.168.1.1',
  },
});

// TypeScript knows login.data is LoginEventData
console.log(login.data.userId); // OK
console.log(login.data.query); // Error: Property 'query' does not exist
```

### Analytics Query

```typescript
// Get login events for the last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const now = new Date();

const logins = await client.getByTimeRange<LoginEventData>(
  thirtyDaysAgo,
  now,
);

// Count unique users
const uniqueUsers = new Set(logins.map((e) => e.data.userId));
console.log('Unique users logged in:', uniqueUsers.size);

// Group by day
const loginsByDay = logins.reduce((acc, event) => {
  const day = event.occurredAt.toISOString().split('T')[0];
  acc[day] = (acc[day] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log('Logins by day:', loginsByDay);
```

### Audit Trail

```typescript
// Record important actions
await client.record({
  eventType: 'user_deleted',
  occurredAt: new Date(),
  data: {
    userId: 123,
    deletedBy: 456, // Admin user ID
    reason: 'Requested account deletion',
  },
});

await client.record({
  eventType: 'data_exported',
  occurredAt: new Date(),
  data: {
    userId: 123,
    exportedBy: 456,
    exportType: 'full_account_data',
    recordCount: 1247,
  },
});

// Later: audit trail query
const auditEvents = await client.findForEntity('userId', 123);
console.log('Audit trail:', auditEvents);
```

### Event Enrichment Pattern

```typescript
// Initial event (minimal data)
const search = await client.record({
  eventType: 'book_searched',
  occurredAt: new Date(),
  data: { query: 'tolkien', userId: 123 },
});

// Execute search (async)
const results = await performSearch('tolkien');

// Enrich with results
await client.enrich({
  eventId: search.eventId,
  eventType: search.eventType,
  occurredAt: search.occurredAt,
  data: {
    query: 'tolkien',
    userId: 123,
    resultCount: results.length,
    executionTimeMs: results.duration,
    topResults: results.slice(0, 5).map((r) => r.id),
  },
});
```

### Pagination

```typescript
// Get first page of events
const page1 = await client.getByType<ActivityEventData>('user_activity', {
  limit: 20,
  offset: 0,
});

// Get second page
const page2 = await client.getByType<ActivityEventData>('user_activity', {
  limit: 20,
  offset: 20,
});

// Get total count
const total = await client.countByType('user_activity');
const pages = Math.ceil(total / 20);
```

## Integration Points

- **[Database Domain](./database.md)** - Uses `Sql` connection for query execution
- **[Errors Domain](./errors.md)** - Database errors are parsed and transformed
- **[HTTP Domain](./http.md)** - Handlers use `ctx.sql` to create `EventsClient` for request-scoped operations
- **[Entities Domain](./entities.md)** - Events record facts about entity changes (use both together)
- **[Analytics Domain](./analytics.md)** - Analytics queries use events for time-series data and insights

## Invariants

1. **Append-Only** - Existing entries are never modified (only new entries are inserted)
2. **Immutable Facts** - `occurredAt`, `eventType`, and original `data` never change
3. **Latest Entry is Current** - Maximum `entered_at` for an `event_id` determines current state
4. **Voiding Not Deleting** - Voided events have latest entry with non-null `voided_at`
5. **Type Consistency** - All entries for an `event_id` must have the same `eventType` and `occurredAt`
6. **Auto-Generated IDs** - `event_id` comes from `event_id_seq` sequence
7. **JSONB Data** - Event `data` is stored as JSONB and automatically parsed
8. **Transaction Safety** - `recordMany()` is atomic (all succeed or all fail)

## Use Cases

### User Activity Tracking

```typescript
// Track login
await client.record({
  eventType: 'user_logged_in',
  occurredAt: new Date(),
  data: { userId: 123, ipAddress: '192.168.1.1' },
});

// Track logout
await client.record({
  eventType: 'user_logged_out',
  occurredAt: new Date(),
  data: { userId: 123, sessionDuration: 3600 },
});

// Query activity
const activity = await client.findForEntity('userId', 123);
```

### Book Library Events

```typescript
// Book acquired
await client.record({
  eventType: 'book_acquired',
  occurredAt: new Date(),
  data: { bookId: 1, userId: 123, source: 'purchase' },
});

// Book read
await client.record({
  eventType: 'book_read',
  occurredAt: new Date(),
  data: { bookId: 1, userId: 123, pagesRead: 310, completionPercentage: 100 },
});

// Analytics: most read books
const readEvents = await client.getByType('book_read');
const bookCounts = readEvents.reduce((acc, e) => {
  const bookId = e.data.bookId;
  acc[bookId] = (acc[bookId] || 0) + 1;
  return acc;
}, {});
```

### Search Analytics

```typescript
// Record search
const search = await client.record({
  eventType: 'search_performed',
  occurredAt: new Date(),
  data: { query: 'tolkien', userId: 123 },
});

// Enrich with results
await client.enrich({
  eventId: search.eventId,
  eventType: search.eventType,
  occurredAt: search.occurredAt,
  data: {
    query: 'tolkien',
    userId: 123,
    resultCount: 42,
    clickedResult: 5,
  },
});

// Analytics: top searches
const searches = await client.getByType('search_performed', { limit: 100 });
const queryFrequency = searches.reduce((acc, e) => {
  const query = e.data.query;
  acc[query] = (acc[query] || 0) + 1;
  return acc;
}, {});
```

### Compliance and Audit

```typescript
// Record data access
await client.record({
  eventType: 'data_accessed',
  occurredAt: new Date(),
  data: {
    userId: 123,
    accessedBy: 456, // Admin ID
    dataType: 'personal_information',
    reason: 'Support ticket #789',
  },
});

// Record data modification
await client.record({
  eventType: 'data_modified',
  occurredAt: new Date(),
  data: {
    userId: 123,
    modifiedBy: 456,
    field: 'email',
    oldValue: 'old@example.com',
    newValue: 'new@example.com',
  },
});

// Audit query: who accessed user 123's data?
const accessEvents = await client.findByData('data_accessed', { userId: 123 });
```

## Related Documentation

- [Event Sourcing Explanation](../docs/explanation/event-sourcing.md) - When to use entities vs events
- [Database Schema](../data/migrations/) - Events table schema and indexes
- [Development Setup](../docs/how-to/setup-development.md) - Database setup for events
