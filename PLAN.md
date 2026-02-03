<!-- markdownlint-disable -->

# Quailcomp Codebase Review

**Review Date:** 2026-01-30
**Reviewer:** Claude Sonnet 4.5
**Overall Assessment:** Excellent (8.5/10)

## 1. Router Simplicity vs. Scalability

**Location:** [server/src/router.ts](server/src/router.ts)

**Current State:** Custom path-based router (104 lines)
- Supports `:param` patterns
- Linear search through routes array
- No route grouping or middleware composition at router level

**Concerns:**
- No support for wildcard patterns (`/api/*`)
- No regex-based matching
- Linear O(n) lookup may not scale to hundreds of routes
- Middleware must be specified per route (no grouping)

**Recommendation:**

Current implementation is **fine for <100 routes**. However:

1. **Document scaling limitations** in router.ts comments
2. **Consider migration path** to Hono, Elysia, or similar if routes grow >50
3. **Add route grouping helper** to reduce middleware repetition:

```typescript
// utils/route-groups.ts
export function group(prefix: string, middleware: Middleware[], routes: Route[]) {
  return routes.map(route => ({
    ...route,
    path: `${prefix}${route.path}`,
    middleware: [...middleware, ...(route.middleware || [])]
  }));
}

// Usage in server.ts
const authRoutes = group('/auth', [errorHandler, requestLogger], [
  { method: 'POST', path: '/register', handler: register },
  { method: 'POST', path: '/login', handler: login },
]);

const apiRoutes = group('/api', [errorHandler, requestLogger, requireAuth], [
  ...bookRoutes,
  ...collectionRoutes,
]);
```

**Priority:** Low (no immediate scaling issues)

## 2. Frontend Architecture

**Location:** [frontend/src/](frontend/src/)

**Recommendations:**

1. **Add composable for loading/error states:**

```typescript
// frontend/src/composables/useAsync.ts
export function useAsync<T>(fn: () => Promise<T>) {
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const data = ref<T | null>(null);

  async function execute() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fn();
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, data, execute };
}
```

**Priority:** Medium (impacts user experience)

**Note:** Frontend appears to be early-stage/experimental. Consider documenting this clearly in the README.

## 3. Test Coverage Workflow Complexity

**Location:** [package.json](package.json), [scripts/merge-coverage.ts](scripts/merge-coverage.ts)

**Current Approach:**
```json
{
  "test:coverage:generate": "... && bun run test:coverage:workspaces && bun run test:coverage:root && bun run test:coverage:merge",
  "test:coverage:merge": "bun run scripts/merge-coverage.ts",
  "test:coverage:report": "bun run scripts/coverage-report.ts"
}
```

**Issue:** Coverage merging requires custom scripts (merge-coverage.ts is complex)

**Questions:**
- Why is custom merging necessary?
- Can Bun's native coverage handle monorepo workspaces?
- Would c8 or nyc simplify this?

**Recommendation:**
1. Document why custom merge is necessary in comments
2. Investigate if recent Bun versions have improved workspace coverage
3. Consider using c8 if native support is insufficient:

```bash
bun add -d c8
# Then use: c8 bun test
```

**Priority:** Low (working, but could be simpler)

## 4. Database Schema Diagram

**Missing:** Visual representation of database schema

**Recommendation:**

Add ERD diagram to [docs/reference/](docs/reference/):

```bash
# Using dbdiagram.io or similar
# Or generate from database:
bun add -d @databases/pg-schema-print-types
```

**Should include:**
- `entities` table
- `events` table
- `entity_access` table (and relationships)
- Triggers and constraints
- Index strategy

**Priority:** Low (nice to have)

## 5. Inconsistent TypeScript Configs

**Location:** [tsconfig.json](tsconfig.json) (root)

**Current:**
```json
{
  "include": ["*.ts"]  // Only includes root-level .ts files!
}
```

**Issue:** Type checking at root level may miss workspace files

**Recommendation:**

```json
{
  "include": [
    "*.ts",
    "data/client/src/**/*",
    "server/src/**/*",
    "cli/src/**/*",
    "frontend/src/**/*",
    "scripts/**/*"
  ],
  "exclude": [
    "node_modules",
    "**/dist",
    "**/coverage"
  ]
}
```

Or use project references:

```json
{
  "files": [],
  "references": [
    { "path": "./data/client" },
    { "path": "./server" },
    { "path": "./cli" },
    { "path": "./frontend" }
  ]
}
```

