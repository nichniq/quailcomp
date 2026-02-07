# Entities

> Mutable entity management with append-only versioning and soft deletes.

The Entities domain implements a versioned storage pattern where mutable data is stored as a series of immutable entries. Each "update" appends a new entry rather than modifying existing data, providing automatic history tracking and the ability to reconstruct entity state at any point in time.

This pattern is the foundation for all mutable application data: users, books, series, authentication credentials, and any other data that changes over time. The append-only structure ensures data is never lost, supporting audit trails, debugging, and time-travel queries.

## Event Sourcing Pattern

> Entities are append-only: updates create new entries rather than modifying existing ones.

Traditional databases use UPDATE and DELETE to modify rows in place, losing historical data. The Entities domain uses an event-sourcing-inspired pattern where:

1. **CREATE** - Inserts first entry with new `entity_id`
2. **UPDATE** - Inserts new entry with same `entity_id`, new `data`
3. **DELETE** - Inserts new entry with same `entity_id`, sets `deleted_at`
4. **CURRENT STATE** - Latest entry (by `entered_at`) represents current state

**Benefits:**

- **Audit Trail** - Every change is recorded with timestamp
- **Time Travel** - Reconstruct entity state at any point in history
- **No Data Loss** - Deleted entities remain in database
- **Debugging** - See exactly when and how data changed

**Trade-offs:**

- **Disk Usage** - More storage than in-place updates
- **Query Complexity** - Must filter for latest entry per entity

## Core Types

### Entry

> A single version of an entity at a point in time.

```typescript
export type Entry<T = unknown> = {
  entryId: number;        // Unique ID for this entry (auto-generated)
  enteredAt: Date;        // When this entry was created
  type: string;           // Entity type (e.g., 'user', 'book', 'series')
  data: T;                // Entity data (JSONB, type-safe)
  entityId: number;       // Entity ID (multiple entries share this)
  deletedAt: Date | null; // Soft delete timestamp (null if not deleted)
};
```

**Key Fields:**

- `entryId` - Unique identifier for this specific entry (primary key)
- `entityId` - Shared identifier for all versions of this entity
- `enteredAt` - Timestamp when entry was created (determines latest version)
- `type` - Entity type for filtering (e.g., 'user', 'book')
- `data` - Entity payload, stored as JSONB, type-safe via generic `T`
- `deletedAt` - Soft delete marker (non-null means deleted)

**Invariants:**

- `entryId` is globally unique across all entities
- `entityId` is shared by all versions of the same logical entity
- Latest entry (max `enteredAt` for an `entityId`) is current state
- Soft-deleted entities have latest entry with non-null `deletedAt`

### CRUD Input Types

```typescript
export type CreateEntityInput<T = unknown> = {
  type: string;  // Entity type
  data: T;       // Initial entity data
};

export type UpdateEntityInput<T = unknown> = {
  entityId: number; // Which entity to update
  type: string;     // Entity type (must match existing)
  data: T;          // New entity data
};

export type DeleteEntityInput<T = unknown> = {
  entityId: number; // Which entity to delete
  type: string;     // Entity type (must match existing)
  data: T;          // Final entity data (preserved for audit)
};
```

**Design Notes:**

- `CreateEntityInput` has no `entityId` (auto-generated)
- `UpdateEntityInput` requires `entityId` to append to existing entity
- `DeleteEntityInput` includes `data` to preserve final state

### Query Options

```typescript
export type QueryOptions = {
  /** Include soft-deleted entities (default: false) */
  includeDeleted?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
};
```

## EntitiesClient

> Type-safe client for entity CRUD operations with versioning support.

The `EntitiesClient` provides methods for creating, reading, updating, and deleting entities while maintaining the append-only invariant.

### Create Operations

**Create Single Entity:**

```typescript
const client = createEntitiesClient(sql);

const entry = await client.create({
  type: 'user',
  data: { email: 'alice@example.com', name: 'Alice' },
});

// entry.entityId is auto-generated
// entry.entryId is unique for this version
```

**Create Multiple Entities (Transactional):**

```typescript
const entries = await client.createMany([
  { type: 'book', data: { title: 'Book 1', author: 'Author 1' } },
  { type: 'book', data: { title: 'Book 2', author: 'Author 2' } },
]);

// All succeed or all fail (wrapped in transaction)
```

### Update Operations

**Update Entity (Append New Version):**

```typescript
const updatedEntry = await client.update({
  entityId: 123,
  type: 'user',
  data: { email: 'alice@example.com', name: 'Alice Smith' },
});

// Creates new entry with same entityId, new enteredAt
// Previous entry remains in database
```

### Delete Operations

**Soft Delete (Mark as Deleted):**

