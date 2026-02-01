<!-- markdownlint-disable -->

# Quailcomp Codebase Review

**Review Date:** 2026-01-30
**Reviewer:** Claude Sonnet 4.5
**Overall Assessment:** Excellent (8.5/10)

## Executive Summary

Quailcomp is an exceptionally well-structured, well-documented TypeScript monorepo demonstrating production-quality patterns for event sourcing and domain-driven design. The project shows strong architectural decisions, comprehensive testing, and impressive attention to developer experience.

**Project Statistics:**
- Production TypeScript files: ~85
- Test files: 19 (6,158 lines)
- Vue components: 17
- Documentation: ~4,915 lines across 44 READMEs
- Test coverage target: 90%

**Key Strengths:**
- Outstanding documentation (best-in-class)
- Innovative domain modeling approach
- Clean event sourcing implementation
- Excellent developer experience
- Comprehensive testing philosophy

**Key Areas for Improvement:**
1. Significant code duplication in data clients (~500 lines)
2. Authorization implemented but not enforced
3. Limited production deployment support
4. Missing E2E and frontend tests
5. Rate limiting and security hardening needed

---

## Table of Contents

1. [Architecture & Design Patterns](#1-architecture--design-patterns)
2. [Code Quality & Consistency](#2-code-quality--consistency)
3. [Documentation](#3-documentation)
4. [Configuration & Build Setup](#4-configuration--build-setup)
5. [Database Design](#5-database-design)
6. [Services Architecture](#6-services-architecture)
7. [Security Considerations](#7-security-considerations)
8. [Performance Considerations](#8-performance-considerations)
9. [Technical Debt & TODOs](#9-technical-debt--todos)
10. [Testing & Quality Assurance](#10-testing--quality-assurance)
11. [Dependency Management](#11-dependency-management)
12. [Deployment & Operations](#12-deployment--operations)
13. [Code Simplification Opportunities](#13-code-simplification-opportunities)
14. [Alternative Architectural Approaches](#14-alternative-architectural-approaches)
15. [Missing Features & Enhancements](#15-missing-features--enhancements)
16. [Positive Highlights](#16-positive-highlights)
17. [Critical Recommendations Summary](#17-critical-recommendations-summary)
18. [Final Assessment](#18-final-assessment)

---

## 1. Architecture & Design Patterns

### Strengths ✅

#### Event Sourcing Implementation (Excellent)

The event sourcing implementation is clean and well-executed:

- **Clean separation:** Entities (mutable state) vs. Events (immutable facts)
- **Append-only architecture:** Complete audit trails with no data loss
- **Database triggers:** Elegant ID validation preventing orphaned records
- **PostgreSQL features:** Strategic use of JSONB, GIN indexes, partial indexes
- **Documentation:** Clear explanation in [docs/explanation/event-sourcing.md](docs/explanation/event-sourcing.md)

**Example from [data/migrations/001_initial_schema.sql](data/migrations/001_initial_schema.sql):**
```sql
CREATE OR REPLACE FUNCTION validate_entity_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM entities WHERE entity_id = NEW.entity_id) THEN
    RAISE EXCEPTION 'entity_id % does not exist in entities table', NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Domain-Driven Design (Innovative)

The markdown-driven domain documentation is particularly innovative:

- **Documentation as code:** TypeScript types auto-extracted from markdown
- **Prevents drift:** Types and docs live together
- **Clear bounded contexts:** Authentication, Authorization, Books, Analytics
- **Loose coupling:** Domains reference each other via IDs only
- **Philosophy:** Excellent documentation in [docs/how-to/write-domain-docs.md](docs/how-to/write-domain-docs.md)

**Example from [domains/authentication.md](domains/authentication.md):**
````markdown
```typescript
type Credential = {
  credential_id: CredentialId;
  user_id: UserId;
  credential_type: CredentialType;
  credential_value: string;
  created_at: Date;
  last_used_at: Date | null;
};
```
````

#### Bun Runtime Integration (Modern)

- Leverages native PostgreSQL support
- Uses tagged template literals for SQL (injection-safe)
- Modern ESM modules throughout
- Appropriate use of Bun-specific features

### Concerns & Recommendations ⚠️

#### 1. Massive Query Duplication in Data Clients 🔴 HIGH PRIORITY

**Location:** [data/client/src/entities.ts](data/client/src/entities.ts), [data/client/src/events.ts](data/client/src/events.ts)

**Problem:** Severe code duplication across query methods:
- `EntitiesClient`: 14 instances of the `DISTINCT ON (entity_id)` pattern
- `EventsClient`: 26 instances of the `DISTINCT ON (event_id)` pattern

Each query method (`getHistory`, `getByType`, `findByData`, etc.) manually handles combinations of:
- `includeDeleted`/`includeVoided` flag
- `limit` parameter
- `offset` parameter

This results in **4-8 nearly identical SQL queries per method** (if/else pyramid).

**Example from entities.ts:196-258:**
```typescript
async getHistory<T>(entityId: number, options: QueryOptions = {}): Promise<Entry<T>[]> {
  const { includeDeleted = true, limit, offset } = options;
  let rows;

  // 8 different query variations!
  if (includeDeleted) {
    if (limit && offset) {
      rows = await this.sql`SELECT ... LIMIT ${limit} OFFSET ${offset}`;
    } else if (limit) {
      rows = await this.sql`SELECT ... LIMIT ${limit}`;
    } else if (offset) {
      rows = await this.sql`SELECT ... OFFSET ${offset}`;
    } else {
      rows = await this.sql`SELECT ...`;
    }
  } else {
    if (limit && offset) {
      rows = await this.sql`SELECT ... WHERE deleted_at IS NULL LIMIT ${limit} OFFSET ${offset}`;
    } else if (limit) {
      rows = await this.sql`SELECT ... WHERE deleted_at IS NULL LIMIT ${limit}`;
    } else if (offset) {
      rows = await this.sql`SELECT ... WHERE deleted_at IS NULL OFFSET ${offset}`;
    } else {
      rows = await this.sql`SELECT ... WHERE deleted_at IS NULL`;
    }
  }

  return rows.map(row => this.mapRow<T>(row));
}
```

**Recommended Solution:**

Use Bun SQL's dynamic fragment composition:

```typescript
async getHistory<T>(entityId: number, options: QueryOptions = {}): Promise<Entry<T>[]> {
  const { includeDeleted = true, limit, offset } = options;

  const rows = await this.sql`
    SELECT * FROM entities
    WHERE entity_id = ${entityId}
    ${includeDeleted ? this.sql`` : this.sql`AND deleted_at IS NULL`}
    ORDER BY entered_at ASC
    ${limit ? this.sql`LIMIT ${limit}` : this.sql``}
    ${offset ? this.sql`OFFSET ${offset}` : this.sql``}
  `;

  return rows.map(row => this.mapRow<T>(row));
}
```

Or create a query builder helper:

```typescript
private buildWhereClause(conditions: Record<string, any>, options: QueryOptions): string {
  const clauses = [];

  if (!options.includeDeleted) {
    clauses.push('deleted_at IS NULL');
  }

  // Add other conditions...

  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}

private buildPaginationClause(options: QueryOptions): string {
  const parts = [];
  if (options.limit) parts.push(`LIMIT ${options.limit}`);
  if (options.offset) parts.push(`OFFSET ${options.offset}`);
  return parts.join(' ');
}
```

**Impact:** Would reduce ~500 lines of duplicated code to ~150 lines.

**Effort:** Medium (2-3 hours to refactor and test)

---

#### 2. Router Simplicity vs. Scalability

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

---

#### 3. Missing Authorization Integration 🔴 HIGH PRIORITY

**Location:** [server/src/routes/books.ts](server/src/routes/books.ts) and other route handlers

**Observation:** Authorization schema exists but isn't integrated:
- `entity_access` table created in migration 002
- `/server/src/authz/` directory exists
- **No evidence of authorization checks in route handlers**

**Example Finding:**

Books routes don't check `entity_access` before operations:

```typescript
// server/src/routes/books.ts
export async function updateBook(request: Request): Promise<Response> {
  const { bookId } = parseParams(request);
  const body = await request.json();

  // ❌ No authorization check here!
  // Should verify user has 'write' or 'owner' access to this book

  const updated = await entitiesClient.update({
    entityId: bookId,
    type: 'book',
    data: body,
  });

  return Response.json(updated);
}
```

**Recommended Solution:**

1. Create authorization middleware:

```typescript
// server/src/middleware/authz.ts
import { entitiesClient } from '@quailcomp/data-client';

export function requireAccess(level: 'read' | 'write' | 'owner') {
  return async (request: Request) => {
    const user = request.user; // from requireAuth middleware
    const { entityId } = parseParams(request);

    const access = await entitiesClient.sql`
      SELECT access_level FROM entity_access
      WHERE entity_id = ${entityId} AND user_id = ${user.userId}
    `;

    if (!access.length) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const accessLevel = access[0].access_level;
    const levels = { read: 1, write: 2, owner: 3 };

    if (levels[accessLevel] < levels[level]) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  };
}
```

2. Apply to protected routes:

```typescript
// server/src/routes/books.ts
export const bookRoutes = [
  {
    method: 'GET',
    path: '/books/:bookId',
    middleware: [requireAuth, requireAccess('read')],
    handler: getBook,
  },
  {
    method: 'PUT',
    path: '/books/:bookId',
    middleware: [requireAuth, requireAccess('write')],
    handler: updateBook,
  },
  {
    method: 'DELETE',
    path: '/books/:bookId',
    middleware: [requireAuth, requireAccess('owner')],
    handler: deleteBook,
  },
];
```

3. Add tests for authorization enforcement:

```typescript
// server/tests/authz.test.ts
test('user cannot update book without write access', async () => {
  const { token: ownerToken } = await register({ /* ... */ });
  const book = await createBook(ownerToken, { /* ... */ });

  const { token: otherToken } = await register({ /* ... */ });

  const response = await fetch(`http://localhost:3000/api/books/${book.entityId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${otherToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Hacked!' }),
  });

  expect(response.status).toBe(403);
});
```

**Priority:** HIGH - This is a security issue

**Effort:** Medium (4-6 hours to implement and test)

---

#### 4. Frontend Architecture

**Location:** [frontend/src/](frontend/src/)

**Strengths:**
- Clean Vue 3 + Pinia setup
- Proper component organization ([frontend/src/components/](frontend/src/components/))
- Storybook stories for components
- Path aliases configured (`@/components`, `@/stores`)

**Concerns:**
- Only 17 Vue components (limited implementation)
- No route guards for authentication
- API client exists but minimal error handling
- No loading states or error boundaries pattern
- No form validation framework

**Current State of API Client:**

```typescript
// frontend/src/api/client.ts
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // ❌ No error handling for network failures
  // ❌ No retry logic
  // ❌ No timeout handling
  // ❌ No loading state management

  return response.json();
}
```

**Recommendations:**

1. **Add comprehensive error handling:**

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(response.status, error.message, error);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'Request timeout');
    }
    throw new ApiError(0, 'Network error', error);
  }
}
```

2. **Add route guards:**

```typescript
// frontend/src/router/index.ts
import { useAuthStore } from '@/stores/auth';

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else {
    next();
  }
});
```

3. **Add composable for loading/error states:**

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

---

## 2. Code Quality & Consistency

### Strengths ✅

#### Type Safety (Excellent)

- **Strict TypeScript throughout** - no `any` types found
- **Branded types** for domain IDs (UserId, BookId, etc.)
- **Discriminated unions** for domain events
- **Type inference** well-leveraged in data clients

**Example from [domains/authentication.md](domains/authentication.md):**
```typescript
type UserId = Branded<number, 'UserId'>;
type CredentialId = Branded<number, 'CredentialId'>;
type SessionId = Branded<string, 'SessionId'>;
```

#### Linting & Code Style (Excellent)

**Configuration:** [.eslintrc.json](.eslintrc.json)

- Comprehensive ESLint config
- Enforces path aliases over relative imports
- Markdown linting configured (`.markdownlint.json`)
- 2-space indentation enforced
- Pre-commit hooks prevent bad commits ([.husky/pre-commit](.husky/pre-commit))

**Example rule:**
```json
"no-restricted-imports": ["error", {
  "patterns": [{
    "group": ["../*", "./*"],
    "message": "Use path aliases (@quailcomp/*) instead of relative imports"
  }]
}]
```

#### Testing Strategy (Very Good)

- **19 test files, 6,158 lines of tests**
- Comprehensive test plan documentation (see [data/client/tests/entities.test.ts](data/client/tests/entities.test.ts))
- 90% coverage threshold enforced
- Tests use unique type names with timestamps (prevents conflicts)
- Infrastructure tests in `misc.test.ts` (excellent practice)

**Example test plan from entities.test.ts:**
```typescript
/**
 * Test coverage plan for EntitiesClient
 *
 * Core Operations:
 * ✅ 1. Creating entities
 * ✅ 2. Updating entities (creates new entry)
 * ✅ 3. Deleting entities (soft delete)
 * ✅ 4. Retrieving latest state
 * ✅ 5. Retrieving history
 *
 * Query Variations:
 * ✅ 6. Filter by type
 * ✅ 7. Search within data (JSONB)
 * ✅ 8. Pagination (limit/offset)
 * ✅ 9. Include/exclude deleted
 * ...
 */
```

### Concerns & Recommendations ⚠️

#### 1. Test Coverage Workflow Complexity

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

---

#### 2. No Frontend Tests 🟡 MEDIUM PRIORITY

**Finding:** Frontend has Storybook stories but **no unit/component tests**

**Missing:**
- Component tests (Vue Test Utils + Vitest)
- Store tests (Pinia stores)
- Composable tests
- Router tests

**Recommendation:**

Add Vitest for frontend testing:

```bash
cd frontend
bun add -d vitest @vue/test-utils jsdom
```

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

Example tests to add:

```typescript
// frontend/tests/stores/auth.test.ts
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('login sets user and token', async () => {
    const store = useAuthStore();

    await store.login({ email: 'test@example.com', password: 'password' });

    expect(store.isAuthenticated).toBe(true);
    expect(store.user).toBeTruthy();
    expect(store.token).toBeTruthy();
  });

  test('logout clears user and token', () => {
    const store = useAuthStore();
    store.user = { userId: 1, email: 'test@example.com' };
    store.token = 'abc123';

    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.token).toBeNull();
  });
});
```

```typescript
// frontend/tests/components/BookCard.test.ts
import { mount } from '@vue/test-utils';
import BookCard from '@/components/BookCard.vue';

describe('BookCard', () => {
  test('renders book title and author', () => {
    const wrapper = mount(BookCard, {
      props: {
        book: {
          title: 'The Hobbit',
          author: 'J.R.R. Tolkien',
          isbn: '9780547928227',
        },
      },
    });

    expect(wrapper.text()).toContain('The Hobbit');
    expect(wrapper.text()).toContain('J.R.R. Tolkien');
  });
});
```

**Priority:** Medium

**Effort:** Medium (1-2 days to set up and write initial suite)

---

#### 3. Missing Integration/E2E Tests 🟡 MEDIUM PRIORITY

**Observation:** Tests are primarily unit tests at the client/service level

**Missing:**
- End-to-end API tests (full request lifecycle)
- Integration tests across multiple services
- Auth + Authz integration tests
- Database transaction tests

**Recommendation:**

Add E2E test suite:

```typescript
// server/tests/e2e/book-workflow.test.ts
describe('Complete book acquisition workflow', () => {
  test('user can register, login, create book, fetch books', async () => {
    // 1. Register
    const registerResponse = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
      }),
    });
    expect(registerResponse.status).toBe(201);
    const { token } = await registerResponse.json();

    // 2. Create book
    const createResponse = await fetch('http://localhost:3000/api/books', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'The Hobbit',
        isbn: '9780547928227',
      }),
    });
    expect(createResponse.status).toBe(201);
    const book = await createResponse.json();

    // 3. Fetch books
    const fetchResponse = await fetch('http://localhost:3000/api/books', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(fetchResponse.status).toBe(200);
    const books = await fetchResponse.json();
    expect(books).toContainEqual(expect.objectContaining({ title: 'The Hobbit' }));

    // 4. Lookup metadata
    const metadataResponse = await fetch(
      `http://localhost:3000/api/books/${book.entityId}/metadata`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    expect(metadataResponse.status).toBe(200);
    const metadata = await metadataResponse.json();
    expect(metadata.author).toContain('Tolkien');
  });
});
```

**Priority:** Medium

**Effort:** Medium (2-3 days for comprehensive suite)

---

## 3. Documentation

### Strengths ✅ (Outstanding)

#### Comprehensive & Well-Organized

**Diátaxis Framework Implementation:**
- [docs/tutorials/](docs/tutorials/) - Learning-oriented
- [docs/how-to/](docs/how-to/) - Problem-oriented
- [docs/explanation/](docs/explanation/) - Understanding-oriented
- [docs/reference/](docs/reference/) - Information-oriented

**44 README files across all directories:**
- Every directory explains its purpose
- README maintenance enforced by pre-commit hook
- Clear contributor guidelines in [CONTRIBUTING.md](CONTRIBUTING.md)

#### Innovative Domain Documentation

**Location:** [domains/](domains/)

- Markdown files with embedded TypeScript
- Auto-extraction prevents drift ([scripts/extract-types.ts](scripts/extract-types.ts))
- Excellent domain philosophy ([docs/how-to/write-domain-docs.md](docs/how-to/write-domain-docs.md))
- Clear examples and edge cases

**Example from [domains/books.md](domains/books.md):**
````markdown
## ISBN Ambiguity

Note that a physical book may have multiple ISBNs (ISBN-10 vs ISBN-13, different editions).
We normalize all ISBNs to ISBN-13 format for consistency.

```typescript
type ISBN = string; // Always ISBN-13 format (13 digits)
```
````

#### Excellent Developer Experience

- AI assistant instructions in [.claude/CLAUDE.md](.claude/CLAUDE.md)
- Quick reference tables in README
- Step-by-step setup guide ([docs/how-to/setup-development.md](docs/how-to/setup-development.md))
- Clear commit protocol ([docs/how-to/commit-changes.md](docs/how-to/commit-changes.md))
- Database role explanations ([docs/explanation/database-roles.md](docs/explanation/database-roles.md))

### Recommendations ⚠️

#### 1. API Documentation 🟡 MEDIUM PRIORITY

**Current:** API endpoints documented in main README

**Limitation:** No machine-readable spec, no interactive docs

**Recommendation:**

Generate OpenAPI/Swagger specification:

```typescript
// server/src/openapi.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  summary: 'Register a new user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 8 },
            },
            required: ['email', 'password'],
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              userId: { type: 'number' },
              email: { type: 'string' },
              token: { type: 'string' },
            },
          },
        },
      },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const docs = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Quailcomp API',
  },
});

