# EntitiesClient API Reference

The `EntitiesClient` provides access to event-sourced mutable entities.

## Import

```typescript
import { EntitiesClient, getConnection } from '@quailcomp/data'

const sql = getConnection()
const entities = new EntitiesClient(sql)
```

## Methods

### create

Create a new entity with auto-generated `entity_id`.

```typescript
create<T>(input: CreateEntityInput<T>): Promise<EntityEntry<T>>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `input.type` | `string` | Entity type (e.g., `'book'`, `'user'`) |
| `input.data` | `T` | Entity data as JSONB |

**Returns:** The created entity entry with generated `entity_id`.

**Example:**

```typescript
const book = await entities.create({
  type: 'book',
  data: {
    title: 'Domain-Driven Design',
    author: 'Eric Evans',
    isbn: '9780321125215'
  }
})

console.log(book.entity_id)  // Auto-generated
console.log(book.data.title) // 'Domain-Driven Design'
```

### update

Append a new version of an existing entity.

```typescript
update<T>(input: UpdateEntityInput<T>): Promise<EntityEntry<T>>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `input.entityId` | `number` | Existing entity ID |
| `input.type` | `string` | Entity type |
| `input.data` | `T` | New entity data (complete replacement) |

**Returns:** The new entity entry.

**Example:**

```typescript
const updated = await entities.update({
  entityId: book.entity_id,
  type: 'book',
  data: {
    title: 'Domain-Driven Design',
    author: 'Eric Evans',
    isbn: '9780321125215',
    notes: 'Classic DDD reference'  // Added field
  }
})
```

**Note:** The `data` field is a complete replacement, not a merge. Include all fields you want to preserve.

### delete

Soft delete an entity by setting `deleted_at`.

```typescript
delete<T>(input: DeleteEntityInput<T>): Promise<EntityEntry<T>>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `input.entityId` | `number` | Entity ID to delete |
| `input.type` | `string` | Entity type |
| `input.data` | `T` | Final entity data |

**Returns:** The deletion entry with `deleted_at` set.

**Example:**

```typescript
const deleted = await entities.delete({
  entityId: book.entity_id,
  type: 'book',
  data: book.data
})

console.log(deleted.deleted_at)  // Timestamp
```

### getById

Get the latest version of an entity.

```typescript
getById<T>(entityId: number, options?: QueryOptions): Promise<EntityEntry<T> | null>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `entityId` | `number` | Entity ID |
| `options.includeDeleted` | `boolean` | Include soft-deleted entities (default: `false`) |

**Returns:** The latest entity entry, or `null` if not found.

**Example:**

```typescript
const book = await entities.getById(42)
if (book) {
  console.log(book.data.title)
}

// Include deleted
const maybeDeleted = await entities.getById(42, { includeDeleted: true })
```

### getHistory

Get all versions of an entity.

```typescript
getHistory<T>(entityId: number, options?: QueryOptions): Promise<EntityEntry<T>[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `entityId` | `number` | Entity ID |
| `options.includeDeleted` | `boolean` | Include soft-deleted entries (default: `false`) |

**Returns:** Array of entries ordered by `entered_at` ascending (oldest first).

**Example:**

```typescript
const history = await entities.getHistory(42)

for (const version of history) {
  console.log(`${version.entered_at}: ${version.data.title}`)
}
```

### getByType

Get all entities of a specific type.

```typescript
getByType<T>(type: string, options?: QueryOptions): Promise<EntityEntry<T>[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `type` | `string` | Entity type |
| `options.includeDeleted` | `boolean` | Include soft-deleted entities (default: `false`) |
| `options.limit` | `number` | Maximum results |
| `options.offset` | `number` | Skip first N results |

**Returns:** Array of latest versions for each entity of the type.

**Example:**

```typescript
const books = await entities.getByType('book', { limit: 10, offset: 0 })

for (const book of books) {
  console.log(book.data.title)
}
```

### findByData

Search entities by JSONB data content.

```typescript
findByData<T>(type: string, criteria: Partial<T>, options?: QueryOptions): Promise<EntityEntry<T>[]>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `type` | `string` | Entity type |
| `criteria` | `Partial<T>` | JSONB containment criteria |
| `options.includeDeleted` | `boolean` | Include soft-deleted entities |
| `options.limit` | `number` | Maximum results |
| `options.offset` | `number` | Skip first N results |

**Returns:** Entities whose data contains the criteria.

**Example:**

```typescript
// Find books by author
const evansBooks = await entities.findByData('book', {
  author: 'Eric Evans'
})

// Search nested fields
const darkTheme = await entities.findByData('user', {
  preferences: { theme: 'dark' }
})
```

## Types

### EntityEntry

```typescript
interface EntityEntry<T = unknown> {
  id: number;           // Row ID (internal)
  entity_id: number;    // Entity ID (shared across versions)
  type: string;         // Entity type
  data: T;              // Entity data
  entered_at: Date;     // When this entry was created
  deleted_at: Date | null;  // Soft delete timestamp
}
```

### QueryOptions

```typescript
interface QueryOptions {
  includeDeleted?: boolean;  // Include soft-deleted entities
  limit?: number;            // Maximum results
  offset?: number;           // Skip first N results
}
```

## Typed Repositories

For better type safety, create typed repositories:

```typescript
import { EntitiesClient, getConnection } from '@quailcomp/data'

interface BookData {
  title: string;
  author?: string;
  isbn?: string;
  notes?: string;
}

const sql = getConnection()
const entities = new EntitiesClient(sql)

// Type-safe operations
const book = await entities.create<BookData>({
  type: 'book',
  data: { title: 'My Book' }
})

// book.data is typed as BookData
console.log(book.data.title)
```

See [data/client/src/db/types.ts](/data/client/src/db/types.ts) for advanced typing patterns.

## Related

- [EventsClient Reference](events-client.md) - Immutable events API
- [Event Sourcing](../explanation/event-sourcing.md) - Why append-only
- [@quailcomp/data README](/data/client/README.md) - Package documentation
