# Phase 5 Implementation Plan: Advanced Features

**Created:** 2026-02-01
**Based on:** PLAN.md Phase 5 and REVIEW.md recommendations
**Target Completion:** 5-6 weeks (can be broken into multiple implementation sessions)
**Prerequisites:** Phases 1-4 completed and production-ready

---

## Overview

Phase 5 adds advanced functionality to the Quailcomp book collection system. This phase is **optional** and can be prioritized based on user needs. The application is fully production-ready after Phase 4.

**Phase 5 Components:**
1. **Additional Domains** (People, Series, Locations) - 3-4 weeks
2. **Book Metadata Enhancements** (rate limiting, caching, circuit breaker) - 1 week
3. **Advanced Search** (full-text search, filters, saved searches) - 1-2 weeks
4. **Bulk Operations** (import/export, batch updates) - 1 week
5. **Real-time Features** (WebSocket support) - 2-3 weeks [OPTIONAL]

Each component can be implemented independently in separate sessions.

---

## Implementation Session 1: People Domain (1-2 weeks)

### Goal
Implement the People domain to track authors, contributors, and gift-givers referenced in book acquisitions.

### Domain Design

**Purpose:** Track people related to books (authors, gift-givers, borrowers)

**References from Books domain:**
- `GivenAcquisition.person_id` - Who gave the book
- `LentEvent.person_id` - Who borrowed the book (future)

### Step 1.1: Domain Documentation

**Create:** `domains/people.md`

```markdown
# People

> Tracks individuals related to books in the collection.

People can be authors, contributors, gift-givers, or borrowers. This domain
provides a central registry to track relationships with books.

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
```

**Action:**
1. Create `domains/people.md` with complete domain definition
2. Include all TypeScript types in fenced code blocks
3. Document invariants and use cases
4. Run `bun run extract-types` to generate `domains/types/people.ts`

### Step 1.2: Database Schema

**Create:** `data/postgres/migrations/004_people_domain.sql`

```sql
-- Migration: Add People domain
-- Description: Stores people entities (authors, gift-givers, borrowers)
-- Author: Claude Code
-- Date: 2026-02-XX

-- No new tables needed - uses existing entities table
-- Just need to register the entity type and add indexes

-- Add GIN index for people name searches (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_people_name_gin
ON entities USING gin ((data->>'name') gin_trgm_ops)
WHERE type = 'person' AND deleted_at IS NULL;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_people_email
ON entities ((data->>'email'))
WHERE type = 'person' AND deleted_at IS NULL AND (data->>'email') IS NOT NULL;

-- Add index for relationship filtering
CREATE INDEX IF NOT EXISTS idx_people_relationships
ON entities USING gin ((data->'relationships') jsonb_path_ops)
WHERE type = 'person' AND deleted_at IS NULL;

COMMENT ON INDEX idx_people_name_gin IS
'Trigram index for fuzzy name searches on people entities';

COMMENT ON INDEX idx_people_email IS
'Email lookup index for people entities';

COMMENT ON INDEX idx_people_relationships IS
'JSONB index for filtering people by relationship types';
```

**Create:** `data/postgres/migrations/004_people_domain_down.sql`

```sql
-- Rollback: Remove People domain indexes
DROP INDEX IF EXISTS idx_people_name_gin;
DROP INDEX IF EXISTS idx_people_email;
DROP INDEX IF EXISTS idx_people_relationships;
```

**Action:**
1. Create migration files
2. Run `bun run db:migrate` to apply
3. Verify indexes exist: `\d+ entities` in psql
4. Test rollback: run down migration, verify indexes removed

### Step 1.3: API Routes

**Create:** `server/src/routes/people.ts`

**Endpoints to implement:**
- `GET /people` - List accessible people (with authorization)
- `GET /people/:id` - Get single person
- `POST /people` - Create new person (auto-grant owner access)
- `PUT /people/:id` - Update person (require write access)
- `DELETE /people/:id` - Soft delete person (require owner access)
- `GET /people/:id/books` - List books associated with this person

**Pattern to follow:** Copy from `server/src/routes/books.ts` and adapt

**Key code structure:**
```typescript
import type { Sql } from "@quailcomp/data";
import { createEntitiesClient } from "@quailcomp/data";
import type { PersonEntitySnapshot } from "@domains/types/people";
import type { Router } from "@/router";
import { requireAuth } from "@/auth/middleware";
import { requireRead, requireWrite, requireOwner } from "@/authz/middleware";
import { AuthorizationService } from "@/authz/service";

const PERSON_TYPE = "person";

const getEntityIdFromParams = (ctx: { params: { id: string } }) =>
  parseInt(ctx.params.id, 10);

export function registerPeopleRoutes(router: Router, sql: Sql): void {
  const entities = createEntitiesClient(sql);
  const authzService = new AuthorizationService(sql);

  // GET /people - List people the user has access to
  router.get("/people", async (ctx) => {
    // Filter by accessible entities (see books.ts pattern)
    // Return list of PersonListItem
  }, [requireAuth]);

  // ... implement other endpoints
}
```

**Register routes:** Add to `server/src/index.ts`:
```typescript
import { registerPeopleRoutes } from '@/routes/people';
registerPeopleRoutes(router, sql);
```

**Action:**
1. Create `server/src/routes/people.ts`
2. Implement all 6 endpoints following books.ts pattern
3. Register routes in `server/src/index.ts`
4. Test with curl or API client

### Step 1.4: Tests

**Create:** `server/tests/people.test.ts`

**Test coverage plan:**
```typescript
describe('People Routes', () => {
  describe('GET /people', () => {
    test('returns empty array when no people exist')
    test('returns only accessible people for user')
    test('filters out deleted people')
    test('requires authentication')
  })

  describe('GET /people/:id', () => {
    test('returns person by ID')
    test('returns 404 for non-existent person')
    test('returns 403 for inaccessible person')
    test('requires read access')
  })

  describe('POST /people', () => {
    test('creates person with valid data')
    test('auto-grants owner access to creator')
    test('validates required fields')
    test('requires authentication')
  })

  describe('PUT /people/:id', () => {
    test('updates person with partial data')
    test('preserves unmodified fields')
    test('returns 404 for non-existent person')
    test('requires write access')
  })

  describe('DELETE /people/:id', () => {
    test('soft deletes person')
    test('preserves data in history')
    test('requires owner access')
  })

  describe('GET /people/:id/books', () => {
    test('returns books given by person')
    test('returns books borrowed by person')
    test('returns empty array when no books')
    test('requires read access to person')
  })
})
```

