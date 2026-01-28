# EventsClient API Reference

The `EventsClient` provides access to immutable, enrichable events.

## Import

```typescript
import { EventsClient, getConnection } from '@quailcomp/data'

const sql = getConnection()
const events = new EventsClient(sql)
```

## Methods

### record

Record a new event with auto-generated `event_id`.

```typescript
record<T>(input: RecordEventInput<T>): Promise<EventEntry<T>>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `input.eventType` | `string` | Event type (e.g., `'book_acquired'`) |
| `input.occurredAt` | `Date` | When the event happened in the real world |
| `input.data` | `T` | Event data as JSONB |

**Returns:** The recorded event entry with generated `event_id`.

**Example:**

```typescript
const acquisition = await events.record({
  eventType: 'book_acquired',
  occurredAt: new Date('2024-01-15'),
  data: {
    book_id: 42,
    method: 'purchased',
    location: "Powell's Books",
    cost: { amount: 2999, currency: 'USD' }
  }
})

console.log(acquisition.event_id)  // Auto-generated
```

### enrich

Add information to an existing event (append-only).

```typescript
enrich<T>(input: EnrichEventInput<T>): Promise<EventEntry<T>>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `input.eventId` | `number` | Existing event ID |
| `input.eventType` | `string` | Event type (must match original) |
| `input.occurredAt` | `Date` | Original occurrence time (preserved) |
| `input.data` | `T` | Enriched event data (complete replacement) |

**Returns:** The new enriched entry.

**Example:**

```typescript
const enriched = await events.enrich({
  eventId: acquisition.event_id,
  eventType: 'book_acquired',
  occurredAt: acquisition.occurred_at,  // Preserved
  data: {
    book_id: 42,
    method: 'purchased',
    location: "Powell's Books",
    cost: { amount: 2999, currency: 'USD' },
    tags: ['fiction', 'classic'],     // Added later
    notes: 'Gift from grandmother'    // Added later
  }
})
```

**Note:** The `data` field is a complete replacement. Include all original fields plus new enrichments.

### void

Soft void an event (mark as invalid/cancelled).

```typescript
void<T>(input: VoidEventInput<T>): Promise<EventEntry<T>>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `input.eventId` | `number` | Event ID to void |
| `input.eventType` | `string` | Event type |
| `input.occurredAt` | `Date` | Original occurrence time |
| `input.data` | `T` | Event data |

**Returns:** The void entry with `voided_at` set.

**Example:**

```typescript
const voided = await events.void({
  eventId: acquisition.event_id,
  eventType: acquisition.event_type,
  occurredAt: acquisition.occurred_at,
  data: acquisition.data
})

console.log(voided.voided_at)  // Timestamp
```

### getById

Get the latest (enriched) version of an event.

```typescript
getById<T>(eventId: number, options?: QueryOptions): Promise<EventEntry<T> | null>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventId` | `number` | Event ID |
| `options.includeVoided` | `boolean` | Include voided events (default: `false`) |

**Returns:** The latest event entry, or `null` if not found.

**Example:**

```typescript
const event = await events.getById(100)
if (event) {
  console.log(event.data.tags)  // Includes enrichments
}
```

### getHistory

Get all versions of an event (original + enrichments).

```typescript
getHistory<T>(eventId: number, options?: QueryOptions): Promise<EventEntry<T>[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventId` | `number` | Event ID |
| `options.includeVoided` | `boolean` | Include voided entries |

**Returns:** Array of entries ordered by `entered_at` ascending.

**Example:**

```typescript
const history = await events.getHistory(100)

for (const version of history) {
  console.log(`${version.entered_at}: ${JSON.stringify(version.data)}`)
}
```

### getByType

Get all events of a specific type.

```typescript
getByType<T>(eventType: string, options?: QueryOptions): Promise<EventEntry<T>[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `eventType` | `string` | Event type |
| `options.includeVoided` | `boolean` | Include voided events |
| `options.limit` | `number` | Maximum results |
| `options.offset` | `number` | Skip first N results |

**Returns:** Array of latest versions for each event of the type.

**Example:**

```typescript
const acquisitions = await events.getByType('book_acquired')

for (const event of acquisitions) {
  console.log(`${event.occurred_at}: ${event.data.book_id}`)
}
```

### findForEntity

Find events related to a specific entity.

```typescript
findForEntity<T>(fieldName: string, value: unknown, options?: QueryOptions): Promise<EventEntry<T>[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `fieldName` | `string` | JSONB field to search |
| `value` | `unknown` | Value to match |
| `options.includeVoided` | `boolean` | Include voided events |

**Returns:** Events where `data[fieldName] = value`.

**Example:**

```typescript
// All events for book 42
const bookEvents = await events.findForEntity('book_id', 42)

for (const event of bookEvents) {
  console.log(`${event.event_type}: ${event.occurred_at}`)
}
```

### getByTimeRange

Get events within a time range.

```typescript
getByTimeRange<T>(start: Date, end: Date, options?: QueryOptions): Promise<EventEntry<T>[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `start` | `Date` | Start of range (inclusive) |
| `end` | `Date` | End of range (inclusive) |
| `options.includeVoided` | `boolean` | Include voided events |
| `options.limit` | `number` | Maximum results |

**Returns:** Events where `occurred_at` is within the range.

**Example:**

```typescript
const january = await events.getByTimeRange(
  new Date('2024-01-01'),
  new Date('2024-01-31')
)

for (const event of january) {
  console.log(`${event.event_type}: ${event.occurred_at}`)
}
```

## Types

### EventEntry

```typescript
interface EventEntry<T = unknown> {
  id: number;              // Row ID (internal)
  event_id: number;        // Event ID (shared across enrichments)
  event_type: string;      // Event type
  occurred_at: Date;       // When it happened (fixed)
  data: T;                 // Event data
  entered_at: Date;        // When this entry was created
  voided_at: Date | null;  // Soft void timestamp
}
```

### QueryOptions

```typescript
interface QueryOptions {
  includeVoided?: boolean;  // Include voided events
  limit?: number;           // Maximum results
  offset?: number;          // Skip first N results
}
```

## Timestamps Explained

Events have two timestamps:

| Timestamp | Meaning | Mutability |
|-----------|---------|------------|
| `occurred_at` | When the event happened in the real world | Fixed at recording |
| `entered_at` | When this database entry was created | New for each enrichment |

Example:

```typescript
// Bought a book on January 15th
const event = await events.record({
  eventType: 'book_acquired',
  occurredAt: new Date('2024-01-15'),  // Fixed
  data: { book_id: 42 }
})
// event.entered_at = now (e.g., January 20th)

// Later: enrich with tags
await events.enrich({
  eventId: event.event_id,
  eventType: 'book_acquired',
  occurredAt: event.occurred_at,  // Still January 15th
  data: { book_id: 42, tags: ['gift'] }
})
// New entry has entered_at = now (e.g., February 1st)
// But occurred_at stays January 15th
```

## Related

- [EntitiesClient Reference](entities-client.md) - Mutable entities API
- [Event Sourcing](../explanation/event-sourcing.md) - Why events vs entities
- [@quailcomp/data README](/data/client/README.md) - Package documentation