// Serve at /api/docs
```

Then add Swagger UI:

```bash
bun add swagger-ui-express
```

**Benefits:**
- Interactive API documentation
- Client code generation
- API contract testing
- Better developer experience

**Priority:** Medium

**Effort:** Medium (1-2 days to document all endpoints)

---

#### 2. Database Schema Diagram

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

---

#### 3. Deployment Documentation 🟡 MEDIUM PRIORITY

**Missing:**
- Production deployment guide
- Environment setup for production
- Database backup/restore procedures (referenced but not detailed)
- Monitoring and observability setup
- Disaster recovery procedures

**Recommendation:**

Create [docs/how-to/deploy-production.md](docs/how-to/deploy-production.md):

```markdown
# Deploy to Production

## Prerequisites

- PostgreSQL 16+ server
- Node.js 18+ or Bun 1.3.6+
- SSL certificates
- Configured environment variables

## Environment Variables

Required production environment variables:

- `DATABASE_URL` - PostgreSQL connection string with SSL
- `JWT_SECRET` - Strong random secret (min 32 characters)
- `PORT` - Server port (default: 3000)
- `NODE_ENV=production`

## Deployment Steps

1. **Database Setup**
   ```bash
   # Create production database
   createdb quailcomp_prod

   # Run migrations
   DATABASE_URL=postgres://... bun run db:migrate
   ```