**Priority:** Low (workspaces have their own configs)

## 6. Environment Variables Management 🟡 MEDIUM PRIORITY

**Current:** Environment variables documented but **no validation**

**Location:** [docs/reference/environment-variables.md](docs/reference/environment-variables.md)

**Issue:** Application may start with invalid/missing configuration

**Recommendation:**

Add runtime validation using Zod:

```typescript
// server/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

// Usage:
// import { env } from './config';
// const server = Bun.serve({ port: env.PORT });
```

**Also create `.env.example`:**

```bash
# .env.example
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://quailcomp_app:password@localhost:5432/quailcomp
JWT_SECRET=your-secret-key-min-32-characters-long-change-in-production
GOOGLE_BOOKS_API_KEY=optional-api-key-for-metadata-lookup
```

**Benefits:**
- Fail fast on startup if config invalid
- Type-safe access to environment variables
- Clear documentation of required vs. optional vars
- Prevents production incidents from misconfiguration

**Priority:** Medium

**Effort:** Small (1 hour)

## 7. Potential Race Conditions

**Location:** [data/migrations/001_initial_schema.sql:35-36](data/migrations/001_initial_schema.sql)

**Finding:** Migration comments mention race conditions:

```sql
-- Known or potential issues:
-- - There could be a race condition in the trigger if adding/checking simultaneously
```

**Trigger in question:**

```sql
CREATE OR REPLACE FUNCTION validate_entity_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if entity_id exists
  IF NOT EXISTS (SELECT 1 FROM entities WHERE entity_id = NEW.entity_id) THEN
    RAISE EXCEPTION 'entity_id % does not exist in entities table', NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Scenario:**
1. Transaction A checks if entity_id exists → YES
2. Transaction B deletes entity
3. Transaction A inserts event → Orphaned event?

**Recommendation:**

Add integration test to verify behavior:

```typescript
// data/client/tests/concurrency.test.ts
test('concurrent entity delete and event insert', async () => {
  const entity = await entitiesClient.create({ type: 'test', data: {} });

  // Attempt concurrent operations
  const deletePromise = entitiesClient.delete(entity.entityId);
  const eventPromise = eventsClient.create({
    entityId: entity.entityId,
    type: 'test',
    eventType: 'updated',
    data: {},
  });

  const results = await Promise.allSettled([deletePromise, eventPromise]);

  // One should succeed, one should fail
  // Or both should succeed but in the correct order
  expect(results.some(r => r.status === 'rejected')).toBe(true);
});
```

If race confirmed, consider PostgreSQL advisory locks:

```sql
CREATE OR REPLACE FUNCTION validate_entity_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Acquire advisory lock on entity_id
  PERFORM pg_advisory_xact_lock(NEW.entity_id);

  IF NOT EXISTS (SELECT 1 FROM entities WHERE entity_id = NEW.entity_id) THEN
    RAISE EXCEPTION 'entity_id % does not exist in entities table', NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Priority:** Medium (document or fix)

**Effort:** Small (2 hours for testing + potential fix)

## 8. No Foreign Key Constraints

**Observation:** Events reference entities via JSONB data, not FK constraints

**Example:**
```sql
-- events.data might contain: { "book_id": 42 }
-- No FK constraint to entities.entity_id
```

**Trade-off Analysis:**

**Pros of current approach:**
- ✅ Flexibility - can evolve schemas independently
- ✅ No coupling - domains loosely coupled
- ✅ Easier to evolve - no cascade delete issues
- ✅ JSONB allows arbitrary references

**Cons of current approach:**
- ❌ Referential integrity not enforced by database
- ❌ Possible orphaned references
- ❌ No automatic cascade behavior
- ❌ Application must validate references

**Recommendation:**

1. **Document this design decision** in [docs/explanation/event-sourcing.md](docs/explanation/event-sourcing.md):

```markdown
## Reference Integrity

Events may reference other entities in their JSONB `data` field (e.g., `{"book_id": 42}`).
These references are NOT enforced by foreign key constraints.

**Rationale:**
- Maintains loose coupling between domains
- Allows schema evolution without cascading changes
- JSONB fields can reference multiple entity types

**Implications:**
- Application code must validate references
- Orphaned references are possible
- Referential integrity is application-level concern
```

2. **Add helper functions to validate references:**