**Action:**
1. Create comprehensive test suite (aim for 90%+ coverage)
2. Use unique type names: `person_${Date.now()}`
3. Test authorization middleware integration
4. Run `bun test` - all tests must pass
5. Run `bun run coverage` - verify 90%+ threshold

### Step 1.5: Frontend Integration (Optional)

**If implementing frontend:**

1. **API Client:** Add to `frontend/src/api/people.ts`
2. **Pinia Store:** Create `frontend/src/stores/people.ts`
3. **Components:**
   - `PersonCard.vue` - Display person summary
   - `PersonForm.vue` - Create/edit person
   - `PersonList.vue` - List all people
4. **Views:**
   - `PeopleView.vue` - Main people list page
   - `PersonDetailView.vue` - Person details with related books
5. **Routes:** Add to `frontend/src/router/index.ts`

### Step 1.6: Documentation Updates

**Update these files:**

1. **`server/README.md`** - Document new `/people` endpoints
2. **`server/src/routes/README.md`** - Add people.ts to file list
3. **`domains/README.md`** - Add People domain to list
4. **`docs/reference/api.md`** - Document all People endpoints with examples
5. **`CHANGELOG.md`** - Add entry for People domain
6. **OpenAPI spec** - Auto-generated, verify it includes new endpoints

### Verification Steps

**Test the complete implementation:**

```bash
# 1. Run all tests
bun test

# 2. Run coverage check
bun run coverage

# 3. Check type generation
bun run extract-types
git diff domains/types/people.ts  # Should show new file

# 4. Test API manually
curl -X POST http://localhost:3000/people \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","relationships":["gift_giver"]}'

# 5. Test authorization
curl -X GET http://localhost:3000/people/1  # Should require auth

# 6. Check database
psql quailcomp_dev -c "SELECT * FROM entities WHERE type='person';"

# 7. Lint and typecheck
bun run lint
bun run typecheck
```

### Commit Message

```
Add People domain with full CRUD API

Implements the People domain for tracking authors, gift-givers, and borrowers.

Features:
- Domain documentation with type extraction
- Database migration with trigram indexes for name search
- Full CRUD REST API with authorization
- Comprehensive test suite (90%+ coverage)
- OpenAPI documentation

Closes: Phase 5.1 (People domain)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Implementation Session 2: Series Domain (1 week)

### Goal
Implement the Series domain to track book series and their ordering.

### Domain Design

**Purpose:** Track book series (trilogies, multi-volume works, etc.)

**References:**
- `PhysicalBook.series_id` - Which series this book belongs to
- Series can have many books

### Step 2.1: Domain Documentation

**Create:** `domains/series.md`

```typescript
export type Series = {
  entity_id: string
  name: string
  total_volumes?: number
  notes?: string
}

export type BookInSeries = {
  book_id: string
  series_id: string
  volume_number?: number
  volume_name?: string
}

export type SeriesEntitySnapshot = {
  name: string
  total_volumes?: number
  notes?: string
}

export type SeriesWithBooks = {
  series: Series
  books: Array<{
    book: PhysicalBook
    volume_number?: number
  }>
}
```

### Step 2.2: Database Schema

**Create:** `data/postgres/migrations/005_series_domain.sql`

**Considerations:**
- Series entities stored in `entities` table with `type='series'`
- Book-to-series relationship via `PhysicalBook.series_id`
- May need separate `series_books` join table if volume ordering is complex

**Option A: Simple (series_id in books table)**
```sql
-- No new tables, just indexes
CREATE INDEX idx_books_series_id ON entities ((data->>'series_id'))
WHERE type = 'book' AND deleted_at IS NULL;
```

**Option B: Explicit join table for volume ordering**
```sql
CREATE TABLE series_books (
  series_id INTEGER REFERENCES entities(entity_id),
  book_id INTEGER REFERENCES entities(entity_id),
  volume_number INTEGER,
  volume_name TEXT,
  PRIMARY KEY (series_id, book_id)
);

CREATE INDEX idx_series_books_series ON series_books(series_id);
CREATE INDEX idx_series_books_book ON series_books(book_id);
```

**Recommendation:** Start with Option A (simpler), migrate to Option B if volume ordering becomes important.

### Step 2.3: API Routes

**Create:** `server/src/routes/series.ts`

**Endpoints:**
- `GET /series` - List all series
- `GET /series/:id` - Get series details
- `GET /series/:id/books` - List books in series (ordered by volume)
- `POST /series` - Create series
- `PUT /series/:id` - Update series
- `DELETE /series/:id` - Soft delete series

### Step 2.4: Tests & Documentation

**Follow same pattern as People domain:**
1. Create `server/tests/series.test.ts` with 90%+ coverage
2. Update all relevant READMEs
3. Update `docs/reference/api.md`
4. Verify OpenAPI spec generation

### Verification & Commit

Same verification steps as People domain, adapted for series endpoints.

---

## Implementation Session 3: Locations Domain (1 week)

### Goal
Implement the Locations domain to track physical stores where books were purchased.

### Domain Design

**Purpose:** Track physical locations (bookstores, libraries, events)

**References:**
- `PurchasedAcquisition.location_id` - Where book was purchased

### Step 3.1: Domain Documentation

**Create:** `domains/locations.md`

```typescript
export type Location = {
  entity_id: string
  name: string
  address?: string
  city?: string
  state?: string
  country?: string
  website?: string
  notes?: string
}

export type LocationEntitySnapshot = {
  name: string
  address?: string
  city?: string
  state?: string
  country?: string
  website?: string
  notes?: string
}

export type LocationWithStats = {
  location: Location
  books_purchased: number
  total_spent?: Money
  last_visit?: Date
}
```

### Step 3.2: Database Schema

**Create:** `data/postgres/migrations/006_locations_domain.sql`

```sql
-- Add GIN index for location name searches
CREATE INDEX IF NOT EXISTS idx_locations_name_gin
ON entities USING gin ((data->>'name') gin_trgm_ops)
WHERE type = 'location' AND deleted_at IS NULL;