```typescript
const deletedEntry = await client.delete({
  entityId: 123,
  type: 'user',
  data: { email: 'alice@example.com', name: 'Alice Smith' },
});

// Creates new entry with deletedAt set
// Entity no longer returned by default queries
```

**Restore Deleted Entity:**

```typescript
const restoredEntry = await client.restore({
  entityId: 123,
  type: 'user',
  data: { email: 'alice@example.com', name: 'Alice Smith' },
});

// Creates new entry with deletedAt = null
// Entity is active again
```

### Read Operations

**Get Latest Version by Entity ID:**

```typescript
const user = await client.getById<UserData>(123);

if (!user) {
  // Entity doesn't exist or is soft-deleted
}

// Include deleted entities
const deletedUser = await client.getById<UserData>(123, { includeDeleted: true });
```

**Get All Versions (History):**

```typescript
const history = await client.getHistory<UserData>(123);

// Returns all entries for entity 123, ordered oldest to newest
// Shows how entity evolved over time
history.forEach((entry) => {
  console.log(`Version at ${entry.enteredAt}:`, entry.data);
});
```

**Get All Entities of a Type:**

```typescript
const users = await client.getByType<UserData>('user');

// Returns latest entry for each user entity
// Excludes soft-deleted by default

const allUsers = await client.getByType<UserData>('user', { includeDeleted: true });
```

**Count Entities:**

```typescript
const activeCount = await client.countByType('user');
const totalCount = await client.countByType('user', { includeDeleted: true });
```

**Check Existence:**

```typescript
const exists = await client.exists(123);

// Returns true if entity exists and is not soft-deleted
```

### Search Operations

**Search by JSONB Data:**

```typescript
// Find users where data contains { status: 'active' }
const activeUsers = await client.findByData<UserData>(
  'user',
  { status: 'active' },
);

// Find books by author
const booksByAuthor = await client.findByData<BookData>(
  'book',
  { author: 'J.K. Rowling' },
  { limit: 10 },
);
```

**JSONB Containment:**

The `findByData()` method uses PostgreSQL's `@>` operator, which checks if the left JSONB contains the right JSONB as a subset.

**Examples:**

- `{ status: 'active' }` matches `{ email: '...', status: 'active', name: '...' }`
- `{ author: 'Alice' }` matches `{ title: 'Book', author: 'Alice', year: 2020 }`
- `{ tags: ['fiction'] }` matches `{ tags: ['fiction', 'sci-fi'] }` (array subset)

## Usage Examples

### Basic Entity Lifecycle

```typescript
import { createEntitiesClient } from '@quailcomp/data';
import { getConnection } from '@quailcomp/data';

const sql = getConnection();
const client = createEntitiesClient(sql);

// 1. Create entity
const created = await client.create({
  type: 'book',
  data: { title: 'The Hobbit', author: 'J.R.R. Tolkien', year: 1937 },
});

console.log('Created:', created.entityId);

// 2. Update entity
const updated = await client.update({
  entityId: created.entityId,
  type: 'book',
  data: { title: 'The Hobbit', author: 'J.R.R. Tolkien', year: 1937, pages: 310 },
});

// 3. Get current state
const current = await client.getById(created.entityId);
console.log('Current:', current?.data);

// 4. View history
const history = await client.getHistory(created.entityId);
console.log('History:', history.length, 'versions');

// 5. Soft delete
await client.delete({
  entityId: created.entityId,
  type: 'book',
  data: current!.data,
});

// 6. Verify deleted
const deleted = await client.getById(created.entityId);
console.log('Deleted:', deleted === null); // true
```

### Type-Safe Entity Data

```typescript
// Define entity data types
type UserData = {
  email: string;
  name: string;
  status: 'active' | 'suspended';
};

type BookData = {
  title: string;
  author: string;
  isbn?: string;
};

// Type-safe operations
const user = await client.create<UserData>({
  type: 'user',
  data: {
    email: 'alice@example.com',
    name: 'Alice',
    status: 'active',
  },
});

// TypeScript knows user.data is UserData
console.log(user.data.email); // OK
console.log(user.data.title); // Error: Property 'title' does not exist
```

### Pagination

```typescript
// Get first page of users
const page1 = await client.getByType<UserData>('user', {
  limit: 10,
  offset: 0,
});

// Get second page
const page2 = await client.getByType<UserData>('user', {
  limit: 10,
  offset: 10,
});

// Get total count
const total = await client.countByType('user');
const pages = Math.ceil(total / 10);
```

### Complex JSONB Queries