```typescript
// data/client/src/utils/references.ts
export async function validateEntityReferences(
  data: Record<string, any>,
  client: EntitiesClient
): Promise<void> {
  const idFields = Object.keys(data).filter(k => k.endsWith('_id'));

  for (const field of idFields) {
    const entityId = data[field];
    const exists = await client.getLatest(entityId);
    if (!exists) {
      throw new Error(`Referenced entity ${field}=${entityId} does not exist`);
    }
  }
}
```

3. **Consider periodic integrity check job:**

```typescript
// scripts/check-referential-integrity.ts
import { entitiesClient, eventsClient } from '@quailcomp/data-client';

async function checkIntegrity() {
  const events = await eventsClient.getAll();

  for (const event of events) {
    // Check if event.entity_id still exists
    const entity = await entitiesClient.getLatest(event.entityId);
    if (!entity) {
      console.warn(`Orphaned event ${event.eventId} references deleted entity ${event.entityId}`);
    }

    // Check if data references are valid
    const idFields = Object.keys(event.data).filter(k => k.endsWith('_id'));
    for (const field of idFields) {
      const referencedEntity = await entitiesClient.getLatest(event.data[field]);
      if (!referencedEntity) {
        console.warn(`Event ${event.eventId} has invalid reference ${field}=${event.data[field]}`);
      }
    }
  }
}
```

**Priority:** Low (document decision, add integrity check)

**Effort:** Small (2-3 hours)

## 9. Analytics Retention Policy

**Location:** [data/migrations/003_add_analytics.sql](data/migrations/003_add_analytics.sql)

**Finding:** Migration adds analytics tables but no cleanup mechanism

**Recommendation:**

Add retention policy enforcement:

```sql
-- data/migrations/003_add_analytics.sql (add this)

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
  DELETE FROM events
  WHERE type = 'analytics_event'
    AND entered_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-analytics', '0 2 * * *', 'SELECT cleanup_old_analytics()');
```

Or create a standalone script:

```typescript
// scripts/cleanup-analytics.ts
import { getConnection } from '@quailcomp/data-client';

const db = getConnection();

const result = await db.query(`
  DELETE FROM events
  WHERE type = 'analytics_event'
    AND entered_at < NOW() - INTERVAL '90 days'
  RETURNING event_id
`);

console.log(`Cleaned up ${result.rowCount} old analytics events`);
```

**Add to cron:**
```bash
# crontab -e
0 2 * * * cd /app && bun run scripts/cleanup-analytics.ts
```

**Priority:** Medium (prevents unbounded growth)

**Effort:** Small (1 hour)

## 10. API Key Management

**Finding:** Google Books config expects API key but no validation

**Recommendation:**

Validate API keys at service initialization:

```typescript
// server/src/book-metadata/providers/google-books.ts
export class GoogleBooksProvider extends BaseMetadataProvider {
  constructor(config: GoogleBooksConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Google Books API key is required. Get one at https://console.cloud.google.com/');
    }

    // Optionally validate key format
    if (!/^[A-Za-z0-9_-]{39}$/.test(config.apiKey)) {
      console.warn('Google Books API key format looks invalid');
    }
  }
}
```

**Also document free tier limits:**

```typescript
// server/src/book-metadata/README.md
## Provider Configuration

### Google Books

- **API Key Required:** Yes
- **Free Tier:** 1,000 requests/day
- **Rate Limit:** 10 requests/second
- **Get API Key:** https://console.cloud.google.com/apis/credentials
```

**Priority:** Low

**Effort:** Trivial (30 minutes)

## 11. N+1 Query Potential

**Finding:** No evidence of relationship loading optimization

**Scenario:**

```typescript
// Fetching books and their metadata (N+1 problem)
const books = await entitiesClient.getByType('book'); // 1 query

for (const book of books) {
  const metadata = await fetchMetadata(book.data.isbn); // N queries
}
```

**Recommendation:**

Add batch loading:

```typescript
// server/src/utils/batch-loader.ts
export class BatchLoader<K, V> {
  private queue: Array<{ key: K; resolve: (value: V) => void }> = [];
  private scheduled = false;

  constructor(
    private batchFn: (keys: K[]) => Promise<V[]>,
    private maxBatchSize = 100
  ) {}

  async load(key: K): Promise<V> {
    return new Promise((resolve) => {
      this.queue.push({ key, resolve });

      if (!this.scheduled) {
        this.scheduled = true;
        process.nextTick(() => this.dispatch());
      }
    });
  }

  private async dispatch(): Promise<void> {
    const batch = this.queue.splice(0, this.maxBatchSize);
    this.scheduled = false;

    const keys = batch.map(item => item.key);
    const results = await this.batchFn(keys);

    batch.forEach((item, index) => {
      item.resolve(results[index]);
    });
  }
}

// Usage:
const metadataLoader = new BatchLoader(async (isbns: string[]) => {
  // Batch fetch metadata for multiple ISBNs
  return Promise.all(isbns.map(isbn => fetchMetadata(isbn)));
});

const books = await entitiesClient.getByType('book');
const metadata = await Promise.all(
  books.map(book => metadataLoader.load(book.data.isbn))
);
```

**Or implement DataLoader pattern:**

```bash
bun add dataloader
```

```typescript
import DataLoader from 'dataloader';

const metadataLoader = new DataLoader(async (isbns: string[]) => {
  return Promise.all(isbns.map(isbn => fetchMetadata(isbn)));
});

// Batches and caches requests
const metadata = await metadataLoader.load(isbn);
```

**Priority:** Low (add when N+1 becomes a problem)

**Effort:** Medium (3-4 hours)

## 12. Query Performance Monitoring

**Recommendation:**

Add slow query logging:

```typescript
// server/src/middleware/query-logger.ts
export function queryLogger(threshold: number = 1000) {
  return async (request: Request) => {
    const start = Date.now();

    // Wrap database queries
    const originalQuery = db.query;
    db.query = async (...args) => {
      const queryStart = Date.now();
      const result = await originalQuery.apply(db, args);
      const duration = Date.now() - queryStart;

      if (duration > threshold) {
        console.warn(`Slow query (${duration}ms):`, args[0]);
      }

      return result;
    };
  };
}
```

**Monitor index usage:**

