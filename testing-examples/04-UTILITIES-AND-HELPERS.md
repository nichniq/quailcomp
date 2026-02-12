# Test Utilities and Helpers

> **Purpose:** Define reusable test utilities, helper functions, custom matchers, and test setup patterns that make tests cleaner and more maintainable.

---

## Philosophy

**Problem:** Tests become cluttered with repetitive setup and assertion code.

**Solution:** Extract common patterns into well-named utilities and helpers.

---

## 1. Database Helpers

### **Test Database Setup**

```typescript
// tests/helpers/database.ts

import type { DatabaseConnection } from "@/data/client/connection"

export interface TestDatabaseConfig {
  /** Unique test database name (auto-generated if not provided) */
  name?: string
  /** Whether to run migrations */
  runMigrations?: boolean
  /** Whether to seed test data */
  seedData?: boolean
}

/**
 * Create an isolated test database for a test suite
 *
 * @example
 * ```typescript
 * describe("UserRepository", () => {
 *   let db: DatabaseConnection
 *
 *   beforeAll(async () => {
 *     db = await createTestDatabase()
 *   })
 *
 *   afterAll(async () => {
 *     await closeTestDatabase(db)
 *   })
 * })
 * ```
 */
export async function createTestDatabase(
  config: TestDatabaseConfig = {}
): Promise<DatabaseConnection> {
  const dbName = config.name ?? `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  // Create database
  const adminDb = await connectAsAdmin()
  await adminDb.query(`CREATE DATABASE ${dbName}`)
  await adminDb.close()

  // Connect to new database
  const db = await connect({ database: dbName })

  // Run migrations if requested
  if (config.runMigrations !== false) {
    await runMigrations(db)
  }

  // Seed data if requested
  if (config.seedData) {
    await seedTestData(db)
  }

  return db
}

/**
 * Close and drop a test database
 */
export async function closeTestDatabase(db: DatabaseConnection): Promise<void> {
  const dbName = await db.query("SELECT current_database()").then(r => r.rows[0].current_database)

  await db.close()

  // Drop database
  const adminDb = await connectAsAdmin()
  await adminDb.query(`DROP DATABASE IF EXISTS ${dbName}`)
  await adminDb.close()
}

/**
 * Clear all data from test tables (faster than recreating database)
 *
 * @example
 * ```typescript
 * beforeEach(async () => {
 *   await clearTestData(db)
 * })
 * ```
 */
export async function clearTestData(db: DatabaseConnection): Promise<void> {
  await db.query("TRUNCATE entities, events, users RESTART IDENTITY CASCADE")
}

/**
 * Seed test database with common test data
 */
export async function seedTestData(db: DatabaseConnection): Promise<void> {
  // Create test users
  await db.query(`
    INSERT INTO users (id, email, password_hash, role)
    VALUES
      ('test-user-1', 'owner@example.com', 'hash', 'owner'),
      ('test-user-2', 'writer@example.com', 'hash', 'write'),
      ('test-user-3', 'reader@example.com', 'hash', 'read')
  `)

  // Create test entities
  await db.query(`
    INSERT INTO entities (id, type, properties, metadata)
    VALUES
      ('test-book-1', 'book', '{"title":"1984"}', '{}'),
      ('test-book-2', 'book', '{"title":"Dune"}', '{}')
  `)
}

/**
 * Run migrations on a database
 */
export async function runMigrations(db: DatabaseConnection): Promise<void> {
  const migrationsDir = path.join(__dirname, "../../data/postgres/migrations")
  const files = await fs.readdir(migrationsDir)

  for (const file of files.sort()) {
    if (file.endsWith(".sql")) {
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf-8")
      await db.query(sql)
    }
  }
}

/**
 * Get a unique entity type for test isolation
 *
 * @example
 * ```typescript
 * test("creates entity", async () => {
 *   const type = uniqueEntityType("book")
 *   const entity = await EntityFactory.create({ type })
 * })
 * ```
 */