```typescript
// Find users by nested fields
const users = await client.findByData<UserData>(
  'user',
  { preferences: { theme: 'dark' } },
);

// Find books by partial match
const sciFiBooks = await client.findByData<BookData>(
  'book',
  { genres: ['science-fiction'] }, // Matches if array contains 'science-fiction'
);
```

### Transactional Updates

```typescript
// Update multiple related entities atomically
await sql.begin(async (tx) => {
  const txClient = createEntitiesClient(tx);

  // Create user
  const user = await txClient.create({
    type: 'user',
    data: { email: 'bob@example.com', name: 'Bob' },
  });

  // Create associated profile
  await txClient.create({
    type: 'profile',
    data: { userId: user.entityId, bio: 'Software engineer' },
  });

  // If either fails, both roll back
});
```

## Integration Points

- **[Database Domain](./database.md)** - Uses `Sql` connection for query execution
- **[Errors Domain](./errors.md)** - Database errors are parsed and transformed (unique violations, foreign keys)
- **[HTTP Domain](./http.md)** - Handlers use `ctx.sql` to create `EntitiesClient` for request-scoped operations
- **[Events Domain](./events.md)** - Events are immutable facts; entities are mutable state (use both together)
- **[WebSocket Domain](./websocket.md)** - Entity changes trigger WebSocket broadcasts (entity.created, entity.updated, entity.deleted)

## Invariants

1. **Append-Only** - Existing entries are never modified (only new entries are inserted)
2. **Latest Entry is Current** - Maximum `entered_at` for an `entity_id` determines current state
3. **Soft Deletes** - Deleted entities have latest entry with non-null `deleted_at`
4. **Type Consistency** - All entries for an `entity_id` must have the same `type`
5. **Auto-Generated IDs** - `entity_id` comes from `entity_id_seq` sequence
6. **JSONB Data** - Entity `data` is stored as JSONB and automatically parsed
7. **Transaction Safety** - `createMany()` is atomic (all succeed or all fail)

## Use Cases

### User Management

```typescript
// Create user
const user = await client.create<UserData>({
  type: 'user',
  data: { email: 'alice@example.com', name: 'Alice', status: 'active' },
});

// Update user profile
await client.update<UserData>({
  entityId: user.entityId,
  type: 'user',
  data: { ...user.data, name: 'Alice Smith' },
});

// Suspend user
await client.update<UserData>({
  entityId: user.entityId,
  type: 'user',
  data: { ...user.data, status: 'suspended' },
});

// View audit trail
const history = await client.getHistory<UserData>(user.entityId);
```

### Book Library

```typescript
// Add book to library
const book = await client.create<BookData>({
  type: 'book',
  data: { title: 'The Hobbit', author: 'J.R.R. Tolkien' },
});

// Update book metadata
await client.update<BookData>({
  entityId: book.entityId,
  type: 'book',
  data: { ...book.data, isbn: '978-0547928227', year: 1937 },
});

// Remove book from library (soft delete)
await client.delete<BookData>({
  entityId: book.entityId,
  type: 'book',
  data: book.data,
});

// Restore book
await client.restore<BookData>({
  entityId: book.entityId,
  type: 'book',
  data: book.data,
});
```

### Search and Filter

```typescript
// Find active users
const activeUsers = await client.findByData<UserData>(
  'user',
  { status: 'active' },
);

// Find books by author
const tolkienBooks = await client.findByData<BookData>(
  'book',
  { author: 'J.R.R. Tolkien' },
);

// List all users (paginated)
const users = await client.getByType<UserData>('user', {
  limit: 20,
  offset: 0,
});
```

### Audit and Debugging

```typescript
// View entity evolution
const history = await client.getHistory<UserData>(userId);

history.forEach((entry, index) => {
  console.log(`Version ${index + 1} at ${entry.enteredAt}:`);
  console.log('Data:', entry.data);
  console.log('Deleted:', entry.deletedAt !== null);
});

// Find when entity was deleted
const deletedEntry = history.find((e) => e.deletedAt !== null);
if (deletedEntry) {
  console.log('Deleted at:', deletedEntry.deletedAt);
}
```

### Batch Operations

```typescript
// Create multiple entities efficiently
const books = await client.createMany<BookData>([
  { type: 'book', data: { title: 'Book 1', author: 'Author 1' } },
  { type: 'book', data: { title: 'Book 2', author: 'Author 2' } },
  { type: 'book', data: { title: 'Book 3', author: 'Author 3' } },
]);

console.log(`Created ${books.length} books`);
```

## Related Documentation

- [Event Sourcing Explanation](../docs/explanation/event-sourcing.md) - When to use entities vs events
- [Database Schema](../data/migrations/) - Entities table schema and indexes
- [Development Setup](../docs/how-to/setup-development.md) - Database setup for entities