```sql
-- scripts/analyze-index-usage.sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

**Add EXPLAIN ANALYZE tests:**

```typescript
// data/client/tests/performance.test.ts
test('getByType query uses index', async () => {
  const plan = await db.query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT DISTINCT ON (entity_id) *
    FROM entities
    WHERE type = 'book' AND deleted_at IS NULL
    ORDER BY entity_id, entered_at DESC
  `);

  const planText = plan.map(row => row['QUERY PLAN']).join('\n');

  // Verify index is used
  expect(planText).toContain('Index Scan');
  expect(planText).toContain('idx_entities_type_active');

  // Verify query is fast
  expect(planText).toMatch(/Execution Time: \d+\.\d+ ms/);
});
```

**Priority:** Medium

**Effort:** Medium (2-3 hours)

## 13. Mutation Testing

**Recommendation:** Add Stryker to verify test quality:

```bash
bun add -d @stryker-mutator/core @stryker-mutator/typescript-checker
```

```javascript
// stryker.conf.json
{
  "packageManager": "bun",
  "testRunner": "command",
  "commandRunner": {
    "command": "bun test"
  },
  "checkers": ["typescript"],
  "mutate": [
    "data/client/src/**/*.ts",
    "server/src/**/*.ts",
    "!**/*.test.ts"
  ],
  "thresholds": {
    "high": 80,
    "low": 70,
    "break": 60
  }
}
```

**What it does:**
- Introduces bugs into your code (mutations)
- Runs tests to see if they catch the bugs
- Reports mutation score (% of mutations killed)

**Priority:** Low (nice to have)

**Effort:** Small (2-3 hours setup)

## 14. Hardcode Bun Version

**Location:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

**Finding:** CI specifies `bun-version: 1.3.6`

**Issue:** Version can drift from local development

**Recommendation:**

Add version file:

```bash
# .tool-versions (for asdf)
bun 1.3.6
```

Or:

```bash
# .bun-version
1.3.6
```

Update CI:

```yaml
# .github/workflows/ci.yml
- uses: oven-sh/setup-bun@v1
  with:
    bun-version-file: .bun-version
```

**Priority:** Low

**Effort:** Trivial (5 minutes)

## 15. Dependency Updates Strategy

**Recommendation:**

Add Renovate or Dependabot:

```json
// renovate.json
{
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true
    }
  ],
  "schedule": ["before 6am on Monday"]
}
```

Or GitHub Dependabot:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

**Priority:** Medium

**Effort:** Trivial (10 minutes)

## 16. Security Auditing

**Recommendation:**

Add to [package.json](package.json):

```json
{
  "scripts": {
    "audit": "bun audit",
    "audit:fix": "bun audit --fix"
  }
}
```

Add to CI:

```yaml
# .github/workflows/ci.yml
- name: Security Audit
  run: bun audit
```

**Priority:** Medium

**Effort:** Trivial (5 minutes)

## 17. Add Docker Support 🟡 MEDIUM PRIORITY

**Create [Dockerfile](Dockerfile):**

```dockerfile
FROM oven/bun:1.3.6 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY data/client/package.json ./data/client/
COPY server/package.json ./server/
RUN bun install --frozen-lockfile --production

# Build application
FROM base AS build
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

# Production image
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/data/client/dist ./data/client/dist

# Run migrations on startup
COPY data/migrations ./data/migrations
COPY scripts/run-migrations.sh ./scripts/

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "server/dist/index.js"]
```

**Multi-stage build benefits:**
- Smaller final image (no build tools)
- Cached dependency layer
- Production-optimized

**Priority:** Medium

**Effort:** Medium (2-3 hours including testing)

## 18. Add docker-compose for Development

**Create [docker-compose.yml](docker-compose.yml):**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: quailcomp_owner
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: quailcomp
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./data/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U quailcomp_owner"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://quailcomp_app:password@postgres:5432/quailcomp
      JWT_SECRET: dev-secret-do-not-use-in-production-min-32-chars
      NODE_ENV: development
    ports:
      - "3000:3000"
    volumes:
      - ./server/src:/app/server/src
      - ./data/client/src:/app/data/client/src
    command: bun run dev

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    depends_on:
      - app
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/frontend/src
    command: bun run dev

volumes:
  postgres_data:
```

**Usage:**
```bash
docker-compose up -d  # Start all services
docker-compose logs -f app  # View logs
docker-compose down  # Stop all services
```

**Priority:** Medium

**Effort:** Small (1-2 hours)

## 19. Response Helper Functions

**Current:** Repeated `Response.json()` calls throughout

**Recommendation:**

```typescript
// server/src/utils/response.ts
export const ok = <T>(data: T) =>
  Response.json(data, { status: 200 });

export const created = <T>(data: T) =>
  Response.json(data, { status: 201 });

export const noContent = () =>
  new Response(null, { status: 204 });

export const badRequest = (message: string, details?: any) =>
  Response.json({ error: message, details }, { status: 400 });

export const unauthorized = (message = 'Unauthorized') =>
  Response.json({ error: message }, { status: 401 });

export const forbidden = (message = 'Forbidden') =>
  Response.json({ error: message }, { status: 403 });

export const notFound = (message = 'Not found') =>
  Response.json({ error: message }, { status: 404 });

export const serverError = (message = 'Internal server error') =>
  Response.json({ error: message }, { status: 500 });

// Usage:
import { ok, created, badRequest } from '@/utils/response';

export async function createBook(request: Request): Promise<Response> {
  const body = await request.json();

  if (!body.title) {
    return badRequest('Title is required');
  }

  const book = await entitiesClient.create({ type: 'book', data: body });
  return created(book);
}
```

**Priority:** Low (nice to have)

**Effort:** Small (1 hour)

## 20. Database Connection Singleton

**Location:** [data/client/src/connection.ts](data/client/src/connection.ts)

**Current:** `getConnection()` uses module-level singleton

**Recommendation:**

Document singleton pattern clearly:

```typescript
// data/client/src/connection.ts
import postgres from '@bun/postgres';

/**
 * Database Connection Singleton
 *
 * This module provides a single shared database connection pool.
 * The connection is lazily initialized on first use.
 *
 * **Configuration:**
 * - Max connections: 20 (default)
 * - Idle timeout: 30s
 * - Connection timeout: 10s
 *
 * **Lifecycle:**
 * - Connection is created on first getConnection() call
 * - Connection persists for the lifetime of the process
 * - Graceful shutdown closes the connection pool
 */

let connection: postgres.Sql | null = null;

export function getConnection(): postgres.Sql {
  if (!connection) {
    connection = postgres(process.env.DATABASE_URL!, {
      max: 20,
      idle_timeout: 30,
      connect_timeout: 10,
    });
  }

  return connection;
}

/**
 * Close the database connection pool.
 * Call this during graceful shutdown.
 */
export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.end();
    connection = null;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});
```

**Priority:** Low (document + add graceful shutdown)

**Effort:** Trivial (30 minutes)
