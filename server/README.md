# Quailcomp Server

TypeScript database client for the quailcomp event-sourced append-only database.

Uses **Bun's built-in SQL support** for PostgreSQL - no external database drivers needed!

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime installed (v1.0.25+ for SQL support)
- PostgreSQL 16+ running locally
- Database setup completed (see `db/setup/`)

### Installation

```bash
cd server
bun install
```

### Running Tests

```bash
# 1. Set up the test database (first time only, or to reset)
bun run db:setup

# 2. Run all tests
bun test

# 3. Run tests in watch mode (for development)
bun test --watch

# 4. Tear down the test database (optional cleanup)
bun run db:teardown
```

## Project Structure

```
server/
├── src/
│   ├── db/
│   │   ├── config.ts      # Database configuration
│   │   ├── connection.ts  # Connection management
│   │   ├── entities.ts    # Entities table client
│   │   └── index.ts       # Module exports
│   └── types/
│       └── entities.ts    # TypeScript typing approaches
├── tests/
│   ├── entities.test.ts   # Comprehensive entity tests
│   └── types.test.ts      # Type system tests
├── scripts/
│   ├── setup-test-db.ts   # Create test database
│   └── teardown-test-db.ts # Drop test database
├── package.json
└── tsconfig.json
```

## Database Configuration

Configuration is loaded from environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `quailcomp` | Database name |
| `DB_USER` | `quailcomp_app` | Database user |
| `DB_PASSWORD` | (empty) | Database password |
| `DB_TEST_NAME` | `quailcomp_test` | Test database name |
| `DB_SUPERUSER` | `$USER` | Superuser for setup scripts |

For local development with the default setup, you may need to set your password:

```bash
export DB_PASSWORD="your_password"
```

## Usage Guide

### Basic Usage

```typescript
import { createConnection, createEntitiesClient } from "./src/db";

// Create connection and client
const sql = createConnection(getDbConfig());
const entities = createEntitiesClient(sql);

// Create a new entity (auto-generated entity_id)
const user = await entities.create({
  type: "user",
  data: { name: "Alice", email: "alice@example.com" },
});
console.log(`Created user with entity_id: ${user.entityId}`);

// Update an entity (adds new entry, same entity_id)
const updated = await entities.update({
  entityId: user.entityId,
  type: "user",
  data: { name: "Alice Updated", email: "alice@example.com" },
});

// Get latest version
const latest = await entities.getById(user.entityId);

// Get full history
const history = await entities.getHistory(user.entityId);

// Soft delete
const deleted = await entities.delete({
  entityId: user.entityId,
  type: "user",
  data: latest.data,
});

// Close connection when done
await sql.end();
```

### Using Typed Repositories

For better type safety, use the typed repository pattern:

```typescript
import { createConnection } from "./src/db";
import { createUserRepository, type UserData } from "./src/types/entities";

const sql = createConnection(getDbConfig());
const users = createUserRepository(sql);

// All operations are fully typed
const user = await users.create({
  name: "Bob",
  email: "bob@example.com",
  role: "user", // TypeScript knows this must be 'admin' | 'user' | 'guest'
});

// user.data is typed as UserData
console.log(user.data.email); // TypeScript knows this exists

// Search with type-safe queries
const admins = await users.findByData({ role: "admin" });
```

### Query Options

Most read operations support these options:

```typescript
interface QueryOptions {
  includeDeleted?: boolean; // Include soft-deleted entities (default: false)
  limit?: number;           // Limit results
  offset?: number;          // Skip first N results
}

// Examples
const allUsers = await entities.getByType("user", { limit: 10, offset: 20 });
const withDeleted = await entities.getById(123, { includeDeleted: true });
```

### JSONB Search

Search entities by data content:

```typescript
// Find all active users
const activeUsers = await entities.findByData("user", { status: "active" });

// Search nested fields
const darkTheme = await entities.findByData("user", {
  preferences: { theme: "dark" },
});
```

## TypeScript Typing Approaches