2. **Build Application**
   ```bash
   bun install --frozen-lockfile --production
   bun run build
   ```

3. **Start Server**
   ```bash
   NODE_ENV=production bun run server/dist/index.js
   ```

## Database Backups

```bash
# Daily backup (cron job)
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip < backup-20260130.sql.gz | psql $DATABASE_URL
```

## Monitoring

- Set up health check endpoint
- Monitor PostgreSQL connection pool
- Track API response times
- Alert on error rate > 1%
```

**Priority:** Medium (required for production use)

**Effort:** Small (2-3 hours)

---

## 4. Configuration & Build Setup

### Strengths ✅

#### Monorepo Structure (Good)

**Workspace configuration:** [package.json](package.json)

```json
{
  "workspaces": [
    "data/client",
    "server",
    "cli",
    "frontend"
  ]
}
```

- Clear separation of concerns
- Individual package.json files with correct dependencies
- Shared dev dependencies at root
- No circular dependencies

#### Build Configuration

- TypeScript configs per workspace ([data/client/tsconfig.json](data/client/tsconfig.json), etc.)
- Path aliases configured (`@quailcomp/*`)
- ESLint import resolution working
- Vite for frontend bundling

### Concerns & Recommendations ⚠️

#### 1. Inconsistent TypeScript Configs

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

---

#### 2. Environment Variables Management 🟡 MEDIUM PRIORITY

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

---

#### 3. Missing Production Build Scripts

**Finding:** No production build orchestration at root level

**Current:** Must build each workspace manually

**Recommendation:**

Add to root [package.json](package.json):

```json
{
  "scripts": {
    "build": "bun run build:data && bun run build:server && bun run build:frontend && bun run build:cli",
    "build:data": "cd data/client && bun run build",
    "build:server": "cd server && bun run build",
    "build:frontend": "cd frontend && bun run build",
    "build:cli": "cd cli && bun run build",
    "clean": "rm -rf data/client/dist server/dist frontend/dist cli/dist",
    "typecheck": "bun run typecheck:data && bun run typecheck:server && bun run typecheck:frontend && bun run typecheck:cli",
    "typecheck:data": "cd data/client && tsc --noEmit",
    "typecheck:server": "cd server && tsc --noEmit",
    "typecheck:frontend": "cd frontend && vue-tsc --noEmit",
    "typecheck:cli": "cd cli && tsc --noEmit"
  }
}
```

**Priority:** Medium (needed for CI/CD)

**Effort:** Trivial (5 minutes)

---

## 5. Database Design

### Strengths ✅ (Excellent)

#### Schema Design

**Location:** [data/migrations/](data/migrations/)

**Highlights:**
- **Well-documented migrations** with comprehensive comments
- **Strategic indexing:**
  - GIN indexes for JSONB queries
  - Partial indexes (e.g., `WHERE deleted_at IS NULL`)
  - Composite indexes for common queries
- **Triggers for validation:** Prevent orphaned records
- **Idempotent migrations:** Safe to run multiple times
- **Sequence-based IDs:** No UUID overhead, human-readable

**Example from [data/migrations/001_initial_schema.sql](data/migrations/001_initial_schema.sql):**

```sql
-- Partial index for active entities (most common query)
-- This index is much smaller than indexing all entities
CREATE INDEX idx_entities_type_active
  ON entities(type, entered_at DESC)
  WHERE deleted_at IS NULL;

-- GIN index for JSONB queries
-- Supports queries like: WHERE data @> '{"author": "Tolkien"}'
CREATE INDEX idx_entities_data_gin
  ON entities USING GIN (data);
```

#### Security

**Database Roles:** [docs/explanation/database-roles.md](docs/explanation/database-roles.md)

- **Separate roles:** `quailcomp_owner` (DDL) vs. `quailcomp_app` (DML)
- **Principle of least privilege:** App cannot ALTER/DROP tables
- **No UPDATE/DELETE grants** on append-only tables (entities, events)
- **Explicit permissions:** Only necessary operations allowed

**Example from [data/migrations/001_initial_schema.sql](data/migrations/001_initial_schema.sql):**

```sql
-- Application role has minimal permissions
GRANT INSERT ON entities TO quailcomp_app;
GRANT SELECT ON entities TO quailcomp_app;
-- Note: No UPDATE or DELETE grants (append-only)

GRANT USAGE ON SEQUENCE entities_entity_id_seq TO quailcomp_app;
```

#### Event Sourcing Implementation

- **Elegant ID validation via triggers** (prevents orphaned events)
- **Sequence-based entity_id/event_id** (performant, human-readable)
- **Soft deletes/voids** preserve data (deleted_at, voided_at columns)
- **Complete audit trail** with entered_at timestamps

### Concerns & Recommendations ⚠️

#### 1. Potential Race Conditions

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

---

#### 2. No Foreign Key Constraints

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

---

#### 3. Migration Rollback

**Missing:** No down migrations / rollback scripts

**Current:** Migrations are one-way (up only)

**Recommendation:**

Add rollback scripts:

```
data/migrations/
  001_initial_schema.sql         # up
  001_initial_schema_down.sql    # down
  002_add_authorization.sql      # up
  002_add_authorization_down.sql # down
```

**Example [data/migrations/001_initial_schema_down.sql](data/migrations/001_initial_schema_down.sql):**

```sql
-- Rollback migration 001

-- Drop triggers
DROP TRIGGER IF EXISTS validate_entity_id_trigger ON events;
DROP FUNCTION IF EXISTS validate_entity_id();

-- Drop indexes
DROP INDEX IF EXISTS idx_entities_type_active;
DROP INDEX IF EXISTS idx_entities_data_gin;
-- ... (all indexes)

-- Drop tables
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS entities;

-- Revoke permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM quailcomp_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM quailcomp_app;
```

**Add rollback script:**

```typescript
// scripts/rollback-migration.ts
import { getConnection } from '@quailcomp/data-client';
import { readFileSync } from 'fs';

const migrationNumber = process.argv[2];
if (!migrationNumber) {
  console.error('Usage: bun run scripts/rollback-migration.ts <number>');
  process.exit(1);
}

const sql = readFileSync(`data/migrations/${migrationNumber}_*_down.sql`, 'utf-8');
const db = getConnection();
await db.query(sql);
console.log(`Rolled back migration ${migrationNumber}`);
```

**Priority:** Medium (needed for production safety)

**Effort:** Medium (1-2 hours per migration)

---

#### 4. Analytics Retention Policy

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

---

## 6. Services Architecture

### Book Metadata Service

**Location:** [server/src/book-metadata/](server/src/book-metadata/)

#### Strengths ✅

- **Clean provider abstraction** ([providers/base.ts](server/src/book-metadata/providers/base.ts))
- **Composite pattern** for multi-provider fallback ([composite-provider.ts](server/src/book-metadata/composite-provider.ts))
- **5 providers:** Google Books, Open Library, Library of Congress, Hardcover, WorldCat
- **Proper error types** (NotFoundError, RateLimitError, TimeoutError)
- **Mock provider** for testing
- **ISBN normalization utilities** ([utils/isbn.ts](server/src/book-metadata/utils/isbn.ts))

**Example composite fallback:**

```typescript
// Tries providers in order until one succeeds
const composite = new CompositeMetadataProvider([
  googleBooks,
  openLibrary,
  libraryOfCongress,
  hardcover,
]);

const metadata = await composite.getByISBN('9780547928227');
// Falls back through providers if first fails
```

#### Concerns & Recommendations ⚠️

##### 1. No Rate Limiting 🟡 MEDIUM PRIORITY

**Finding:** Providers make HTTP requests without rate limiting

**Risk:**
- Exceed API rate limits (especially Google Books)
- Get IP banned
- Degrade external services

**Recommendation:**

Add rate limiting using token bucket algorithm:

```typescript
// server/src/book-metadata/utils/rate-limiter.ts
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Usage in provider:
export class GoogleBooksProvider extends BaseMetadataProvider {
  private rateLimiter = new RateLimiter(10, 1); // 10 requests, refill 1/sec

  async getByISBN(isbn: string): Promise<BookMetadata> {
    await this.rateLimiter.acquire();
    return this.fetch(`/volumes?q=isbn:${isbn}`);
  }
}
```

**Priority:** Medium

**Effort:** Small (2-3 hours)

---

##### 2. No Timeout Configuration

**Finding:** Base config has timeout but not consistently enforced

**Recommendation:**

Ensure all fetch calls respect timeout:

```typescript
// server/src/book-metadata/providers/base.ts
export abstract class BaseMetadataProvider {
  constructor(protected config: ProviderConfig) {}

  protected async fetch<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeout || 10000
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request to ${url} timed out`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

**Also add circuit breaker pattern:**

```typescript
// server/src/book-metadata/utils/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
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
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

**Priority:** Medium

**Effort:** Medium (3-4 hours)

---

##### 3. API Key Management

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

---

## 7. Security Considerations

### Strengths ✅

#### Authentication

**Location:** [server/src/auth/](server/src/auth/)

- **Bcrypt password hashing** (not plaintext)
- **JWT tokens with expiration**
- **Multiple auth methods supported:**
  - Password
  - Passkey (WebAuthn)
  - OAuth
  - API Key
- **Credentials stored separately** from users (good separation)

**Example from [server/src/auth/password.ts](server/src/auth/password.ts):**

```typescript
import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

#### SQL Injection Prevention

- **Bun SQL tagged templates throughout**
- **No string concatenation found**
- All queries use parameterized queries

**Example:**

```typescript
// ✅ Safe (parameterized)
await db.sql`SELECT * FROM entities WHERE entity_id = ${entityId}`;

// ❌ Unsafe (never used in codebase)
await db.query(`SELECT * FROM entities WHERE entity_id = ${entityId}`);
```

### Concerns & Recommendations ⚠️

#### 1. JWT Secret Management 🟡 MEDIUM PRIORITY

**Finding:** No evidence of JWT_SECRET validation or rotation

**Recommendation:**

Require JWT_SECRET in production:

```typescript
// server/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET must be at least 32 characters for production use'
  }),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

// Fail fast if invalid
export const env = envSchema.parse(process.env);
```

**Document secret rotation procedure:**

```markdown
## JWT Secret Rotation

1. Generate new secret: `openssl rand -base64 32`
2. Update environment variable
3. Old tokens will become invalid (users must re-login)
4. Consider grace period: accept both old and new secrets for 24h
```

**Implement dual-secret grace period:**

```typescript
// server/src/auth/jwt.ts
const currentSecret = env.JWT_SECRET;
const previousSecret = env.JWT_SECRET_OLD; // optional

export function verifyToken(token: string): Payload {
  try {
    return jwt.verify(token, currentSecret);
  } catch (error) {
    // Try previous secret during rotation grace period
    if (previousSecret) {
      return jwt.verify(token, previousSecret);
    }
    throw error;
  }
}
```

**Priority:** Medium

**Effort:** Small (1-2 hours)

---

#### 2. CORS Configuration 🟡 MEDIUM PRIORITY

**Location:** [server/src/middleware/cors.ts](server/src/middleware/cors.ts)

**Finding:** `defaultCors` middleware exists but configuration not clear

**Recommendation:**

Configure CORS per environment:

```typescript
// server/src/middleware/cors.ts
import { env } from '../config';

const allowedOrigins = env.NODE_ENV === 'production'
  ? ['https://app.quailcomp.com', 'https://www.quailcomp.com']
  : ['http://localhost:5173', 'http://localhost:3000'];

export function cors(request: Request): Response | undefined {
  const origin = request.headers.get('Origin');

  // Check if origin is allowed
  if (origin && !allowedOrigins.includes(origin)) {
    return new Response('CORS policy violation', { status: 403 });
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    });
  }
}
```

**Priority:** Medium

**Effort:** Small (1 hour)

---

#### 3. No Rate Limiting on Auth Endpoints 🔴 HIGH PRIORITY

**Risk:** Brute force attacks on `/auth/login`

**Recommendation:**

Add rate limiting middleware:

```typescript
// server/src/middleware/rate-limit.ts
const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  maxAttempts: number,
  windowMs: number
) {
  return (request: Request) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();

    const record = attempts.get(ip);

    // Clean up expired records
    if (record && record.resetAt < now) {
      attempts.delete(ip);
    }

    // Check rate limit
    const current = attempts.get(ip);
    if (current && current.count >= maxAttempts) {
      return Response.json(
        { error: 'Too many attempts. Try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((current.resetAt - now) / 1000))
          }
        }
      );
    }

    // Increment counter
    attempts.set(ip, {
      count: (current?.count || 0) + 1,
      resetAt: current?.resetAt || now + windowMs,
    });
  };
}

// Usage:
export const authRoutes = [
  {
    method: 'POST',
    path: '/auth/login',
    middleware: [rateLimit(5, 60000)], // 5 attempts per minute
    handler: login,
  },
];
```

**Also implement account lockout:**

```typescript
// Track failed login attempts per user
const failedAttempts = new Map<string, number>();

export async function login(request: Request): Promise<Response> {
  const { email, password } = await request.json();

  // Check if account is locked
  const attempts = failedAttempts.get(email) || 0;
  if (attempts >= 5) {
    return Response.json(
      { error: 'Account locked. Contact support.' },
      { status: 423 } // Locked
    );
  }

  const user = await findUserByEmail(email);
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    failedAttempts.set(email, attempts + 1);
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Success - reset attempts
  failedAttempts.delete(email);

  return Response.json({ token: generateToken(user) });
}
```

**Priority:** HIGH (security critical)

**Effort:** Small (2-3 hours)

---

#### 4. Password Validation

**Location:** [server/src/auth/password.ts](server/src/auth/password.ts)

**Current:** `validatePassword` only checks minimum length

**Recommendation:**

Add comprehensive validation:

```typescript
// server/src/auth/password.ts
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check against common passwords
  const commonPasswords = [
    'password', '12345678', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Also add password strength meter in frontend:**

```vue
<!-- frontend/src/components/PasswordStrengthMeter.vue -->
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ password: string }>();

const strength = computed(() => {
  let score = 0;
  if (props.password.length >= 8) score++;
  if (props.password.length >= 12) score++;
  if (/[A-Z]/.test(props.password)) score++;
  if (/[a-z]/.test(props.password)) score++;
  if (/[0-9]/.test(props.password)) score++;
  if (/[^A-Za-z0-9]/.test(props.password)) score++;

  if (score <= 2) return { label: 'Weak', color: 'red' };
  if (score <= 4) return { label: 'Medium', color: 'orange' };
  return { label: 'Strong', color: 'green' };
});
</script>

<template>
  <div class="password-strength">
    <div class="strength-bar" :style="{ width: `${(strength.score / 6) * 100}%`, backgroundColor: strength.color }"></div>
    <span>{{ strength.label }}</span>
  </div>
</template>
```

**Priority:** Medium

**Effort:** Small (1-2 hours)

---

#### 5. No HTTPS Enforcement 🟡 MEDIUM PRIORITY

**Recommendation:**

Add HTTPS redirect in production:

```typescript
// server/src/middleware/https-redirect.ts
export function httpsRedirect(request: Request): Response | undefined {
  if (env.NODE_ENV !== 'production') return;

  const proto = request.headers.get('x-forwarded-proto');
  if (proto === 'http') {
    const url = new URL(request.url);
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
}
```

**Set secure cookie flags:**

```typescript
// server/src/auth/session.ts
export function setSessionCookie(response: Response, token: string): void {
  const cookie = [
    `session=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    env.NODE_ENV === 'production' ? 'Secure' : '',
    `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
  ].filter(Boolean).join('; ');

  response.headers.set('Set-Cookie', cookie);
}
```

**Implement HSTS headers:**

```typescript
// server/src/middleware/security-headers.ts
export function securityHeaders(request: Request, response: Response): Response {
  if (env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}
```

**Priority:** Medium (required for production)

**Effort:** Small (1 hour)

---

## 8. Performance Considerations

### Database

#### Strengths ✅

- **Strategic indexing** (GIN, partial, composite)
- **`DISTINCT ON`** for latest-entry queries (efficient)
- **Sequence-based IDs** (no UUID overhead)

#### Concerns & Recommendations ⚠️

##### 1. N+1 Query Potential

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

---

##### 2. No Query Performance Monitoring

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

---

### Frontend

#### Concerns & Recommendations ⚠️

##### 1. No Code Splitting

**Location:** [frontend/vite.config.ts](frontend/vite.config.ts)

**Finding:** Vite config doesn't configure chunking

**Recommendation:**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'ui': ['@/components/ui/Button.vue', '@/components/ui/Card.vue'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Warn if chunk > 600kb
  },
});
```

**Priority:** Low (frontend is minimal currently)

---

##### 2. No Lazy Loading

**Recommendation:**

Lazy load routes:

```typescript
// frontend/src/router/index.ts
const routes = [
  {
    path: '/books',
    component: () => import('@/views/Books.vue'), // Lazy loaded
    meta: { requiresAuth: true },
  },
  {
    path: '/collections',
    component: () => import('@/views/Collections.vue'), // Lazy loaded
    meta: { requiresAuth: true },
  },
];
```

Lazy load heavy components:

```vue
<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

const HeavyChart = defineAsyncComponent(() =>
  import('@/components/HeavyChart.vue')
);
</script>

<template>
  <Suspense>
    <HeavyChart v-if="showChart" />
    <template #fallback>
      <div>Loading chart...</div>
    </template>
  </Suspense>
</template>
```

**Priority:** Low

---

## 9. Technical Debt & TODOs

### Findings ✅

**No TODO Comments:** Searched for TODO/FIXME/XXX/HACK - **0 instances found** - Excellent!

**Incomplete Features:**
- Authorization implemented but not enforced (see Section 1.3)
- Frontend is minimal (17 components) - appears experimental
- CLI exists but limited functionality
- Some domains documented but not implemented:
  - Locations ([domains/locations.md](domains/locations.md))
  - People ([domains/people.md](domains/people.md))
  - Series ([domains/series.md](domains/series.md))

### Recommendations

#### 1. Prioritize Feature Completion

**High Priority:**
- ✅ Complete authorization integration (security issue)
- ✅ Document experimental features clearly

**Medium Priority:**
- Flesh out frontend or mark as experimental
- Complete CLI commands or remove incomplete ones

**Low Priority:**
- Implement documented-but-missing domains
- Or remove domain docs if not planned

---

#### 2. Document Known Limitations

**Create [ROADMAP.md](ROADMAP.md):**

```markdown
# Roadmap

## Current Status (v0.1.0)

**Production Ready:**
- ✅ Event sourcing infrastructure
- ✅ Database schema and migrations
- ✅ Authentication (password, JWT)
- ✅ Book metadata service
- ✅ Data client libraries

**Experimental (Not Production Ready):**
- ⚠️ Frontend (Vue app) - minimal implementation
- ⚠️ CLI - basic commands only
- ⚠️ Authorization - schema exists, not enforced

**Planned:**
- 📅 Q1 2026: Authorization enforcement, rate limiting
- 📅 Q2 2026: Frontend expansion, E2E tests
- 📅 Q3 2026: People/Series/Locations domains
- 📅 Q4 2026: Mobile app, public API

## Feature Requests

See [GitHub Issues](https://github.com/yourorg/quailcomp/issues)
```

**Mark experimental code:**

```typescript
// server/src/routes/experimental.ts
/**
 * ⚠️ EXPERIMENTAL
 *
 * This route is experimental and may change without notice.
 * Not recommended for production use.
 */
