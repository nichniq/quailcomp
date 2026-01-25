# @quailcomp/data

TypeScript client library for all data sources in the Quailcomp project.

## Overview

This package provides type-safe clients for accessing various data sources:
- **`db`** - PostgreSQL database client
  - **Entities** - Event-sourced mutable state (nouns: books, people, locations)
  - **Events** - Immutable facts about what happened (verbs: purchased, moved, lent)
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

## Usage

### Database Client

#### Entities Client (Mutable State)

Use the entities client for things that exist and can change over time:

```typescript
import { EntitiesClient, createConnection, getConnection } from "@quailcomp/data"

// Create a connection
const sql = createConnection({
  host: "localhost",
  port: 5432,
  database: "quailcomp",
  user: "quailcomp_app",
  password: process.env.DB_PASSWORD
})

// Create an entities client
const entities = new EntitiesClient(sql)

// Or use the singleton
const entities = new EntitiesClient(getConnection())

// Create an entity
const user = await entities.create({
  type: "user",
  data: { name: "Alice", email: "alice@example.com" }
})

// Update an entity (appends new version)
await entities.update({
  entityId: user.entityId,
  type: "user",
  data: { name: "Alice Smith", email: "alice@example.com" }
})

// Get latest version
const latest = await entities.getById(user.entityId)

// Get full history
const history = await entities.getHistory(user.entityId)
```

#### Events Client (Immutable Facts)

Use the events client for recording what happened (cannot be changed later):

```typescript
import { EventsClient, getConnection } from "@quailcomp/data"

const events = new EventsClient(getConnection())

// Record an event
const event = await events.record({
  eventId: "evt_123",
  eventType: "book_acquired",
  occurredAt: new Date("2026-01-15"),
  data: {
    book_id: 42,
    title: "The Great Gatsby",
    price: 15.99
  }
})

// Find events by type
const acquisitions = await events.findByType("book_acquired")

// Find events for a specific entity
const bookHistory = await events.findForEntity("book_id", 42)

// Find events in a time range
const january = await events.findByTimeRange(
  new Date("2026-01-01"),
  new Date("2026-01-31")
)

// Query by JSONB data
const expensiveBooks = await events.findByData({
  event_type: "book_acquired",
  price: { $gt: 20 }
})
```

### Typed Repository Pattern

For better type safety, use typed repositories:

```typescript
import { createUserRepository, type UserData } from "@quailcomp/data"

const users = createUserRepository(sql)

const user = await users.create({
  name: "Alice",
  email: "alice@example.com",
  role: "admin"
})

// TypeScript knows user.data is UserData
console.log(user.data.name)
```

See [`src/db/types.ts`](./src/db/types.ts) for different typing approaches.

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

**Events (Verbs)** - Immutable facts about what happened:
- Examples: purchased, moved, lent, deposited
- Immutable: Cannot be updated after recording
- Time-ordered by `occurred_at` (when it happened)
- Reference entities but aren't entities themselves
- Trigger-enforced immutability
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

### Immutable Events

The events table enforces strict immutability:
- Events are never updated or deleted
- Database trigger blocks any UPDATE operations
- Corrections require recording a new correction event
- `occurred_at` tracks when it happened (can be historical)
- `recorded_at` tracks when we logged it (always now)

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
