# Entities Table

An append-only, schema-flexible database design for storing diverse data types with full history.

## Design Philosophy

This table is designed for:
- **Immutability**: Entries are never updated or deleted, only appended
- **Schema flexibility**: No predefined schema—each entity type can have any fields in JSONB
- **Full history**: Every change to an entity is preserved as a new entry
- **Simplicity**: Minimal structure, easy to export and migrate to other systems
- **Portability**: Maps cleanly to systems like Datomic if you ever want to migrate

## Schema
```sql
CREATE SEQUENCE entity_id_seq;

CREATE TABLE entities (
  entry_id BIGSERIAL PRIMARY KEY,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  entity_id BIGINT NOT NULL DEFAULT nextval('entity_id_seq')
);

ALTER SEQUENCE entity_id_seq OWNED BY entities.entity_id;
```

### Fields

- **entry_id**: Unique ID for this specific entry in the append-only log (auto-generated)
- **entered_at**: Timestamp when this entry was created (auto-generated)
- **type**: Category of entity (e.g., 'book', 'transaction', 'recipe', 'task')
- **data**: JSONB blob containing the entity's attributes
- **entity_id**: Logical ID grouping entries that describe the same entity (auto-generated for new entities)

### Constraints

A trigger prevents creating new entities with explicit `entity_id` values. This ensures:
- New entities always get auto-generated sequential IDs
- You can only use explicit `entity_id` to add entries to existing entities
- No accidentally skipping sequence values

## Usage Patterns

### Creating New Entities

Don't specify `entity_id`—let it auto-generate:
```sql
-- Create a book
INSERT INTO entities (type, data) 
VALUES ('book', '{"title": "SICP", "isbn": "978-0262510871"}');
-- Returns entity_id = 1

-- Create a recipe
INSERT INTO entities (type, data) 
VALUES ('recipe', '{"title": "Chocolate Cake", "servings": 8}');
-- Returns entity_id = 2
```

### Adding to Existing Entities

Specify the `entity_id` explicitly:
```sql
-- Add acquisition date to the book (entity_id = 1)
INSERT INTO entities (type, entity_id, data) 
VALUES ('book', 1, '{"acquired_date": "2026-01-15"}');

-- Add location info
INSERT INTO entities (type, entity_id, data) 
VALUES ('book', 1, '{"location": "shelf-3"}');
```

### Two Approaches to Updates

**Snapshot approach (recommended for simplicity):**
Store the complete current state in each entry:
```sql
INSERT INTO entities (type, entity_id, data) 
VALUES ('book', 1, '{
  "title": "SICP", 
  "isbn": "978-0262510871",
  "acquired_date": "2026-01-15",
  "location": "shelf-3"
}');
```

**Delta approach (for minimal storage):**
Store only changed fields in each entry:
```sql
-- Initial
INSERT INTO entities (type, data) 
VALUES ('book', '{"title": "SICP"}');

-- Just the new field
INSERT INTO entities (type, entity_id, data) 
VALUES ('book', 1, '{"acquired_date": "2026-01-15"}');
```

## Querying

### Get All Entities of a Type
```sql
SELECT * FROM entities WHERE type = 'book';
```

### Get Current State of an Entity (Snapshot Approach)
```sql
SELECT data 
FROM entities 
WHERE entity_id = 1 
ORDER BY entered_at DESC 
LIMIT 1;
```

### Get Current State (Delta Approach)

Merge all entries for the entity:
```sql
SELECT 
  entity_id,
  jsonb_object_agg(key, value) as current_state
FROM entities,
LATERAL jsonb_each(data)
WHERE entity_id = 1
GROUP BY entity_id;
```

Or create a view for convenience:
```sql
CREATE VIEW current_entities AS
SELECT 
  entity_id,
  type,
  MAX(entered_at) as last_updated,
  jsonb_object_agg(key, value ORDER BY entered_at DESC) as data
FROM entities,
LATERAL jsonb_each(data)
GROUP BY entity_id, type;

-- Then query simply:
SELECT * FROM current_entities WHERE entity_id = 1;
```

### Get Full History of an Entity
```sql
SELECT entered_at, data 
FROM entities 
WHERE entity_id = 1 
ORDER BY entered_at;
```

### Search Across All Entities
```sql
-- Find books by a specific author
SELECT DISTINCT ON (entity_id) *
FROM entities 
WHERE type = 'book' 
  AND data @> '{"author": "Abelson"}'
ORDER BY entity_id, entered_at DESC;

-- Find recent transactions over $100
SELECT * 
FROM entities 
WHERE type = 'transaction'
  AND (data->>'amount')::numeric > 100
  AND entered_at > NOW() - INTERVAL '30 days';
```

## Indexing