export async function experimentalFeature(request: Request): Promise<Response> {
  // ...
}
```

**Priority:** Medium

**Effort:** Small (1 hour)

---

## 10. Testing & Quality Assurance

### Coverage

**Current:**
- **90% threshold** enforced
- **Comprehensive test suites** (6,158 lines)
- **Test plan documentation** (excellent practice)

**Gaps:**
- ❌ No frontend tests
- ❌ No E2E tests
- ❌ No performance tests
- ❌ No load tests
- ❌ No security tests (SQL injection, XSS, etc.)

### Recommendations

#### 1. Add Missing Test Types (covered in Section 2)

#### 2. Property-Based Testing 🟡 MEDIUM PRIORITY

**Recommendation:** Add fast-check for data clients:

```bash
bun add -d fast-check
```

```typescript
// data/client/tests/properties.test.ts
import fc from 'fast-check';
import { entitiesClient } from '../src/entities';

test('entity updates preserve history', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        title: fc.string(),
        author: fc.string(),
        isbn: fc.string({ minLength: 13, maxLength: 13 }),
      }),
      async (data) => {
        // Create entity
        const entity = await entitiesClient.create({
          type: 'book',
          data,
        });

        // Update multiple times
        for (let i = 0; i < 5; i++) {
          await entitiesClient.update({
            entityId: entity.entityId,
            type: 'book',
            data: { ...data, updatedCount: i },
          });
        }

        // Verify history
        const history = await entitiesClient.getHistory(entity.entityId);
        expect(history).toHaveLength(6); // 1 create + 5 updates

        // Verify order
        for (let i = 0; i < history.length - 1; i++) {
          expect(history[i].enteredAt <= history[i + 1].enteredAt).toBe(true);
        }
      }
    ),
    { numRuns: 100 } // Run 100 random test cases
  );
});