export function uniqueEntityType(base: string = "entity"): string {
  return `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
```

---

## 2. HTTP Testing Helpers

### **Mock HTTP Requests and Responses**

```typescript
// tests/helpers/http.ts

import type { Request, Response } from "@/types/http"

export interface MockRequestOptions {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, string>
}

/**
 * Create a mock HTTP request for testing route handlers
 *
 * @example
 * ```typescript
 * test("GET /api/books", async () => {
 *   const request = mockRequest({ method: "GET", url: "/api/books" })
 *   const response = await handleGetBooks(request)
 *   expect(response.status).toBe(200)
 * })
 * ```
 */
export function mockRequest(options: MockRequestOptions = {}): Request {
  return {
    method: options.method ?? "GET",
    url: options.url ?? "/",
    headers: new Headers(options.headers ?? {}),
    body: options.body,
    params: options.params ?? {},
    query: options.query ?? {},
    json: async () => options.body,
    text: async () => JSON.stringify(options.body),
  } as Request
}

/**
 * Create a mock HTTP response for testing middleware
 */
export function mockResponse(): Response {
  let statusCode = 200
  let responseBody: unknown = null
  let responseHeaders: Record<string, string> = {}

  return {
    status: (code: number) => {
      statusCode = code
      return this
    },
    json: (body: unknown) => {
      responseBody = body
      return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: { "Content-Type": "application/json", ...responseHeaders }
      })
    },
    send: (body: unknown) => {
      responseBody = body
      return new Response(String(body), { status: statusCode })
    },
    setHeader: (key: string, value: string) => {
      responseHeaders[key] = value
    },
    getStatus: () => statusCode,
    getBody: () => responseBody,
    getHeaders: () => responseHeaders
  } as any
}

/**
 * Create a mock authenticated request
 *
 * @example
 * ```typescript
 * test("authenticated request", async () => {
 *   const user = await UserFactory.create()
 *   const request = mockAuthenticatedRequest(user, { url: "/api/books" })
 *   const response = await handleGetBooks(request)
 *   expect(response.status).toBe(200)
 * })
 * ```
 */
export function mockAuthenticatedRequest(
  user: User,
  options: MockRequestOptions = {}
): Request {
  const token = generateTestJWT(user)

  return mockRequest({
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  })
}

/**
 * Generate a test JWT token for a user
 */
export function generateTestJWT(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET ?? "test-secret",
    { expiresIn: "1h" }
  )
}

/**
 * Mock fetch for external API calls
 *
 * @example
 * ```typescript
 * test("fetches book metadata", async () => {
 *   const mockFetch = createMockFetch({
 *     "https://api.example.com/books/123": { title: "Test Book" }
 *   })
 *
 *   globalThis.fetch = mockFetch
 *
 *   const metadata = await fetchBookMetadata("123")
 *   expect(metadata.title).toBe("Test Book")
 * })
 * ```
 */
export function createMockFetch(
  responses: Record<string, unknown>
): typeof fetch {
  return async (url: string | URL) => {
    const urlString = url.toString()
    const responseData = responses[urlString]

    if (!responseData) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }
}

/**
 * Create a mock fetch that simulates network errors
 */
export function createFailingFetch(errorMessage: string = "Network error"): typeof fetch {
  return async () => {
    throw new Error(errorMessage)
  }
}

/**
 * Create a mock fetch that simulates timeouts
 */
export function createTimeoutFetch(delay: number = 5000): typeof fetch {
  return async () => {
    await new Promise(resolve => setTimeout(resolve, delay))
    throw new Error("Request timeout")
  }
}
```

---

## 3. Custom Matchers

### **Domain-Specific Assertions**

```typescript
// tests/helpers/matchers.ts

import { expect } from "bun:test"
import type { Entity, Event, User } from "@domains/types"

/**
 * Custom matchers for cleaner assertions
 */
export const customMatchers = {
  /**
   * Assert that an object is a valid entity
   *
   * @example
   * ```typescript
   * expect(result).toBeValidEntity()
   * ```
   */
  toBeValidEntity(received: unknown) {
    const entity = received as Entity<any>

    const checks = {
      hasId: typeof entity?.id === "string",
      hasType: typeof entity?.type === "string",
      hasProperties: typeof entity?.properties === "object",
      hasMetadata: typeof entity?.metadata === "object",
      hasCreatedAt: typeof entity?.metadata?.created_at === "string",
      hasUpdatedAt: typeof entity?.metadata?.updated_at === "string",
      hasVersion: typeof entity?.metadata?.version === "number"
    }

    const failed = Object.entries(checks).filter(([, passed]) => !passed)

    return {
      pass: failed.length === 0,
      message: () =>
        failed.length === 0
          ? "Expected not to be a valid entity"
          : `Invalid entity: ${failed.map(([key]) => key).join(", ")}`
    }
  },

  /**
   * Assert that a value is a valid ISBN-13
   */
  toBeValidISBN(received: string) {
    const cleaned = received.replace(/[-\s]/g, "")
    const isValid = /^978\d{10}$/.test(cleaned) && validateISBN13Checksum(cleaned)

    return {
      pass: isValid,
      message: () =>
        isValid
          ? `Expected "${received}" not to be a valid ISBN`
          : `Expected "${received}" to be a valid ISBN-13`
    }
  },

  /**
   * Assert that a date string is recent (within last N seconds)
   */
  toBeRecentDate(received: string, withinSeconds: number = 10) {
    const date = new Date(received)
    const now = new Date()
    const diff = Math.abs(now.getTime() - date.getTime()) / 1000

    return {
      pass: diff <= withinSeconds,
      message: () =>
        diff <= withinSeconds
          ? `Expected "${received}" not to be within ${withinSeconds} seconds of now`
          : `Expected "${received}" to be within ${withinSeconds} seconds of now (was ${diff.toFixed(1)}s ago)`
    }
  },

  /**
   * Assert that an event has the expected structure
   */
  toBeValidEvent(received: unknown) {
    const event = received as Event

    const checks = {
      hasId: typeof event?.id === "string",
      hasType: typeof event?.type === "string",
      hasEntityId: typeof event?.entity_id === "string",
      hasAction: typeof event?.action === "string",
      hasTimestamp: typeof event?.timestamp === "string",
      hasData: typeof event?.data === "object"
    }

    const failed = Object.entries(checks).filter(([, passed]) => !passed)

    return {
      pass: failed.length === 0,
      message: () =>
        failed.length === 0
          ? "Expected not to be a valid event"
          : `Invalid event: ${failed.map(([key]) => key).join(", ")}`
    }
  },

  /**
   * Assert that a user has a specific permission level
   */
  toHavePermission(received: User, permission: "owner" | "write" | "read") {
    const levels = { owner: 3, write: 2, read: 1 }
    const userLevel = levels[received.role]
    const requiredLevel = levels[permission]

    return {
      pass: userLevel >= requiredLevel,
      message: () =>
        userLevel >= requiredLevel
          ? `Expected user not to have ${permission} permission`
          : `Expected user to have ${permission} permission (has ${received.role})`
    }
  }
}

// Extend expect with custom matchers
declare module "bun:test" {
  interface Matchers<T> {
    toBeValidEntity(): void
    toBeValidISBN(): void
    toBeRecentDate(withinSeconds?: number): void
    toBeValidEvent(): void
    toHavePermission(permission: "owner" | "write" | "read"): void
  }
}

// Register matchers
Object.assign(expect.extend, customMatchers)
```

### **Usage Examples**

```typescript
import { expect } from "bun:test"
import "@/tests/helpers/matchers" // Import to register matchers

test("creates valid entity", async () => {
  const entity = await EntityFactory.create()

  expect(entity).toBeValidEntity()
  expect(entity.metadata.created_at).toBeRecentDate()
})

test("validates ISBNs", () => {
  expect("978-0-134685-99-1").toBeValidISBN()
  expect("invalid-isbn").not.toBeValidISBN()
})

test("records valid events", async () => {
  const event = await EventFactory.create()

  expect(event).toBeValidEvent()
  expect(event.timestamp).toBeRecentDate(5)
})

test("checks permissions", () => {
  const owner = UserFactory.build({ role: "owner" })
  const reader = UserFactory.build({ role: "read" })

  expect(owner).toHavePermission("write")
  expect(reader).not.toHavePermission("write")
})
```

---

## 4. Test Data Fixtures

### **Static Test Data**

```typescript
// tests/fixtures/books.ts

import type { BookProperties } from "@domains/types"

/**
 * Well-known books for testing
 */
export const SAMPLE_BOOKS: Array<Omit<BookProperties, "id">> = [
  {
    title: "1984",
    author: "George Orwell",
    isbn: "978-0-452-28423-4",
    publishedDate: "1949-06-08",
    publisher: "Secker & Warburg",
    pageCount: 328,
    language: "en"
  },
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    isbn: "978-0-547-92822-7",
    publishedDate: "1937-09-21",
    publisher: "George Allen & Unwin",
    pageCount: 310,
    language: "en"
  },
  {
    title: "Dune",
    author: "Frank Herbert",
    isbn: "978-0-441-17271-9",
    publishedDate: "1965-08-01",
    publisher: "Chilton Books",
    pageCount: 412,
    language: "en"
  }
]

/**
 * Sample ISBN-13 numbers for validation testing
 */
export const VALID_ISBNS = [
  "978-0-134685-99-1",
  "978-0-596-52068-7",
  "978-1-491-91706-9",
  "978-0-13-468599-1",
  "978-0-321-12742-6"
]

/**
 * Invalid ISBNs for testing error handling
 */
export const INVALID_ISBNS = [
  "978-0-123456-47-3", // Invalid checksum
  "123-4-567890-12-3", // Invalid prefix
  "978-0-12345-678-9", // Too short
  "not-an-isbn",       // Invalid format
  ""                   // Empty
]
```

### **Usage**

```typescript
import { SAMPLE_BOOKS, VALID_ISBNS } from "@/tests/fixtures/books"

test("searches books by title", async () => {
  for (const book of SAMPLE_BOOKS) {
    await BookFactory.create(book)
  }

  const results = await searchBooks("Hobbit")

  expect(results).toHaveLength(1)
  expect(results[0].properties.title).toBe("The Hobbit")
})

test("validates ISBNs", () => {
  for (const isbn of VALID_ISBNS) {
    expect(isbn).toBeValidISBN()
  }
})
```

---

## 5. Mock Repositories

### **In-Memory Test Repositories**

```typescript
// tests/helpers/mocks/MockUserRepository.ts

import type { User, UserId } from "@domains/types"
import type { UserRepository } from "@/repositories/UserRepository"

/**
 * In-memory user repository for fast unit tests
 */
export class MockUserRepository implements UserRepository {
  private users: Map<UserId, User> = new Map()

  async create(user: Omit<User, "id">): Promise<User> {
    const id = crypto.randomUUID()
    const created: User = { ...user, id }
    this.users.set(id, created)
    return created
  }

  async getById(id: UserId): Promise<User | null> {
    return this.users.get(id) ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user
      }
    }
    return null
  }

  async update(id: UserId, updates: Partial<User>): Promise<User> {
    const existing = this.users.get(id)
    if (!existing) {
      throw new Error("User not found")
    }

    const updated = { ...existing, ...updates }
    this.users.set(id, updated)
    return updated
  }

  async delete(id: UserId): Promise<void> {
    this.users.delete(id)
  }

  async list(): Promise<User[]> {
    return Array.from(this.users.values())
  }

  /** Test helper: Clear all data */
  clear(): void {
    this.users.clear()
  }

  /** Test helper: Get count */
  count(): number {
    return this.users.size
  }
}

/**
 * Factory for creating mock user repository
 */
export function createMockUserRepository(): MockUserRepository {
  return new MockUserRepository()
}
```

### **Usage**

```typescript
import { createMockUserRepository } from "@/tests/helpers/mocks"

describe("AuthenticationService", () => {
  let userRepository: MockUserRepository

  beforeEach(() => {
    userRepository = createMockUserRepository()
  })

  test("registers new user", async () => {
    const authService = new AuthenticationService(userRepository)

    const user = await authService.register("test@example.com", "password123", "Test User")

    expect(user.id).toBeDefined()
    expect(userRepository.count()).toBe(1)
  })
})
```

---

## 6. Time Helpers

### **Controlling Time in Tests**

```typescript
// tests/helpers/time.ts

/**
 * Freeze time for testing
 *
 * @example
 * ```typescript
 * test("timestamps are consistent", async () => {
 *   const frozenTime = freezeTime("2024-01-01T00:00:00Z")
 *
 *   const entity1 = await EntityFactory.create()
 *   const entity2 = await EntityFactory.create()
 *
 *   expect(entity1.metadata.created_at).toBe(entity2.metadata.created_at)
 *
 *   unfreezeTime(frozenTime)
 * })
 * ```
 */
export function freezeTime(isoString: string): Date {
  const frozenDate = new Date(isoString)
  const originalDate = Date

  // @ts-ignore
  globalThis.Date = class extends originalDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(frozenDate.getTime())
      } else {
        super(...args)
      }
    }

    static now() {
      return frozenDate.getTime()
    }
  }

  return frozenDate
}

/**
 * Restore real time
 */
export function unfreezeTime(originalDate: typeof Date): void {
  globalThis.Date = originalDate
}

/**
 * Advance time by N milliseconds
 */
export function advanceTime(ms: number): void {
  const current = Date.now()
  freezeTime(new Date(current + ms).toISOString())
}
```

---

## 7. Assertion Helpers

### **Common Assertion Patterns**

```typescript
// tests/helpers/assertions.ts

import { expect } from "bun:test"
import type { Entity, ValidationResult } from "@domains/types"

/**
 * Assert that a validation result is successful
 */
export function expectValidationSuccess(result: ValidationResult): void {
  expect(result.valid).toBe(true)
  expect(result.errors).toHaveLength(0)
}

/**
 * Assert that a validation result failed with specific errors
 */
export function expectValidationError(
  result: ValidationResult,
  errorMessage: string | RegExp
): void {
  expect(result.valid).toBe(false)
  expect(result.errors.length).toBeGreaterThan(0)

  if (typeof errorMessage === "string") {
    expect(result.errors).toContain(errorMessage)
  } else {
    expect(result.errors.some(e => errorMessage.test(e))).toBe(true)
  }
}

/**
 * Assert that two entities are equivalent (ignoring metadata)
 */
export function expectEntitiesEqual<T>(
  actual: Entity<T>,
  expected: Entity<T>
): void {
  expect(actual.id).toBe(expected.id)
  expect(actual.type).toBe(expected.type)
  expect(actual.properties).toEqual(expected.properties)
}

/**
 * Assert that an array contains an entity with matching properties
 */
export function expectArrayContainsEntity<T>(
  array: Entity<T>[],
  properties: Partial<T>
): void {
  const match = array.find(entity =>
    Object.entries(properties).every(
      ([key, value]) => entity.properties[key as keyof T] === value
    )
  )

  expect(match).toBeDefined()
}
```

---

## Summary

**Test utilities make tests:**

1. ✅ **More readable** - Hide complexity behind clear abstractions
2. ✅ **Less repetitive** - Reuse common setup patterns
3. ✅ **Easier to maintain** - Change logic in one place
4. ✅ **Faster to write** - Spend less time on boilerplate
5. ✅ **More consistent** - Standard patterns across all tests

**Next Steps:**

1. Create `tests/helpers/` directory
2. Extract common patterns from existing tests
3. Build reusable utilities and factories
4. Document helper usage
5. Share across test suites

---

**Version:** 1.0.0
**Last Updated:** 2026-02-12
**Status:** ⭐️ Phase 0.2 - Testing Strategy & Infrastructure