-- Add index for city/state filtering
CREATE INDEX IF NOT EXISTS idx_locations_city_state
ON entities ((data->>'city'), (data->>'state'))
WHERE type = 'location' AND deleted_at IS NULL;
```

### Step 3.3: API Routes

**Create:** `server/src/routes/locations.ts`

**Endpoints:**
- `GET /locations` - List locations
- `GET /locations/:id` - Get location details
- `GET /locations/:id/books` - Books purchased at this location
- `GET /locations/:id/stats` - Purchase statistics
- `POST /locations` - Create location
- `PUT /locations/:id` - Update location
- `DELETE /locations/:id` - Soft delete location

### Step 3.4: Tests & Documentation

Follow same pattern as People and Series domains.

---

## Implementation Session 4: Book Metadata Enhancements (1 week)

### Goal
Add production-ready resilience to the book metadata service (rate limiting, caching, circuit breaker).

### Current State

**What exists:**
- 5 metadata providers (Google Books, Open Library, LOC, Hardcover, WorldCat)
- Provider abstraction with `BookMetadataProvider` interface
- Parallel provider calls with timeout
- Basic error handling

**What's missing:**
- Rate limiting (can exceed API limits)
- Response caching (repeated lookups are slow)
- Circuit breaker (failing providers slow down all requests)
- Timeout configuration per provider

### Step 4.1: Rate Limiting

**Create:** `services/book-metadata/src/utils/rate-limiter.ts`

**Implementation:**

```typescript
/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for smooth rate limiting.
 * Tokens refill continuously at a specified rate.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,      // Bucket capacity
    private refillRate: number       // Tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens -= 1;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }

  /**
   * Check if a token is available without acquiring
   */
  canAcquire(): boolean {
    this.refill();
    return this.tokens >= 1;
  }
}
```

**Configure per provider:**

```typescript
// services/book-metadata/src/providers/google-books.ts
export class GoogleBooksProvider implements BookMetadataProvider {
  private rateLimiter: RateLimiter;

  constructor(config: GoogleBooksConfig) {
    this.rateLimiter = new RateLimiter(
      config.rateLimit?.maxRequests ?? 100,  // 100 requests
      config.rateLimit?.perSeconds ?? 1      // per second
    );
  }

  async lookup(identifier: string): Promise<BookMetadata | null> {
    await this.rateLimiter.acquire();
    // ... rest of implementation
  }
}
```

**Test:** Create `services/book-metadata/tests/rate-limiter.test.ts`

### Step 4.2: Response Caching

**Create:** `services/book-metadata/src/utils/cache.ts`

**Implementation:**

```typescript
/**
 * Simple in-memory cache with TTL
 */
export class MetadataCache {
  private cache = new Map<string, CacheEntry>();

  constructor(private ttlSeconds: number = 3600) {}

  get(key: string): BookMetadata | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: BookMetadata): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (this.ttlSeconds * 1000),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

interface CacheEntry {
  value: BookMetadata;
  expiresAt: number;
}
```

**Integrate with providers:**

```typescript
// Wrapper that adds caching to any provider
export class CachedProvider implements BookMetadataProvider {
  private cache = new MetadataCache(3600); // 1 hour TTL

  constructor(
    private baseProvider: BookMetadataProvider,
    private ttl?: number
  ) {
    if (ttl) this.cache = new MetadataCache(ttl);
  }

  async lookup(identifier: string): Promise<BookMetadata | null> {
    // Check cache first
    const cached = this.cache.get(identifier);
    if (cached) return cached;

    // Fetch from provider
    const result = await this.baseProvider.lookup(identifier);

    // Cache successful results
    if (result) {
      this.cache.set(identifier, result);
    }

    return result;
  }

  get provider(): string {
    return this.baseProvider.provider;
  }
}
```

**For production:** Consider Redis instead of in-memory cache for multi-instance deployments.

### Step 4.3: Circuit Breaker

**Create:** `services/book-metadata/src/utils/circuit-breaker.ts`

**Implementation:**

```typescript
/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by failing fast when a provider is down.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider is failing, requests fail immediately
 * - HALF_OPEN: Testing if provider has recovered
 */
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private failureThreshold: number = 5,     // Failures before opening
    private recoveryTimeout: number = 60000,  // Time before trying again (ms)
    private successThreshold: number = 2      // Successes before closing
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If circuit is open, check if recovery timeout has elapsed
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      // Try half-open state
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
  }
}
```

**Integrate with providers:**

```typescript
export class ResilientProvider implements BookMetadataProvider {
  private circuitBreaker: CircuitBreaker;

  constructor(
    private baseProvider: BookMetadataProvider,
    private options?: {
      failureThreshold?: number;
      recoveryTimeout?: number;
    }
  ) {
    this.circuitBreaker = new CircuitBreaker(
      options?.failureThreshold,
      options?.recoveryTimeout
    );
  }

  async lookup(identifier: string): Promise<BookMetadata | null> {
    return this.circuitBreaker.execute(() =>
      this.baseProvider.lookup(identifier)
    );
  }

  get provider(): string {
    return this.baseProvider.provider;
  }
}
```

### Step 4.4: Provider Configuration

**Update provider configuration structure:**

```typescript
// services/book-metadata/src/types.ts
export interface ProviderConfig {
  timeout?: number;
  rateLimit?: {
    maxRequests: number;
    perSeconds: number;
  };
  circuitBreaker?: {
    failureThreshold: number;
    recoveryTimeout: number;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
  };
}
```

**Example usage in routes:**

```typescript
// server/src/routes/books.ts (metadata lookup endpoint)

// Create resilient, cached, rate-limited providers
const googleBooks = new CachedProvider(
  new ResilientProvider(
    createGoogleBooksProvider({
      apiKey: process.env.GOOGLE_BOOKS_API_KEY,
      timeout: 5000,
      rateLimit: { maxRequests: 100, perSeconds: 1 },
      circuitBreaker: { failureThreshold: 5, recoveryTimeout: 60000 }
    })
  ),
  3600 // 1 hour cache
);
```

### Step 4.5: Tests

**Create comprehensive tests:**

1. `services/book-metadata/tests/rate-limiter.test.ts`
   - Test token refilling
   - Test waiting when tokens exhausted
   - Test concurrent requests

2. `services/book-metadata/tests/cache.test.ts`
   - Test cache hit/miss
   - Test TTL expiration
   - Test cache clearing

3. `services/book-metadata/tests/circuit-breaker.test.ts`
   - Test state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
   - Test failure threshold
   - Test recovery timeout

4. Update `server/tests/routes.test.ts` to verify caching behavior

### Step 4.6: Documentation

**Update:**
1. `services/book-metadata/README.md` - Document all new utilities
2. `docs/reference/api.md` - Document metadata endpoint behavior
3. Add section on resilience patterns
4. Document configuration options

### Verification

```bash
# Run tests
bun test services/book-metadata
bun test server/tests/routes.test.ts