test('JSONB queries find correct entities', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({
        title: fc.string(),
        author: fc.string(),
        year: fc.integer({ min: 1000, max: 2030 }),
      }), { minLength: 10, maxLength: 50 }),
      async (books) => {
        // Create entities
        const created = await Promise.all(
          books.map(data => entitiesClient.create({ type: 'book', data }))
        );

        // Query by random field
        const randomBook = books[Math.floor(Math.random() * books.length)];
        const found = await entitiesClient.findByData({
          type: 'book',
          data: { author: randomBook.author },
        });

        // Verify results contain at least the matching book
        expect(found.some(e => e.data.author === randomBook.author)).toBe(true);
      }
    )
  );
});
```

**Benefits:**
- Tests edge cases you wouldn't think of
- Finds bugs through randomization
- Validates invariants across many inputs

**Priority:** Medium

**Effort:** Medium (1-2 days for comprehensive suite)

---

#### 3. Mutation Testing

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

---

## 11. Dependency Management

### Analysis

**Root Dependencies:** Minimal, mostly dev tools
**Workspace Dependencies:** Appropriate scoping

**Example from [server/package.json](server/package.json):**
```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2"
  }
}
```

### Concerns & Recommendations ⚠️

#### 1. Hardcoded Bun Version

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

---

#### 2. No Dependency Updates Strategy

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

---

#### 3. Security Auditing

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

---

## 12. Deployment & Operations

### Current State ⚠️

**Missing:**
- ❌ Dockerfile
- ❌ docker-compose.yml
- ❌ Production environment setup
- ❌ Health check endpoint
- ❌ Logging aggregation
- ❌ Error tracking (Sentry, etc.)
- ❌ Monitoring/observability

### Recommendations

#### 1. Add Docker Support 🟡 MEDIUM PRIORITY

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

---

#### 2. Add docker-compose for Development

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

---

#### 3. Add Observability 🟡 MEDIUM PRIORITY

**Structured Logging:**

```bash
bun add pino
```

```typescript
// server/src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined,
  base: {
    env: env.NODE_ENV,
    revision: env.GIT_COMMIT,
  },
});

