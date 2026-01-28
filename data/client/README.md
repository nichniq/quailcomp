# @quailcomp/data

TypeScript client library for all data sources in the Quailcomp project.

For complete API documentation, see:

- [EntitiesClient Reference](../../docs/reference/entities-client.md)
- [EventsClient Reference](../../docs/reference/events-client.md)
- [Why Event Sourcing?](../../docs/explanation/event-sourcing.md)

## Overview

This package provides type-safe clients for accessing various data sources:

- **`db`** - PostgreSQL database client
  - **Entities** - Event-sourced mutable state (nouns: books, people, locations)
  - **Events** - Enrichable facts about what happened (verbs: purchased, moved, lent)
- **`fs`** - Filesystem integration *(planned)*
- **`plaid`** - Plaid API client *(planned)*

## Installation

This is a workspace package. Add it to your `package.json`:

```json
{
  "dependencies": {
    "@quailcomp/data": "workspace:*"
  }
}
```

## Quick Start

```typescript
import { EntitiesClient, EventsClient, getConnection } from "@quailcomp/data"

const sql = getConnection()
const entities = new EntitiesClient(sql)
const events = new EventsClient(sql)

// Create an entity
const book = await entities.create({
  type: "book",
  data: { title: "Domain-Driven Design", author: "Eric Evans" }
})

// Record an event
await events.record({
  eventType: "book_acquired",
  occurredAt: new Date(),
  data: { book_id: book.entity_id, method: "purchased" }
})
```

## Structure

```
client/
├── src/
│   ├── index.ts              # Main exports (re-exports from db/, fs/, etc.)
│   └── db/                   # PostgreSQL client
│       ├── index.ts
│       ├── config.ts         # Database configuration
│       ├── connection.ts     # Connection management
│       ├── entities.ts       # EntitiesClient (event-sourced mutable state)
│       ├── events.ts         # EventsClient (immutable facts)
│       └── types.ts          # Type definitions and typed repositories
├── tests/
│   ├── entities.test.ts      # EntitiesClient tests
│   ├── events.test.ts        # EventsClient tests
│   └── types.test.ts         # Type system tests
└── scripts/
    ├── setup-test-db.ts      # Create test database
    └── teardown-test-db.ts   # Drop test database
```

## Testing

```bash
# Run all tests
bun test

# Watch mode
bun test:watch

# Set up test database
bun run setup

# Tear down test database
bun run teardown
```

## Database Schema

The database schema (migrations, setup, teardown) lives in [`../postgres/`](../postgres/). This separation keeps the TypeScript client code separate from raw SQL infrastructure, while maintaining colocation for related concerns.

## Adding New Data Sources

To add a new data source (e.g., filesystem integration):

1. Create `src/fs/` directory with your client code
2. Export it from `src/index.ts`:

   ```typescript
   export * from "./db"
   export * from "./fs"  // new
   ```

3. Add tests in `tests/fs.test.ts`

This keeps all data access logic in one importable package while organizing by data source.

## Design Principles

### Entities vs Events: Nouns vs Verbs

The database distinguishes between two fundamental concepts:

**Entities (Nouns)** - Things that exist and can change:

- Examples: books, people, locations, accounts
- Mutable: Their state evolves over time
- Event-sourced: History preserved via append-only entries
- Each entity has multiple versions sharing an `entity_id`
- Soft deletes via `deleted_at` timestamp
- Query pattern: "What is the current state of X?"

**Events (Verbs)** - Facts about what happened, enrichable over time:

- Examples: purchased, moved, lent, deposited
- Append-only: Original fact preserved, can be enriched with new entries
- Time-ordered by `occurred_at` (when it happened in the real world)
- Reference entities but aren't entities themselves
- Support annotations, corrections, tags, and links added after the fact
- Soft voids via `voided_at` timestamp (for cancelled/invalid events)
- Query patterns:
  - "What happened to entity X?"
  - "Show me all events of type Y"
  - "What happened between date A and B?"

**When to use which:**

- Use **entities** for things that have identity and state
- Use **events** for recording facts about what happened to those entities
- Example: A book (entity) can be acquired, lent, and returned (events)

### Event-Sourced Entities

The entities table uses an append-only event-sourcing pattern:

- Each write creates a new entry (immutable)
- Entries share an `entity_id` to track versions
- Soft deletes via `deleted_at` timestamp
- Full history is preserved
- Latest entry represents current state

### Enrichable Events

The events table uses the same append-only pattern as entities:

- Original event data is preserved (immutable first entry)
- Events can be "enriched" by appending new entries with the same `event_id`
- Each entry is immutable; the latest entry represents current enriched state
- Use enrichments for: tags, corrections, annotations, links to other entities
- `occurred_at` tracks when it happened (fixed, part of the fact)
- `entered_at` tracks when each entry was recorded (changes with enrichments)
- Soft voids via `voided_at` (for events that were recorded in error)

### Type Safety

Multiple typing approaches are provided (see `src/db/types.ts`):

1. Simple type registry (recommended)
2. Discriminated unions (for pattern matching)
3. Versioned types (for schema evolution)
4. Zod schemas (for runtime validation)
5. Generic type parameters (typed repositories)

Choose the approach that fits your needs.

### Colocation

Client code lives near the schema it depends on (`data/client/` and `data/postgres/` are siblings). When you change the schema, you update the client in the same commit, keeping them in sync.