# Test rate limiting manually
for i in {1..110}; do
  curl http://localhost:3000/books/metadata/lookup \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"identifier":"9780547928227","identifierType":"isbn"}' &
done
# Should see some requests delayed due to rate limiting

# Test caching
time curl http://localhost:3000/books/metadata/lookup ...  # Slow first time
time curl http://localhost:3000/books/metadata/lookup ...  # Fast second time

# Test circuit breaker (simulate provider failure)
# Temporarily break API key, make 10 requests, circuit should open
```

---

## Implementation Session 5: Advanced Search (1-2 weeks)

### Goal
Implement full-text search, advanced filters, and saved searches.

### Step 5.1: PostgreSQL Full-Text Search

**Create:** `data/postgres/migrations/007_fulltext_search.sql`

```sql
-- Add tsvector column for full-text search
ALTER TABLE entities
ADD COLUMN search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'book' THEN
    NEW.search_vector :=
      setweight(to_tsvector('english', coalesce(NEW.data->>'title', '')), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW.data->>'subtitle', '')), 'B') ||
      setweight(to_tsvector('english', coalesce(NEW.data->>'author', '')), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW.data->>'note', '')), 'D');
  ELSIF NEW.type = 'person' THEN
    NEW.search_vector :=
      setweight(to_tsvector('english', coalesce(NEW.data->>'name', '')), 'A');
  ELSIF NEW.type = 'location' THEN
    NEW.search_vector :=
      setweight(to_tsvector('english', coalesce(NEW.data->>'name', '')), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW.data->>'city', '')), 'B');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER entities_search_vector_update
BEFORE INSERT OR UPDATE ON entities
FOR EACH ROW
EXECUTE FUNCTION update_search_vector();

-- Create GIN index for full-text search
CREATE INDEX idx_entities_search_vector
ON entities USING gin(search_vector)
WHERE deleted_at IS NULL;