// Usage:
logger.info({ userId, bookId }, 'Book created');
logger.error({ err, userId }, 'Failed to create book');
```

**Metrics Export:**

```typescript
// server/src/utils/metrics.ts
const metrics = {
  requests: new Map<string, number>(),
  errors: new Map<string, number>(),
  latencies: new Map<string, number[]>(),
};

export function recordRequest(route: string, duration: number, status: number): void {
  metrics.requests.set(route, (metrics.requests.get(route) || 0) + 1);

  if (status >= 500) {
    metrics.errors.set(route, (metrics.errors.get(route) || 0) + 1);
  }

  const latencies = metrics.latencies.get(route) || [];
  latencies.push(duration);
  metrics.latencies.set(route, latencies);
}

// Prometheus-format endpoint
export function getMetrics(): string {
  let output = '';

  // Request counts
  for (const [route, count] of metrics.requests) {
    output += `http_requests_total{route="${route}"} ${count}\n`;
  }

  // Error counts
  for (const [route, count] of metrics.errors) {
    output += `http_errors_total{route="${route}"} ${count}\n`;
  }

  // Latency percentiles
  for (const [route, latencies] of metrics.latencies) {
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    output += `http_request_duration_ms{route="${route}",quantile="0.5"} ${p50}\n`;
    output += `http_request_duration_ms{route="${route}",quantile="0.95"} ${p95}\n`;
    output += `http_request_duration_ms{route="${route}",quantile="0.99"} ${p99}\n`;
  }

  return output;
}
```

**Error Tracking:**

```bash
bun add @sentry/bun
```

```typescript
// server/src/utils/sentry.ts
import * as Sentry from '@sentry/bun';