The `src/types/entities.ts` file demonstrates five different approaches to typing entities:

### 1. Simple Type Registry (Recommended for starting)

Define a mapping of entity types to their data types:

```typescript
interface EntityTypeRegistry {
  user: UserData;
  product: ProductData;
  order: OrderData;
}
```

### 2. Discriminated Unions (Best for pattern matching)

Use switch statements with exhaustive type checking:

```typescript
function processEntry(entry: TypedEntry) {
  switch (entry.type) {
    case "user":
      console.log(entry.data.email); // TypeScript knows it's UserData
      break;
    case "product":
      console.log(entry.data.price); // TypeScript knows it's ProductData
      break;
  }
}
```

### 3. Versioned Types (Best for schema evolution)

Handle schema changes over time:

```typescript
interface UserDataV1 { _version: 1; name: string; email: string; }
interface UserDataV2 { _version: 2; name: string; email: string; role: string; }
interface UserDataV3 { _version: 3; firstName: string; lastName: string; ... }

// Upgrade function handles migration
const current = upgradeUserData(oldData);
```

### 4. Zod Schemas (Best for runtime validation)

Use Zod for runtime validation (requires `bun add zod`):

```typescript
import { z } from "zod";

const UserDataSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "user", "guest"]),
});

type UserData = z.infer<typeof UserDataSchema>;
```

### 5. Generic Type Parameters (Best for reusable components)

Create type-safe repositories:

```typescript
const userRepo = new TypedEntityRepository<UserData>(sql, "user");
const productRepo = new TypedEntityRepository<ProductData>(sql, "product");
```

## Test Plan Overview

The test suite covers:

1. **Setup & Connection** - Database connectivity and schema verification
2. **Create Operations** - Entity creation, auto-increment, transactions
3. **Update Operations** - Append-only updates, sequence preservation
4. **Delete Operations** - Soft delete, restore, query exclusion
5. **Read Operations** - Get by ID, history, type queries, counting
6. **Search Operations** - JSONB containment queries
7. **Edge Cases** - Empty data, large payloads, special characters
8. **Trigger Validation** - entity_id validation rules
9. **Index Effectiveness** - Query plan verification

## How Testing Works

### Why a Separate Test Database?

Tests use a dedicated `quailcomp_test` database to:

- Avoid polluting development/production data
- Allow destructive test operations
- Enable fresh state for consistent results

### Test Database Setup

The setup script (`scripts/setup-test-db.ts`):

1. Connects as superuser to create the test database
2. Mirrors the schema/privilege setup from `db/setup/`
3. Runs migrations from `db/migrations/`
4. Grants permissions to `quailcomp_app`

### Running Tests

Bun's built-in test runner executes tests:

- Tests run in the order defined in test files
- `beforeAll`/`afterAll` hooks manage connections
- Each test file runs in isolation

### Test Isolation Strategy

Tests create unique data using timestamps to avoid conflicts:

```typescript
const uniqueType = `product_${Date.now()}`;
await client.create({ type: uniqueType, data: {...} });
```

This allows tests to run without needing to truncate tables between tests.

## Troubleshooting

### "permission denied" errors

Ensure `quailcomp_app` has the correct permissions:

```sql
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO quailcomp_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO quailcomp_app;
```

### "role does not exist" errors

Run the setup scripts in order:

```bash
cd db/setup
./run.sh
```

### Test database connection fails

Check that:

1. PostgreSQL is running: `pg_isready`
2. Test database exists: `psql -l | grep quailcomp_test`
3. Environment variables are set correctly

### Trigger errors on insert

The validation trigger prevents creating entities with explicit entity_ids that don't exist. To create a new entity, omit the entity_id field.

## Next Steps

After validating your design with tests:

1. Run the migration on your development database:

   ```bash
   psql -U quailcomp_owner -d quailcomp -f db/migrations/001_entities.sql
   ```

2. Build application features using the typed client

3. Add more entity types to `src/types/entities.ts`

4. Consider adding Zod for API boundary validation