-- Backfill existing rows
UPDATE entities SET search_vector = search_vector WHERE TRUE;
```

### Step 5.2: Search API Endpoint

**Add to `server/src/routes/books.ts`:**

```typescript
// GET /books/search - Full-text search
router.get("/books/search", async (ctx, req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') ?? '50');
  const offset = parseInt(url.searchParams.get('offset') ?? '0');

  if (!query) {
    return Response.json(
      { error: 'Missing query parameter: q', code: 'MISSING_QUERY' },
      { status: 400 }
    );
  }

  // Perform full-text search
  const results = await sql`
    SELECT
      entity_id,
      type,
      data,
      ts_rank(search_vector, websearch_to_tsquery('english', ${query})) AS rank
    FROM entities
    WHERE
      type = 'book'
      AND deleted_at IS NULL
      AND search_vector @@ websearch_to_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Filter by authorization
  const accessibleIds = new Set(
    (await authzService.listAccessibleEntities(ctx.user!.userId))
      .map(e => e.entityId)
  );

  const books = results
    .filter(row => accessibleIds.has(row.entity_id))
    .map(row => ({
      entityId: row.entity_id,
      data: row.data,
      rank: row.rank
    }));

  ctx.log.info('Search completed', { query, results: books.length });
  return Response.json({ books });
}, [requireAuth]);
```

### Step 5.3: Advanced Filters

**Add filter support:**

```typescript
// GET /books/search with filters
interface SearchFilters {
  query?: string;
  author?: string;
  series_id?: string;
  acquired_after?: string;  // ISO date
  acquired_before?: string; // ISO date
  has_isbn?: boolean;
  sort?: 'relevance' | 'title' | 'acquired_date';
  limit?: number;
  offset?: number;
}

router.get("/books/search", async (ctx, req) => {
  const filters = parseSearchFilters(req.url);

  // Build dynamic query with filters
  const whereClauses = [];
  const params = [];

  if (filters.query) {
    whereClauses.push(`search_vector @@ websearch_to_tsquery('english', ?)`);
    params.push(filters.query);
  }

  if (filters.author) {
    whereClauses.push(`data->>'author' ILIKE ?`);
    params.push(`%${filters.author}%`);
  }

  // ... build other filter clauses

  const results = await sql`...`; // Execute query

  return Response.json({ books: results });
}, [requireAuth]);
```

### Step 5.4: Saved Searches

**Create:** `domains/saved-searches.md`

```typescript
export type SavedSearch = {
  entity_id: string
  user_id: string
  name: string
  filters: SearchFilters
  created_at: Date
}
```

**Add routes:**
- `GET /saved-searches` - List user's saved searches
- `POST /saved-searches` - Create saved search
- `GET /saved-searches/:id/execute` - Execute saved search
- `DELETE /saved-searches/:id` - Delete saved search

### Step 5.5: Search History

**Record search events:**

```typescript
// After executing search
await analytics.recordSearchQuery({
  user_id: ctx.user.userId,
  query: filters.query,
  filters: filters,
  results_count: results.length,
  execution_time_ms: Date.now() - startTime
});
```

### Verification

```bash
# Test full-text search
curl 'http://localhost:3000/books/search?q=tolkien' \
  -H "Authorization: Bearer $TOKEN"

# Test with filters
curl 'http://localhost:3000/books/search?author=tolkien&has_isbn=true' \
  -H "Authorization: Bearer $TOKEN"

# Check search performance
EXPLAIN ANALYZE SELECT ...;  # Should use GIN index
```

---

## Implementation Session 6: Bulk Operations (1 week)

### Goal
Add import/export functionality for CSV, JSON, and XLSX formats.

### Step 6.1: Bulk Import API

**Add to `server/src/routes/books.ts`:**

```typescript
// POST /books/import - Bulk import books
router.post("/books/import", async (ctx, req) => {
  const formData = await req.formData();
  const file = formData.get('file');
  const format = formData.get('format') as 'csv' | 'json' | 'xlsx';

  if (!file || !(file instanceof File)) {
    return Response.json(
      { error: 'Missing file', code: 'MISSING_FILE' },
      { status: 400 }
    );
  }

  const content = await file.text();
  let books: BookEntitySnapshot[];

  try {
    if (format === 'csv') {
      books = parseCSV(content);
    } else if (format === 'json') {
      books = JSON.parse(content);
    } else if (format === 'xlsx') {
      books = parseXLSX(content);
    } else {
      return Response.json(
        { error: 'Invalid format', code: 'INVALID_FORMAT' },
        { status: 400 }
      );
    }
  } catch (err) {
    return Response.json(
      { error: 'Failed to parse file', code: 'PARSE_ERROR' },
      { status: 400 }
    );
  }

  // Import books in transaction
  const imported = [];
  for (const book of books) {
    const entry = await entities.create({
      type: 'book',
      data: book
    });
    await authzService.grantOwnerOnCreate(entry.entityId, ctx.user!.userId);
    imported.push(entry);
  }

  ctx.log.info('Bulk import completed', { count: imported.length });
  return Response.json({ imported, count: imported.length }, { status: 201 });
}, [requireAuth]);
```

### Step 6.2: CSV/JSON/XLSX Parsers

**Create:** `server/src/utils/import-parsers.ts`

```typescript
export function parseCSV(content: string): BookEntitySnapshot[] {
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    const book: Partial<BookEntitySnapshot> = {};

    headers.forEach((header, i) => {
      if (values[i]) {
        book[header.trim()] = values[i].trim();
      }
    });

    return book as BookEntitySnapshot;
  });
}

export function parseXLSX(content: string): BookEntitySnapshot[] {
  // Use a library like 'xlsx' or 'exceljs'
  // For now, return empty array
  return [];
}
```

**Add dependency:** `bun add xlsx` for XLSX support

### Step 6.3: Bulk Export API

```typescript
// GET /books/export - Export all books
router.get("/books/export", async (ctx, req) => {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') as 'csv' | 'json' | 'xlsx' ?? 'json';

  const books = await entities.getByType<BookEntitySnapshot>('book');

  // Filter by authorization
  const accessibleIds = new Set(
    (await authzService.listAccessibleEntities(ctx.user!.userId))
      .map(e => e.entityId)
  );
  const accessibleBooks = books.filter(b => accessibleIds.has(b.entityId));

  let content: string;
  let contentType: string;

  if (format === 'csv') {
    content = exportCSV(accessibleBooks);
    contentType = 'text/csv';
  } else if (format === 'json') {
    content = JSON.stringify(accessibleBooks, null, 2);
    contentType = 'application/json';
  } else {
    content = exportXLSX(accessibleBooks);
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="books.${format}"`,
    },
  });
}, [requireAuth]);
```

### Step 6.4: Batch Update API

```typescript
// PUT /books/batch - Update multiple books
router.put("/books/batch", async (ctx, req) => {
  interface BatchUpdate {
    entity_id: number;
    data: Partial<BookEntitySnapshot>;
  }

  const { updates } = await req.json() as { updates: BatchUpdate[] };

  if (!Array.isArray(updates)) {
    return Response.json(
      { error: 'Invalid request body', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const results = [];
  for (const update of updates) {
    // Check write access
    const hasAccess = await authzService.checkAccess(
      update.entity_id,
      ctx.user!.userId,
      'write'
    );

    if (!hasAccess) {
      results.push({ entity_id: update.entity_id, error: 'Forbidden' });
      continue;
    }

    const existing = await entities.getById<BookEntitySnapshot>(update.entity_id);
    if (!existing) {
      results.push({ entity_id: update.entity_id, error: 'Not found' });
      continue;
    }

    const updatedData = { ...existing.data, ...update.data };
    const entry = await entities.update({
      entityId: update.entity_id,
      type: 'book',
      data: updatedData,
    });

    results.push({ entity_id: update.entity_id, success: true, data: entry });
  }

  return Response.json({ results });
}, [requireAuth]);
```

### Step 6.5: Tests

**Create:** `server/tests/bulk-operations.test.ts`

Test coverage:
- Import CSV with valid data
- Import JSON with valid data
- Import XLSX with valid data
- Handle parse errors gracefully
- Export to CSV/JSON/XLSX
- Batch update with mixed permissions
- Handle partial failures in batch operations

### Verification

```bash
# Test CSV import
curl -X POST http://localhost:3000/books/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@books.csv" \
  -F "format=csv"

# Test JSON export
curl http://localhost:3000/books/export?format=json \
  -H "Authorization: Bearer $TOKEN" \
  > books-export.json

# Test batch update
curl -X PUT http://localhost:3000/books/batch \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"updates":[{"entity_id":1,"data":{"note":"Updated"}}]}'
```

---

## Implementation Session 7: Real-time Features [OPTIONAL] (2-3 weeks)

### Goal
Add WebSocket support for real-time updates and collaboration.

**Note:** This is the most complex component of Phase 5 and is entirely optional. Consider deferring until there's a clear use case.

### Use Cases

1. **Live Updates:** Multiple users see book additions/updates in real-time
2. **Collaborative Editing:** Multiple users editing the same book
3. **Notifications:** Real-time notifications for shared collections
4. **Presence:** See who else is viewing/editing

### Step 7.1: WebSocket Server

**Add dependency:** `bun add ws @types/ws`

**Create:** `server/src/websocket/server.ts`

```typescript
import type { Server } from 'bun';
import { WebSocketHandler } from 'bun';

export interface WebSocketData {
  userId: number;
  subscriptions: Set<string>; // entity IDs
}

export const websocketHandler: WebSocketHandler<WebSocketData> = {
  open(ws) {
    console.log('WebSocket opened');
  },

  message(ws, message) {
    const data = JSON.parse(message as string);

    switch (data.type) {
      case 'subscribe':
        ws.data.subscriptions.add(data.entityId);
        break;
      case 'unsubscribe':
        ws.data.subscriptions.delete(data.entityId);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  },

  close(ws) {
    console.log('WebSocket closed');
  },
};

// Broadcast update to all subscribers
export function broadcastUpdate(entityId: number, data: any) {
  // Get all connected WebSocket clients
  // Filter to those subscribed to this entityId
  // Send update message
}
```

**Integrate with Bun server:**

```typescript
// server/src/index.ts
const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    // Upgrade WebSocket connections
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
    }

    // Handle HTTP requests
    return handleRequest(req);
  },
  websocket: websocketHandler,
});
```

### Step 7.2: Event Broadcasting

**Update entity operations to broadcast:**

```typescript
// In server/src/routes/books.ts
import { broadcastUpdate } from '@/websocket/server';