if (env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

// In error handler:
Sentry.captureException(error);
```

**Priority:** Medium (needed for production)

**Effort:** Medium (3-4 hours)

---

#### 4. Add Production Checklist

**Create [docs/how-to/deploy-production.md](docs/how-to/deploy-production.md)** (see Section 3.3)

**Priority:** Medium

**Effort:** Small (2-3 hours)

---

## 13. Code Simplification Opportunities

### Major Opportunities

#### 1. Query Builder Abstraction (High Impact) 🔴

**Covered in Section 1.1** - Would eliminate ~500 lines of duplicated code.

**Priority:** HIGH
**Effort:** Medium (2-3 hours)

---

#### 2. Middleware Composition Helper

**Location:** [server/src/server.ts](server/src/server.ts)

**Current:** Manual composition

**Recommendation:**

```typescript
// server/src/utils/middleware.ts
export function compose(...middleware: Middleware[]): Middleware {
  return async (request: Request) => {
    for (const mw of middleware) {
      const result = await mw(request);
      if (result) return result; // Early return if middleware responds
    }
  };
}

// Usage in server.ts
const authStack = compose(
  errorHandler,
  requestLogger,
  requireAuth
);

const publicStack = compose(
  errorHandler,
  requestLogger
);
```

**Priority:** Low

**Effort:** Small (30 minutes)

---

#### 3. Response Helper Functions

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

---

#### 4. Database Connection Singleton

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

---

## 14. Alternative Architectural Approaches

### 1. Event Store Libraries

**Current:** Custom event sourcing implementation

**Alternatives:**
- EventStoreDB
- Marten (if using .NET)
- Axon Framework (if using Java)

**Pros of Current Approach:**
- ✅ Full control, minimal dependencies
- ✅ Simple PostgreSQL schema
- ✅ Easy to understand and debug
- ✅ Well-documented
- ✅ Lightweight

**Cons of Current Approach:**
- ❌ Must implement projections manually
- ❌ No built-in event versioning
- ❌ No stream slicing
- ❌ No competing consumers pattern
- ❌ No built-in snapshots

**Recommendation:**

**Keep current approach** unless you need:
- Complex projections across many event streams
- Event replays across multiple systems
- Distributed event processing
- Advanced event versioning

For this project size and complexity, the custom implementation is **superior** to heavy event store libraries.

**Verdict:** ✅ Current approach is correct

---

### 2. ORM Consideration

**Current:** Raw SQL via Bun tagged templates

**Alternatives:**
- Drizzle ORM (TypeScript-first)
- Prisma (schema-first)
- TypeORM (decorator-based)

**Pros of Current Approach:**
- ✅ No abstraction leakage
- ✅ Full SQL control (indexes, DISTINCT ON, etc.)
- ✅ Type-safe via Bun
- ✅ Lightweight (no query builder overhead)
- ✅ Easy to optimize queries

**Cons of Current Approach:**
- ❌ Manual schema changes
- ❌ No automatic migration generation
- ❌ No query builder conveniences (joins, relations)
- ❌ More verbose for simple queries

**Drizzle ORM Example:**

```typescript
// If you wanted to use Drizzle:
import { pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const entities = pgTable('entities', {
  entityId: serial('entity_id').primaryKey(),
  type: text('type').notNull(),
  data: jsonb('data').notNull(),
  enteredAt: timestamp('entered_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// Query:
const books = await db
  .select()
  .from(entities)
  .where(eq(entities.type, 'book'))
  .where(isNull(entities.deletedAt));
```

**Recommendation:**

**Stick with current approach** for core tables because:
- Event sourcing benefits from explicit SQL control
- Append-only pattern doesn't need UPDATE/DELETE abstractions
- DISTINCT ON and other PostgreSQL features are well-utilized

**Consider Drizzle** if:
- Complex JOIN queries become common
- Type generation from database becomes valuable
- Query builder would significantly reduce code

**Verdict:** ✅ Current approach is correct for now, revisit if complexity grows

---

### 3. Monorepo Tool

**Current:** Bun workspaces

**Alternatives:**
- Turborepo (build caching, task orchestration)
- Nx (build caching, dependency graphs, code generation)
- Lerna (multi-package publishing)

**Pros of Current Approach:**
- ✅ Simple, built into Bun
- ✅ No additional tooling
- ✅ Fast (Bun native)
- ✅ Sufficient for current project size

**Cons of Current Approach:**
- ❌ No task caching (rebuild everything)
- ❌ No dependency graph visualization
- ❌ No remote caching
- ❌ No task orchestration (parallelization)

**Turborepo Example:**

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    }
  }
}
```

**Benefits:**
- Cached builds (only rebuild changed packages)
- Parallel task execution
- Remote cache (CI/CD speedup)

**Recommendation:**

**Current setup is appropriate** for project size (4 workspaces).

**Consider Turborepo** if:
- Project grows to 10+ packages
- Build times exceed 1 minute
- CI/CD becomes slow
- Need remote caching across team

**Verdict:** ✅ Current approach is fine, monitor build times

---

## 15. Missing Features & Enhancements

### High Priority 🔴

1. **Authorization Enforcement** - Security critical (Section 1.3)
2. **API Rate Limiting** - Security/stability (Section 7.3)
3. **Production Deployment Guide** - Operations (Section 3.3)
4. **Frontend Error Handling** - User experience (Section 1.4)
5. **Database Migration Rollback** - Operations safety (Section 5.3)

### Medium Priority 🟡

6. **E2E Test Suite** - Quality assurance (Section 2.3)
7. **API Documentation (OpenAPI)** - Developer experience (Section 3.1)
8. **Docker Support** - Deployment (Section 12.1)
9. **Observability Integration** - Operations (Section 12.3)
10. **Frontend Testing** - Quality assurance (Section 2.2)
11. **Environment Variable Validation** - Configuration safety (Section 4.2)
12. **Analytics Retention Cleanup** - Database maintenance (Section 5.4)
13. **Book Metadata Rate Limiting** - Service stability (Section 6.1)
14. **Password Strength Requirements** - Security (Section 7.4)
15. **CORS Configuration** - Security (Section 7.2)

### Low Priority ⚪

16. **CLI Command Completion** - Nice to have
17. **GraphQL API** - Alternative to REST
18. **Real-time Updates (WebSockets)** - Feature enhancement
19. **Admin Dashboard** - Operations convenience
20. **Data Export/Import** - User convenience
21. **Database Schema Diagram** - Documentation (Section 3.2)
22. **Dependency Update Automation** - Maintenance (Section 11.2)
23. **Code Splitting** - Frontend optimization (Section 8.2.1)
24. **Query Performance Monitoring** - Database optimization (Section 8.1.2)
25. **Property-Based Testing** - Test quality (Section 10.2)

---

## 16. Positive Highlights

**What's Working Exceptionally Well:**

### 1. Documentation Quality ⭐⭐⭐⭐⭐

**Best-in-class documentation:**
- Comprehensive (44 READMEs, ~5,000 lines)
- Well-organized (Diátaxis framework)
- Maintained (pre-commit hooks enforce updates)
- Innovative (markdown-driven domain docs)

**This is the project's greatest strength.**

### 2. Domain Modeling ⭐⭐⭐⭐⭐

**Innovative approach:**
- Markdown files with embedded types
- Auto-extraction prevents documentation drift
- Clear bounded contexts
- Excellent philosophy documentation

**This pattern should be shared with the community.**

### 3. Testing Philosophy ⭐⭐⭐⭐⭐

**Comprehensive test plans:**
- Detailed coverage plans in test files
- 90% threshold enforced
- Infrastructure testing (misc.test.ts)
- Unique type names prevent conflicts

**Example from [data/client/tests/entities.test.ts](data/client/tests/entities.test.ts) shows exceptional planning.**

### 4. Git Hooks ⭐⭐⭐⭐⭐

**Excellent automation:**
- Pre-commit: lint, typecheck, README verification
- Prevents broken code from being committed
- Installation script ([scripts/install-hooks.sh](scripts/install-hooks.sh))
- Well-tested (misc.test.ts)

### 5. README Maintenance ⭐⭐⭐⭐⭐

**Systematic approach:**
- Every directory documented
- Enforcement via pre-commit hook
- Clear guidelines ([docs/how-to/maintain-readmes.md](docs/how-to/maintain-readmes.md))
- AI assistant instructions include README updates

**This prevents documentation rot.**

### 6. Type Safety ⭐⭐⭐⭐⭐

**Strict TypeScript:**
- Branded types (UserId, BookId, etc.)
- Discriminated unions
- No `any` types found
- Proper type inference

### 7. SQL Quality ⭐⭐⭐⭐⭐

**Well-structured migrations:**
- Comprehensive comments
- Strategic indexing
- Idempotent (safe to re-run)
- Security-conscious (separate roles)

### 8. Project Organization ⭐⭐⭐⭐⭐

**Clear directory structure:**
- Logical workspace separation
- No circular dependencies
- READMEs explain purpose
- Easy to navigate

### 9. Developer Experience ⭐⭐⭐⭐⭐

**Quick start:**
- Clear setup guide
- Working examples
- Quick reference tables
- AI assistant instructions

### 10. Code Cleanliness ⭐⭐⭐⭐⭐

**No technical debt markers:**
- 0 TODO/FIXME/XXX comments
- Consistent formatting
- No commented-out code
- Well-structured

---

## 17. Critical Recommendations Summary

### Immediate Actions (Do This Week)

| Priority | Task | Location | Effort | Impact |
|----------|------|----------|--------|--------|
| 🔴 HIGH | Refactor query duplication | [data/client/src/entities.ts](data/client/src/entities.ts), [data/client/src/events.ts](data/client/src/events.ts) | 2-3 hours | -500 lines code |
| 🔴 HIGH | Enable authorization checks | [server/src/routes/*.ts](server/src/routes/) | 4-6 hours | Security fix |
| 🔴 HIGH | Add rate limiting to auth | [server/src/routes/auth.ts](server/src/routes/auth.ts) | 2-3 hours | Security fix |
| 🟡 MEDIUM | Add frontend error handling | [frontend/src/api/client.ts](frontend/src/api/client.ts) | 1-2 hours | Better UX |
| 🟡 MEDIUM | Document incomplete features | Create [ROADMAP.md](ROADMAP.md) | 1 hour | Clarity |

**Total effort: ~12-17 hours** (1.5-2 days)

### Short-term (Do This Month)

| Priority | Task | Location | Effort | Impact |
|----------|------|----------|--------|--------|
| 🟡 MEDIUM | Add E2E tests | [server/tests/e2e/](server/tests/e2e/) | 2-3 days | Quality |
| 🟡 MEDIUM | Create deployment docs | [docs/how-to/deploy-production.md](docs/how-to/deploy-production.md) | 2-3 hours | Operations |
| 🟡 MEDIUM | Add env validation | [server/src/config.ts](server/src/config.ts) | 1 hour | Safety |
| 🟡 MEDIUM | Implement migration rollback | [data/migrations/*_down.sql](data/migrations/) | 1-2 hours | Safety |
| 🟡 MEDIUM | Add OpenAPI spec | [server/src/openapi.ts](server/src/openapi.ts) | 1-2 days | DX |

**Total effort: ~5-7 days**

### Long-term (Do This Quarter)

| Priority | Task | Location | Effort | Impact |
|----------|------|----------|--------|--------|
| 🟡 MEDIUM | Add Docker support | [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml) | 2-3 hours | Deployment |
| 🟡 MEDIUM | Implement observability | [server/src/utils/logger.ts](server/src/utils/logger.ts), metrics | 3-4 hours | Operations |
| 🟡 MEDIUM | Add frontend tests | [frontend/tests/](frontend/tests/) | 1-2 days | Quality |
| 🟡 MEDIUM | Analytics cleanup job | [scripts/cleanup-analytics.ts](scripts/cleanup-analytics.ts) | 1 hour | Maintenance |
| ⚪ LOW | Add admin tooling | [admin/](admin/) | 1 week | Convenience |

**Total effort: ~2-3 weeks**

---

## 18. Final Assessment

### Scoring Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture & Design** | 9/10 | Excellent event sourcing, minor duplication issues |
| **Code Quality** | 8/10 | High quality, some simplification possible |
| **Documentation** | 10/10 | Outstanding, comprehensive, innovative |
| **Testing** | 7/10 | Good unit tests, missing E2E/frontend |
| **Security** | 6/10 | Good foundations, missing enforcement/hardening |
| **Performance** | 7/10 | Well-indexed, no monitoring yet |
| **Deployment** | 4/10 | Minimal production support |
| **Developer Experience** | 9/10 | Excellent onboarding, clear guides |

### Overall: 8.5/10 - Excellent

---

## Conclusion

Quailcomp is an **exceptionally well-crafted codebase** that demonstrates mature software engineering practices. The event sourcing implementation is clean and well-documented, the domain modeling approach is innovative, and the overall architecture is sound.

### Standout Achievements

1. **Documentation Excellence** - Best-in-class, could be a reference implementation
2. **Domain Modeling Innovation** - Markdown-driven types prevent drift
3. **Testing Discipline** - Comprehensive test plans, 90% coverage
4. **Developer Experience** - Clear onboarding, helpful automation
5. **Code Quality** - Clean, consistent, no technical debt

### Primary Areas for Improvement

1. **Code Duplication** - ~500 lines of query duplication can be refactored
2. **Security Hardening** - Authorization exists but not enforced, needs rate limiting
3. **Production Readiness** - Missing deployment docs, Docker, observability
4. **Test Coverage** - Need E2E and frontend tests
5. **Feature Completion** - Some domains documented but not implemented

### Production Readiness

**Current Status:**

✅ **Ready for production:**
- Event sourcing infrastructure
- Database schema and migrations
- Authentication
- Book metadata service
- Data client libraries

⚠️ **Needs work before production:**
- Authorization enforcement (security)
- Rate limiting (security)
- Deployment documentation
- Observability/monitoring
- Error tracking

### Recommendation

**This codebase is production-ready** once the high-priority security items are addressed (authorization enforcement, rate limiting). The architecture is solid, the code quality is excellent, and the documentation is outstanding.

The main gap is operational maturity (deployment, monitoring, error tracking), which is expected for a project at this stage.

### Final Thoughts

**This is exemplary work** that would serve well as a:
- Reference implementation for event sourcing in TypeScript/Bun
- Example of excellent documentation practices
- Template for domain-driven design
- Case study in developer experience

The attention to detail, especially in documentation and testing, is particularly noteworthy. The project demonstrates that **quality documentation and clean architecture are achievable and valuable investments**.

---

**Recommended Next Steps:**

1. Address the 5 immediate action items (week 1)
2. Implement the short-term recommendations (month 1)
3. Plan for production deployment (month 2)
4. Add E2E and frontend tests (month 2-3)
5. Implement observability and monitoring (month 3)
6. Deploy to production (month 4)

**Estimated Time to Production:** 3-4 months of focused work

---

## Appendix: Quick Wins

If you have limited time, these provide maximum impact for minimal effort:

1. **Add env validation** (1 hour) - Prevents production incidents
2. **Document incomplete features** (1 hour) - Sets expectations
3. **Add response helpers** (1 hour) - Reduces boilerplate
4. **Add security audit script** (5 min) - Catches vulnerabilities
5. **Create .env.example** (15 min) - Improves onboarding
6. **Add production build scripts** (5 min) - Simplifies deployment
7. **Configure CORS properly** (1 hour) - Security improvement
8. **Add database rollback scripts** (2 hours) - Safety net
9. **Implement analytics cleanup** (1 hour) - Prevents bloat
10. **Add API key validation** (30 min) - Better error messages

**Total: ~8 hours for 10 improvements**
