# CLAUDE.md

Quailcomp is a personal data management system using event-sourced append-only storage. TypeScript monorepo with Bun runtime and PostgreSQL 16.

## Commands

```bash
bun test                 # Run all tests (do this after code changes)
bun test:watch           # Watch mode for data/client
bun run db:setup         # Create test database and schema
bun run db:teardown      # Drop test database
bun run db:migrate       # Run pending migrations on existing database
```

## Rules

- Run `bun test` after modifying code to verify changes
- Use Bun's built-in SQL tagged templates for all queries (not raw strings)
- Use `EntitiesClient` for mutable data, `EventsClient` for immutable facts
- Tests must use unique type names (with timestamps) to avoid conflicts
- New migrations must follow naming: `NNN_description.sql` (zero-padded numbers)
- Migrations must be idempotent (safe to run multiple times)
- Never modify existing migration files (checksums are tracked)
- Migrations run as quailcomp_owner, test idempotency before committing
- Double check this file when changes are made to ensure it remains up to date

## Avoid

- External PostgreSQL drivers (Bun has built-in support)
- Truncating tables in tests
- Direct SQL string concatenation (SQL injection risk)

## Project Structure

```
data/client/       # @quailcomp/data - EntitiesClient, EventsClient, connection
data/postgres/     # SQL: setup/, teardown/, migrations/
server/            # Application server
domains/           # DDD domain models and documentation
```

## Patterns

- **Entities**: Append-only entries sharing `entity_id`. Latest = current state.
- **Events**: Immutable facts, can be enriched. Grouped by `event_id`.
- **Migrations**: Tracked in schema_migrations table (version, applied_at, checksum)
  - Migration runner: `data/postgres/migrations/run.sh`
  - Auto-discovery via filename pattern: `[0-9][0-9][0-9]_*.sql`
- Soft deletes via `deleted_at` / `voided_at` timestamps
- JSONB for flexible schema storage

## Database Roles

- `quailcomp_app`: Application role (use this for connections)
- `quailcomp_test`: Test database

---

## Reference

### Tech Stack

- **Runtime**: Bun 1.3.6+ (TypeScript execution, built-in PostgreSQL support)
- **Database**: PostgreSQL 16 with JSONB storage
- **Language**: TypeScript (ES2022, strict mode)
- **Architecture**: Event sourcing, domain-driven design

### Environment Variables

```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
DB_TEST_NAME (default: quailcomp_test)
```

### Data Access APIs

**EntitiesClient** (mutable state):
- `create<T>(input)` - Auto-generates entity_id
- `update<T>(entityId, data)` - Appends new version
- `getById(entityId)` - Latest version
- `getHistory(entityId)` - Full history
- `delete(entityId, data)` - Soft delete
- `getByType(type, options)` - Query by entity type
- `findByData(type, criteria)` - JSONB search

**EventsClient** (immutable facts):
- `record<T>(input)` - Auto-generates event_id
- `enrich<T>(eventId, data)` - Append enrichment data
- `getById(eventId)` - Latest enriched version
- `getHistory(eventId)` - Full history
- `void(eventId)` - Soft void
- `getByType(type)` - Query by event type
- `findForEntity(fieldName, value)` - Events for entity
- `getByTimeRange(start, end)` - Time-range queries

---

## Improving This File

Claude: Help me improve this CLAUDE.md over time. When you notice opportunities, suggest additions:

- **After fixing a bug**: "Should I add a rule about [pattern that caused the bug]?"
- **After I clarify a preference**: "Want me to add that to CLAUDE.md so I remember?"
- **After repeated questions**: "I've asked about [X] a few times. Should this be documented?"
- **When conventions emerge**: "I notice you prefer [pattern]. Add to rules?"

Good CLAUDE.md entries are:
- **Directive**: "Do X" or "Avoid Y" (not just descriptions)
- **Specific**: "Use `bun test`" (not "run tests appropriately")
- **Born from friction**: Rules that prevent real mistakes you've encountered