// After creating a book
const entry = await entities.create(...);
await authzService.grantOwnerOnCreate(entry.entityId, ctx.user.userId);

// Broadcast to subscribers
broadcastUpdate(entry.entityId, {
  type: 'book.created',
  book: entry,
});

// After updating a book
const entry = await entities.update(...);
broadcastUpdate(entry.entityId, {
  type: 'book.updated',
  book: entry,
});
```

### Step 7.3: Frontend WebSocket Client

**Create:** `frontend/src/api/websocket.ts`

```typescript
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<(data: any) => void>>();

  connect(url: string, token: string) {
    this.ws = new WebSocket(`${url}?token=${token}`);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed, reconnecting...');
      setTimeout(() => this.connect(url, token), 5000);
    };
  }

  subscribe(entityId: string, callback: (data: any) => void) {
    if (!this.subscriptions.has(entityId)) {
      this.subscriptions.set(entityId, new Set());
      this.send({ type: 'subscribe', entityId });
    }
    this.subscriptions.get(entityId)!.add(callback);
  }

  unsubscribe(entityId: string, callback: (data: any) => void) {
    const subs = this.subscriptions.get(entityId);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        this.subscriptions.delete(entityId);
        this.send({ type: 'unsubscribe', entityId });
      }
    }
  }

  private handleMessage(data: any) {
    if (data.type === 'book.updated') {
      const callbacks = this.subscriptions.get(data.book.entityId);
      callbacks?.forEach(cb => cb(data));
    }
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const wsClient = new WebSocketClient();
```

### Step 7.4: Collaborative Editing (Advanced)

For collaborative editing, consider:

1. **Operational Transform (OT)** - Complex, precise
2. **CRDT (Conflict-free Replicated Data Types)** - Simpler, eventual consistency
3. **Last-Write-Wins** - Simple, can lose edits

**Recommendation:** Start with Last-Write-Wins, upgrade to CRDT if needed.

### Step 7.5: Tests

**Create:** `server/tests/websocket.test.ts`

Test coverage:
- WebSocket connection authentication
- Subscribe/unsubscribe to entities
- Broadcast updates to correct subscribers
- Authorization (only send updates for accessible entities)
- Reconnection handling
- Concurrent updates

### Verification

```bash
# Test WebSocket connection
websocat ws://localhost:3000/ws

# Send subscribe message
{"type":"subscribe","entityId":"1"}

# In another terminal, update book 1
curl -X PUT http://localhost:3000/books/1 ...

# Should see update in WebSocket terminal
```

---

## Cross-Session Documentation Updates

**After completing all Phase 5 sessions, update:**

### 1. Main Documentation

- **`README.md`** - Add Phase 5 features to feature list
- **`CHANGELOG.md`** - Document all Phase 5 additions
- **`docs/reference/api.md`** - Complete API reference for all new endpoints
- **`docs/README.md`** - Update navigation if new docs added

### 2. Domain Documentation

- **`domains/README.md`** - List all new domains
- **`domains/books.md`** - Update to reference new domains (People, Series, Locations)
- Ensure all domain types are extracted correctly

### 3. OpenAPI Specification

- Verify `/openapi.json` includes all new endpoints
- Test Swagger UI at `/api-docs`
- Ensure request/response schemas are complete

### 4. Architecture Documentation

- Update `docs/explanation/services-architecture.md` with new services
- Document WebSocket architecture (if implemented)
- Add diagrams for complex interactions

### 5. How-To Guides

Consider adding:
- **`docs/how-to/import-export-data.md`** - Guide for bulk operations
- **`docs/how-to/use-advanced-search.md`** - Search features guide
- **`docs/how-to/manage-collections.md`** - Multi-user collection management

---

## Testing Strategy for Phase 5

### Unit Tests (Per Session)

Each session should achieve 90%+ test coverage:

```bash
# Run tests for specific workspace
bun test server/tests/people.test.ts
bun test server/tests/series.test.ts
bun test server/tests/locations.test.ts
bun test services/book-metadata

# Check coverage
bun run coverage
```

### Integration Tests

**Create:** `server/tests/integration/phase5.test.ts`

Test cross-domain interactions:
- Create person, book with that person as gift-giver
- Create series, multiple books in that series
- Create location, books purchased at that location
- Search across all entity types
- Export books with related entities

### E2E Tests

**Create:** `server/tests/e2e/phase5-workflows.test.ts`

Test complete user workflows:
1. User imports CSV of books
2. User searches for a book
3. User creates a person
4. User associates person with book
5. User exports collection

### Performance Tests

**Test search performance:**

```typescript
describe('Search Performance', () => {
  test('full-text search completes in <100ms for 10k books', async () => {
    // Insert 10k test books
    // Run search query
    // Assert execution time < 100ms
  });

  test('filtered search uses correct indexes', async () => {
    // Run EXPLAIN ANALYZE on search query
    // Assert it uses GIN index, not seq scan
  });
});
```

### Load Tests

**Test bulk operations:**

```bash
# Import 1000 books via CSV
time curl -X POST http://localhost:3000/books/import \
  -F "file=@1000-books.csv" \
  -F "format=csv"

# Should complete in <10 seconds
```

---

## Deployment Considerations for Phase 5

### Database Migrations

Phase 5 adds 4 new migrations:
- `004_people_domain.sql`
- `005_series_domain.sql`
- `006_locations_domain.sql`
- `007_fulltext_search.sql`

**Migration checklist:**
- [ ] All migrations are idempotent
- [ ] All migrations have corresponding `_down.sql` rollbacks
- [ ] Full-text search migration backfills existing data
- [ ] Indexes are created concurrently in production
- [ ] Migration execution time is acceptable (<1 minute)

### Production Configuration

**Environment variables to add:**

```bash
# Redis (for production caching)
REDIS_URL=redis://localhost:6379

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=60  # seconds
RATE_LIMIT_MAX_REQUESTS=100

# Search
SEARCH_ENABLED=true
SEARCH_MAX_RESULTS=1000

# WebSocket (if implemented)
WEBSOCKET_ENABLED=true
WEBSOCKET_PING_INTERVAL=30000  # ms
```

### Monitoring & Observability

**Add metrics for Phase 5:**

```typescript
// Prometheus metrics
const searchDuration = new Histogram({
  name: 'search_duration_seconds',
  help: 'Duration of search queries',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const importSize = new Histogram({
  name: 'import_size_books',
  help: 'Number of books in bulk import',
  buckets: [1, 10, 50, 100, 500, 1000, 5000]
});

const websocketConnections = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});
```

### Caching Strategy

**For production, use Redis:**

```typescript
// services/book-metadata/src/utils/redis-cache.ts
import { Redis } from 'ioredis';

export class RedisCache {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url);
  }

  async get(key: string): Promise<BookMetadata | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: BookMetadata, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

