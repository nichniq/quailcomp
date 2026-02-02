# People

> Tracks individuals related to books in the collection.

People can be authors, contributors, gift-givers, or borrowers. This domain provides a central registry to track relationships with books.

## Person Entity

> An individual person with contact and relationship information.

```typescript
export type Person = {
  entity_id: string
  name: string
  email?: string
  phone?: string
  notes?: string
  relationships: PersonRelationship[]
}

export type PersonRelationship =
  | 'author'
  | 'contributor'
  | 'gift_giver'
  | 'borrower'
  | 'other'

export type PersonEntitySnapshot = {
  name: string
  email?: string
  phone?: string
  notes?: string
  relationships: PersonRelationship[]
}

export type PersonEntityRow = {
  entity_id: number
  entity_type: 'person'
  data: PersonEntitySnapshot
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}
```

## Query Result Types

```typescript
export type PersonListItem = {
  entity_id: string
  name: string
  relationships: PersonRelationship[]
  book_count?: number
}

export type PersonWithBooks = {
  person: Person
  books_given?: number
  books_borrowed?: number
}
```

## Invariants

- Every person must have a `name` (required field)
- The `relationships` array must contain at least one valid `PersonRelationship` value
- Email addresses, if provided, should be valid email format (validation at API layer)
- Phone numbers are stored as strings without format validation (international flexibility)
- Entity IDs are auto-generated integers, exposed as strings in the API

## Use Cases

### Primary Use Cases

1. **Track Gift-Givers**: Record who gave books as gifts
   - Links to `GivenAcquisition.person_id` in the Books domain
   - Enables queries like "all books given by Jane"

2. **Track Borrowers**: Record who borrowed books (future feature)
   - Links to `LentEvent.person_id` in the Books domain
   - Enables queries like "books currently lent to John"

3. **Author Registry**: Maintain a list of authors in your collection
   - Can be used for author-based searches and filtering
   - Supports multi-author books via multiple person references

4. **Contact Management**: Store contact information for book-related people
   - Email and phone for coordinating returns or recommendations
   - Notes field for freeform information

### Query Patterns

- List all people with a specific relationship type
- Find all books associated with a person
- Search people by name (case-insensitive, fuzzy matching via trigram index)
- Find people by email address

## References to Other Domains

### Books Domain

The Books domain references People through:

- `GivenAcquisition.person_id` - Who gave the book
- `LentEvent.person_id` - Who borrowed the book (future)

These references are stored as foreign keys pointing to `entities.entity_id` where `type='person'`.

## Authorization

People entities follow the standard authorization model:

- **Owner**: Full control (read, write, delete, share)
- **Write**: Can read and modify person details
- **Read**: Can view person details but not modify

When a person is created, the creator automatically receives `owner` access.

## Implementation Notes

- Uses the shared `entities` table (no dedicated table)
- Indexed fields: name (trigram GIN), email (B-tree), relationships (JSONB)
- Soft deletion: `deleted_at` field, filtered in queries
- Audit trail: Full history via event sourcing