Basic indexes to get started:
```sql
-- Query by type
CREATE INDEX ON entities (type, entered_at);

-- Query JSONB fields
CREATE INDEX ON entities USING GIN (data);

-- Query by entity
CREATE INDEX ON entities (entity_id, entered_at);
```

Domain-specific indexes as needed:
```sql
-- Fast ISBN lookups
CREATE INDEX ON entities ((data->>'isbn')) WHERE type = 'book';

-- Fast date queries on transactions
CREATE INDEX ON entities ((data->>'date')) WHERE type = 'transaction';
```

## Referencing Other Entities

Store entity references in JSONB:
```sql
-- A reading note that references a book
INSERT INTO entities (type, data) 
VALUES ('reading_note', '{
  "book_ref": 1,
  "page": 42,
  "content": "Interesting point about abstraction..."
}');

-- Query with join
SELECT 
  n.data as note,
  b.data as book
FROM entities n
JOIN entities b ON b.entity_id = (n.data->>'book_ref')::bigint
WHERE n.type = 'reading_note'
  AND b.type = 'book';
```

## Hierarchical Entities

**Embedded children (for tightly coupled data):**
```sql
INSERT INTO entities (type, data) 
VALUES ('recipe', '{
  "title": "Chocolate Cake",
  "ingredients": [
    {"item": "flour", "amount": "2 cups"},
    {"item": "sugar", "amount": "1.5 cups"}
  ],
  "steps": [
    {"order": 1, "instruction": "Preheat oven"},
    {"order": 2, "instruction": "Mix ingredients"}
  ]
}');
```

**Referenced children (for reusable components):**
```sql
-- Store ingredient references
INSERT INTO entities (type, data) 
VALUES ('recipe', '{
  "title": "Chocolate Cake",
  "ingredient_refs": [1, 2, 3]
}');

-- Separate ingredient entities
INSERT INTO entities (type, data) 
VALUES ('ingredient', '{"name": "Flour", "category": "baking"}');
```

## Export and Migration

### Export to JSON
```bash
# All books
psql -t -c "SELECT jsonb_build_object('entry_id', entry_id, 'entered_at', entered_at, 'data', data) 
FROM entities WHERE type = 'book'" > books.jsonb

# Current state only (snapshot approach)
psql -t -c "SELECT DISTINCT ON (entity_id) jsonb_build_object('entity_id', entity_id, 'data', data)
FROM entities WHERE type = 'book' ORDER BY entity_id, entered_at DESC" > books_current.jsonb
```

### Export to CSV
```bash
psql -c "COPY (SELECT * FROM entities WHERE type = 'book') TO STDOUT WITH CSV HEADER" > books.csv
```

### Migration to Datomic

This schema maps naturally to Datomic:
- Each `type` becomes a namespace for attributes (`:book/...`, `:transaction/...`)
- Each `entity_id` becomes a Datomic entity ID
- Each key in `data` becomes an attribute
- `entered_at` maps to transaction time

## Permissions

Grant appropriate permissions to application users:
```sql
GRANT INSERT, SELECT ON entities TO app_user;
GRANT USAGE ON SEQUENCE entity_id_seq TO app_user;
```

## Anti-Patterns to Avoid

❌ **Don't use UPDATE or DELETE** - defeats the append-only design
❌ **Don't skip entity_id values** - the trigger prevents this anyway
❌ **Don't store huge binary data in JSONB** - link to external storage instead
❌ **Don't put sensitive credentials in data** - use separate secrets management

## When to Use This Design

✅ You want flexible schemas that evolve over time
✅ You need full audit history of changes
✅ You're storing diverse data types in one database
✅ You want easy export/migration to other systems
✅ You value simplicity over complex normalization

❌ You need high-performance transactional workloads
❌ Your schema is stable and well-defined
❌ You need complex relational integrity constraints
❌ You're dealing with massive scale (billions of entries)

## Example: Complete Workflow
```sql
-- Create a book
INSERT INTO entities (type, data) 
VALUES ('book', '{"title": "SICP", "authors": ["Abelson", "Sussman"]}')
RETURNING entity_id;
-- Returns: 1

-- Add purchase info
INSERT INTO entities (type, entity_id, data) 
VALUES ('book', 1, '{"title": "SICP", "authors": ["Abelson", "Sussman"], "acquired_date": "2026-01-15", "price": 45.99}');

-- Add reading progress
INSERT INTO entities (type, entity_id, data) 
VALUES ('book', 1, '{"title": "SICP", "authors": ["Abelson", "Sussman"], "acquired_date": "2026-01-15", "price": 45.99, "current_page": 42}');

-- View history
SELECT entered_at, data->'current_page' as page 
FROM entities 
WHERE entity_id = 1 
ORDER BY entered_at;

-- Get current state
SELECT data 
FROM entities 
WHERE entity_id = 1 
ORDER BY entered_at DESC 
LIMIT 1;
```