---

## Critical Files Reference

**Files created/modified in Phase 5:**

### New Domain Files
- `domains/people.md`
- `domains/series.md`
- `domains/locations.md`
- `domains/saved-searches.md` (optional)
- `domains/types/people.ts` (auto-generated)
- `domains/types/series.ts` (auto-generated)
- `domains/types/locations.ts` (auto-generated)

### New Migration Files
- `data/postgres/migrations/004_people_domain.sql`
- `data/postgres/migrations/004_people_domain_down.sql`
- `data/postgres/migrations/005_series_domain.sql`
- `data/postgres/migrations/005_series_domain_down.sql`
- `data/postgres/migrations/006_locations_domain.sql`
- `data/postgres/migrations/006_locations_domain_down.sql`
- `data/postgres/migrations/007_fulltext_search.sql`
- `data/postgres/migrations/007_fulltext_search_down.sql`

### New Route Files
- `server/src/routes/people.ts`
- `server/src/routes/series.ts`
- `server/src/routes/locations.ts`

### New Service Files
- `services/book-metadata/src/utils/rate-limiter.ts`
- `services/book-metadata/src/utils/cache.ts`
- `services/book-metadata/src/utils/circuit-breaker.ts`
- `services/book-metadata/src/utils/redis-cache.ts` (optional)

### New Server Utilities
- `server/src/utils/import-parsers.ts`
- `server/src/utils/export-formatters.ts`
- `server/src/websocket/server.ts` (optional)

### Modified Files
- `server/src/index.ts` - Register new routes
- `server/src/routes/books.ts` - Add search, import, export endpoints
- `domains/books.md` - Add references to new domains

### New Test Files
- `server/tests/people.test.ts`
- `server/tests/series.test.ts`
- `server/tests/locations.test.ts`
- `server/tests/bulk-operations.test.ts`
- `server/tests/search.test.ts`
- `server/tests/websocket.test.ts` (optional)
- `server/tests/integration/phase5.test.ts`
- `services/book-metadata/tests/rate-limiter.test.ts`
- `services/book-metadata/tests/cache.test.ts`
- `services/book-metadata/tests/circuit-breaker.test.ts`

---

## Phase 5 Completion Checklist

Use this checklist to verify Phase 5 is complete:

### Session 1: People Domain
- [ ] Domain documentation created (`domains/people.md`)
- [ ] Types extracted (`domains/types/people.ts`)
- [ ] Migration created and applied (`004_people_domain.sql`)
- [ ] Routes implemented (`server/src/routes/people.ts`)
- [ ] Routes registered in `server/src/index.ts`
- [ ] Tests written and passing (`server/tests/people.test.ts`)
- [ ] Coverage ≥90% for people routes
- [ ] READMEs updated
- [ ] API documentation updated
- [ ] Commit created

### Session 2: Series Domain
- [ ] Domain documentation created
- [ ] Types extracted
- [ ] Migration created and applied
- [ ] Routes implemented
- [ ] Tests written and passing
- [ ] Coverage ≥90%
- [ ] READMEs updated
- [ ] Commit created

### Session 3: Locations Domain
- [ ] Domain documentation created
- [ ] Types extracted
- [ ] Migration created and applied
- [ ] Routes implemented
- [ ] Tests written and passing
- [ ] Coverage ≥90%
- [ ] READMEs updated
- [ ] Commit created

### Session 4: Metadata Enhancements
- [ ] Rate limiter implemented and tested
- [ ] Cache implemented and tested
- [ ] Circuit breaker implemented and tested
- [ ] Providers updated to use resilience patterns
- [ ] Configuration documented
- [ ] Tests written for all utilities
- [ ] Integration tests verify behavior
- [ ] Commit created

### Session 5: Advanced Search
- [ ] Full-text search migration created
- [ ] Search endpoint implemented
- [ ] Filter support added
- [ ] Saved searches implemented (optional)
- [ ] Search history analytics recorded
- [ ] Tests written and passing
- [ ] Performance verified (uses indexes)
- [ ] Commit created

### Session 6: Bulk Operations
- [ ] Import endpoint implemented (CSV, JSON, XLSX)
- [ ] Export endpoint implemented
- [ ] Batch update endpoint implemented
- [ ] Parser utilities created
- [ ] Tests written and passing
- [ ] Sample files created for testing
- [ ] Documentation includes examples
- [ ] Commit created

### Session 7: Real-time Features (Optional)
- [ ] WebSocket server implemented
- [ ] Event broadcasting implemented
- [ ] Frontend WebSocket client created
- [ ] Subscription management working
- [ ] Authorization enforced on subscriptions
- [ ] Tests written and passing
- [ ] Documentation includes usage examples
- [ ] Commit created

### Cross-Session Tasks
- [ ] All READMEs updated
- [ ] `docs/reference/api.md` complete
- [ ] OpenAPI spec includes all endpoints
- [ ] Swagger UI tested
- [ ] CHANGELOG.md updated
- [ ] Main README.md updated with Phase 5 features
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] Performance tests run
- [ ] Production deployment guide updated

