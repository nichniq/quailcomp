# Database Client

TypeScript database clients and type definitions for PostgreSQL access.

## Files

- [`entities.ts`](entities.ts) - `EntitiesClient` for mutable state (CRUD operations)
- [`events.ts`](events.ts) - `EventsClient` for immutable facts (append-only)
- [`connection.ts`](connection.ts) - PostgreSQL connection pool configuration
- [`config.ts`](config.ts) - Database configuration from environment variables
- [`types.ts`](types.ts) - Core type definitions for database operations
- [`index.ts`](index.ts) - Public API exports

## Usage

```typescript
import { EntitiesClient, EventsClient } from '@quailcomp/db'

// For mutable data (books, users, etc.)
const entities = new EntitiesClient(db)
await entities.create('book', { title: 'Example', ... })

// For immutable facts (history, audit logs)
const events = new EventsClient(db)
await events.append('book_created', { bookId: '123', ... })
```

## Key Concepts

- **EntitiesClient**: Use for data that changes (current state)
- **EventsClient**: Use for data that never changes (historical facts)
- **Bun SQL**: Uses tagged templates for type safety and SQL injection prevention

## Documentation

- [EntitiesClient Reference](../../../../docs/reference/entities-client.md)
- [EventsClient Reference](../../../../docs/reference/events-client.md)
- [Event Sourcing Explained](../../../../docs/explanation/event-sourcing.md)
