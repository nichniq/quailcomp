# Why Event Sourcing?

This document explains the event-sourcing architecture used in Quailcomp and the reasoning behind it.

## The Core Idea

Traditional databases store **current state**. Event sourcing stores **what happened**.

Instead of updating a record in place, every change creates a new entry. The current state is derived by reading the latest entry. History is preserved automatically.

## Two Fundamental Concepts

Quailcomp distinguishes between two types of data:

### Entities (Nouns)

Things that exist and can change over time.

**Examples:** books, people, locations, accounts

**Characteristics:**

- Have identity that persists across changes
- State evolves over time
- Multiple entries share the same `entity_id`
- Latest entry = current state
- Soft deletes via `deleted_at` timestamp

**Operations:** create, update, delete, getById, getHistory

### Events (Verbs)

Facts about what happened. Immutable once recorded, but enrichable.

**Examples:** purchased, moved, lent, deposited

**Characteristics:**

- Record things that happened
- Original fact is immutable
- Can be enriched with tags, corrections, annotations
- Multiple entries share the same `event_id` (original + enrichments)
- Soft voids via `voided_at` timestamp

**Operations:** record, enrich, void, getByTimeRange

## Why This Separation?

### Entities Answer: "What exists?"

A book entity represents the book itself—its title, author, ISBN, current location. When you update the book's metadata, you're describing the same book with new information.

### Events Answer: "What happened?"

An acquisition event records that you bought the book on January 15th at Powell's Books for $15.99. This fact doesn't change. But you might later add tags, correct a typo in the location, or link it to the person who recommended it.

### The Relationship

Events reference entities but aren't entities themselves:

```
Book Entity (id: 42)
  ├── created: { title: "The Great Gatsby" }
  ├── updated: { title: "The Great Gatsby", notes: "First edition" }
  └── current state: latest entry

Acquisition Event (id: 100)
  ├── recorded: { book_id: 42, method: "purchased", cost: $15.99 }
  ├── enriched: { ..., tags: ["fiction"], receipt: "RCP-123" }
  └── current state: latest enrichment
```

## Benefits

### Complete Audit Trail

Every change is preserved. You can reconstruct the state at any point in time:

```typescript
// What did this book look like on March 1st?
const history = await entities.getHistory(bookId)
const stateOnDate = history.find(e => e.entered_at <= targetDate)
```

### No Lost Data

Traditional updates overwrite data. Event sourcing preserves everything:

```sql
-- Traditional: data is lost
UPDATE books SET title = 'New Title' WHERE id = 42;

-- Event sourcing: original preserved
INSERT INTO entities (entity_id, type, data, entered_at)
VALUES (42, 'book', '{"title": "New Title"}', NOW());
```

### Enrichable Events

Events can be annotated after the fact without changing the original:

```typescript
// Original event
await events.record({
  eventType: 'book_acquired',
  occurredAt: new Date('2024-01-15'),
  data: { book_id: 42, method: 'purchased' }
})

// Later: add tags without changing the original
await events.enrich({
  eventId: eventId,
  eventType: 'book_acquired',
  occurredAt: originalDate,  // preserved
  data: {
    book_id: 42,
    method: 'purchased',
    tags: ['birthday-gift'],  // added later
    notes: 'From grandmother' // added later
  }
})
```

### Temporal Queries

Ask questions about time:

```typescript
// What happened in January?
const events = await events.getByTimeRange(
  new Date('2024-01-01'),
  new Date('2024-01-31')
)

// How has this book changed?
const history = await entities.getHistory(bookId)
```

### Debugging and Recovery

When something goes wrong, you can see exactly what happened:

```typescript
const history = await entities.getHistory(corruptedEntityId)
// Review all changes, find when the bad data was introduced
```

## Trade-offs

### Storage

Event sourcing uses more storage than traditional databases. Each change creates a new row instead of updating in place.

**Mitigation:** Storage is cheap. JSONB compression helps. For most personal data applications, this isn't a concern.

### Query Complexity

Getting current state requires finding the latest entry, not just reading a row.

**Mitigation:** Indexes on `(entity_id, entered_at DESC)` make this fast. The client abstracts this away.

### No True Deletes

Data is never truly deleted, only marked as deleted.

**Mitigation:** This is often a feature, not a bug. For true deletion (GDPR compliance), you'd need a separate data purge process.

## Implementation Details

### Append-Only Tables

Both `entities` and `events` tables are append-only:

```sql
-- New entity
INSERT INTO entities (type, data) VALUES ('book', '{"title": "..."}');
-- Returns new entity_id

-- Update (new entry, same entity_id)
INSERT INTO entities (entity_id, type, data) VALUES (42, 'book', '{"title": "..."}');

-- Soft delete (new entry with deleted_at)
INSERT INTO entities (entity_id, type, data, deleted_at)
VALUES (42, 'book', '{"title": "..."}', NOW());
```

### JSONB for Flexibility

Data is stored as JSONB, allowing:

- Schema flexibility (different books can have different fields)
- Easy evolution (add fields without migrations)
- Powerful queries (`data @> '{"author": "Evans"}'`)

### Timestamps

Two timestamps track different things:

- `entered_at`: When this entry was written to the database
- `occurred_at` (events only): When the event happened in the real world

A book acquisition might have:

- `occurred_at`: January 15th (when you bought it)
- `entered_at`: January 20th (when you recorded it)

## When to Use Which

### Use Entities When

- The thing has identity that persists
- You care about current state
- Changes represent evolution of the same thing
- Examples: users, books, locations, accounts

### Use Events When

- Recording something that happened
- The fact shouldn't change (but can be annotated)
- You need temporal queries
- Examples: purchases, transfers, logins, readings

### Combined Example

```typescript
// Entity: The book itself
const book = await entities.create({
  type: 'book',
  data: { title: 'Domain-Driven Design', author: 'Eric Evans' }
})

// Event: How you acquired it
await events.record({
  eventType: 'book_acquired',
  occurredAt: new Date('2024-01-15'),
  data: {
    book_id: book.entity_id,
    method: 'purchased',
    location: "Powell's Books",
    cost: { amount: 2999, currency: 'USD' }
  }
})

// Later: Update the book
await entities.update({
  entityId: book.entity_id,
  type: 'book',
  data: { ...book.data, notes: 'Classic DDD reference' }
})

// Later: Enrich the event
await events.enrich({
  eventId: acquisitionEvent.event_id,
  eventType: 'book_acquired',
  occurredAt: acquisitionEvent.occurred_at,
  data: { ...acquisitionEvent.data, tags: ['technical', 'ddd'] }
})
```

## Related

- [EntitiesClient Reference](../reference/entities-client.md) - API for mutable entities
- [EventsClient Reference](../reference/events-client.md) - API for immutable events
- [Write Domain Docs](../how-to/write-domain-docs.md) - Documenting domain models