### Final Verification
- [ ] All tests pass: `bun test`
- [ ] Coverage ≥90%: `bun run coverage`
- [ ] Linting passes: `bun run lint`
- [ ] Type checking passes: `bun run typecheck`
- [ ] All migrations tested (up and down)
- [ ] Git hooks working
- [ ] Documentation builds without errors
- [ ] Sample workflows tested end-to-end

---

## Success Criteria

Phase 5 is considered complete when:

1. **All domains implemented:** People, Series, Locations with full CRUD APIs
2. **Metadata service resilient:** Rate limiting, caching, circuit breaker working
3. **Search functional:** Full-text search with filters, good performance
4. **Bulk operations working:** Import/export CSV, JSON, XLSX
5. **WebSocket optional:** Only if user explicitly requests it
6. **Test coverage ≥90%:** All new code thoroughly tested
7. **Documentation complete:** All new features documented
8. **Production ready:** Can be deployed with confidence

---

## Estimated Timeline

**Conservative estimates for implementation:**

| Session | Component | Estimated Effort |
|---------|-----------|------------------|
| 1 | People Domain | 1-2 weeks |
| 2 | Series Domain | 1 week |
| 3 | Locations Domain | 1 week |
| 4 | Metadata Enhancements | 1 week |
| 5 | Advanced Search | 1-2 weeks |
| 6 | Bulk Operations | 1 week |
| 7 | Real-time Features (opt) | 2-3 weeks |
| - | Cross-session tasks | 2-3 days |

**Total: 5-6 weeks** (or 7-10 weeks with real-time features)

**Can be broken into 7 separate Claude Code sessions**, each 1-2 weeks.

---

## Notes for Implementation

### Best Practices to Follow

1. **Always run tests after changes:** `bun test`
2. **Check coverage:** `bun run coverage` (maintain 90%+ threshold)
3. **Update READMEs:** Every directory change requires README update
4. **Extract types:** Run `bun run extract-types` after domain changes
5. **Commit frequently:** One logical change per commit
6. **Follow patterns:** Copy existing code structure (books.ts, auth.test.ts)
7. **Test authorization:** Verify middleware integration for all new routes
8. **Document as you go:** Don't defer documentation to the end

### Pitfalls to Avoid

1. **Don't skip rollback migrations:** Every migration needs a `_down.sql`
2. **Don't forget authorization:** All routes must check access
3. **Don't hardcode test data:** Use timestamps for unique type names
4. **Don't copy-paste without adapting:** Adjust entity types, field names
5. **Don't skip verification:** Test each step before moving to next
6. **Don't batch commits:** Commit after each completed step
7. **Don't ignore coverage:** If coverage drops below 90%, add tests immediately

### Questions to Clarify with User

Before starting implementation, consider asking:

1. **Domain priorities:** Which domains are most important? (People, Series, or Locations first)
2. **Search requirements:** What search features are most valuable?
3. **Bulk operations:** What import formats are needed? (CSV only, or also XLSX?)
4. **Real-time features:** Is WebSocket support required, or can we defer?
5. **Caching strategy:** In-memory cache OK, or should we use Redis?
6. **Frontend:** Should we implement frontend components, or just API?

---

## Appendix: Code Templates

### Template: Domain Documentation

```markdown
# [Domain Name]

> Brief description of domain purpose.

## [Entity Name]

> What this entity represents.

```typescript
export type EntityName = {
  entity_id: string
  // ... fields
}

export type EntitySnapshot = {
  // ... fields for JSONB storage
}

export type EntityRow = {
  entity_id: number
  entity_type: 'entity_type'
  data: EntitySnapshot
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}
```

## Invariants

- List of rules that must be maintained

## Use Cases

- Primary ways this domain is used
```

### Template: Route File

```typescript
/**
 * [Entity] routes
 *
 * GET /entities - List all entities
 * GET /entities/:id - Get single entity
 * POST /entities - Create new entity
 * PUT /entities/:id - Update entity
 * DELETE /entities/:id - Soft delete entity
 */

import type { Sql } from "@quailcomp/data";
import { createEntitiesClient } from "@quailcomp/data";
import type { EntitySnapshot } from "@domains/types/entity";
import type { Router } from "@/router";
import { requireAuth } from "@/auth/middleware";
import { requireRead, requireWrite, requireOwner } from "@/authz/middleware";
import { AuthorizationService } from "@/authz/service";

const ENTITY_TYPE = "entity_type";

const getEntityIdFromParams = (ctx: { params: { id: string } }) =>
  parseInt(ctx.params.id, 10);

export function registerEntityRoutes(router: Router, sql: Sql): void {
  const entities = createEntitiesClient(sql);
  const authzService = new AuthorizationService(sql);

  // GET /entities
  router.get("/entities", async (ctx) => {
    // Implementation
  }, [requireAuth]);

  // GET /entities/:id
  router.get("/entities/:id", async (ctx) => {
    // Implementation
  }, [requireAuth, requireRead(getEntityIdFromParams)]);

  // POST /entities
  router.post("/entities", async (ctx, req) => {
    // Implementation
  }, [requireAuth]);

  // PUT /entities/:id
  router.put("/entities/:id", async (ctx, req) => {
    // Implementation
  }, [requireAuth, requireWrite(getEntityIdFromParams)]);

  // DELETE /entities/:id
  router.delete("/entities/:id", async (ctx) => {
    // Implementation
  }, [requireAuth, requireOwner(getEntityIdFromParams)]);
}
```

### Template: Test File

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createEntitiesClient, connectToDatabase } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

describe('[Entity] Routes', () => {
  let sql: Sql;
  let baseUrl: string;
  let authToken: string;

  beforeAll(async () => {
    sql = connectToDatabase();
    // Setup test data
    // Get auth token
  });

  afterAll(async () => {
    // Cleanup
    await sql.end();
  });

  describe('GET /entities', () => {
    test('returns empty array when no entities exist', async () => {
      const response = await fetch(`${baseUrl}/entities`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      expect(data.entities).toEqual([]);
    });

    // More tests...
  });

  // More describe blocks...
});
```

---

## End of Plan

This plan provides a complete roadmap for implementing Phase 5 over multiple Claude Code sessions. Each session can be tackled independently, with clear goals, verification steps, and commit points.

**Remember:** Phase 5 is optional. The application is production-ready after Phase 4. Implement Phase 5 components based on actual user needs and priorities.
