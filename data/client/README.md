# @quailcomp/data

TypeScript client library for all data sources in the Quailcomp project.

## Overview

This package provides type-safe clients for accessing various data sources:
- **`db`** - PostgreSQL database client (entities table with event-sourcing pattern)
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

// Create a client
const client = new EntitiesClient(sql)

// Or use the singleton
const client = new EntitiesClient(getConnection())

// Create an entity
const user = await client.create({
  type: "user",
  data: { name: "Alice", email: "alice@example.com" }
})

// Update an entity (appends new version)
await client.update({
  entityId: user.entity_id,
  type: "user",
  data: { name: "Alice Smith", email: "alice@example.com" }
})

// Get latest version
const latest = await client.getById(user.entity_id)

// Get full history
const history = await client.getHistory(user.entity_id)
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
│       ├── entities.ts       # EntitiesClient (main CRUD operations)
│       └── types.ts          # Type definitions and typed repositories
├── tests/
│   ├── entities.test.ts      # EntitiesClient tests
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

### Event-Sourced Entities

The database uses an append-only event-sourcing pattern:
- Each write creates a new entry (immutable)
- Entries share an `entity_id` to track versions
- Soft deletes via `deleted_at` timestamp
- Full history is preserved

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
