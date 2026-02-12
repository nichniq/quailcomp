# Test Factories and Builders

> **Purpose:** Define reusable test data generation patterns using factories and builders for declarative, maintainable tests.

---

## Philosophy

**Problem:** Tests become brittle and hard to read when they manually construct test data:

```typescript
// ❌ Brittle: Lots of repetition, hard to maintain
test("creates a book", async () => {
  const book = {
    id: crypto.randomUUID(),
    type: "book",
    properties: {
      title: "Test Book",
      author: "Test Author",
      isbn: "978-0-123456-47-2",
      publishedDate: "2024-01-01",
      publisher: "Test Publisher",
      pageCount: 300,
      language: "en"
    },
    metadata: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1
    }
  }
  // Test logic...
})
```

**Solution:** Use **factories** and **builders** to generate test data declaratively:

```typescript
// ✅ Clean: Focuses on what matters for this test
test("creates a book", async () => {
  const book = BookFactory.create({ title: "Test Book" })
  // Test logic...
})
```

---

## Factory Pattern

**Purpose:** Generate complete, valid test data with sensible defaults.

### **Basic Factory Implementation**

```typescript
// tests/factories/BookFactory.ts
import { faker } from "@faker-js/faker"
import type { Entity, BookProperties } from "@domains/types"

interface BookFactoryOptions {
  title?: string
  author?: string
  isbn?: string
  publishedDate?: string
  publisher?: string
  pageCount?: number
  language?: string
}

export class BookFactory {
  /**
   * Build a book entity in memory (not saved to database)
   */
  static build(overrides: BookFactoryOptions = {}): Entity<BookProperties> {
    const now = new Date().toISOString()

    return {
      id: crypto.randomUUID(),
      type: "book",
      properties: {
        title: overrides.title ?? faker.book.title(),
        author: overrides.author ?? faker.person.fullName(),
        isbn: overrides.isbn ?? faker.commerce.isbn(13),
        publishedDate: overrides.publishedDate ?? faker.date.past().toISOString(),
        publisher: overrides.publisher ?? faker.company.name(),
        pageCount: overrides.pageCount ?? faker.number.int({ min: 100, max: 1000 }),
        language: overrides.language ?? "en"
      },
      metadata: {
        created_at: now,
        updated_at: now,
        version: 1
      }
    }
  }

  /**
   * Create a book entity and save it to the database
   */
  static async create(
    overrides: BookFactoryOptions = {},
    repository?: EntityRepository
  ): Promise<Entity<BookProperties>> {
    const book = BookFactory.build(overrides)
    const repo = repository ?? getDefaultTestRepository()
    return await repo.create(book)
  }

  /**
   * Create multiple book entities
   */
  static buildList(count: number, overrides: BookFactoryOptions = []): Entity<BookProperties>[] {
    return Array.from({ length: count }, () => BookFactory.build(overrides))
  }

  /**
   * Create multiple book entities and save them
   */
  static async createList(
    count: number,
    overrides: BookFactoryOptions = {},
    repository?: EntityRepository
  ): Promise<Entity<BookProperties>[]> {
    const books = BookFactory.buildList(count, overrides)
    const repo = repository ?? getDefaultTestRepository()
    return await Promise.all(books.map(book => repo.create(book)))
  }
}
```

### **Using Factories in Tests**

```typescript
import { BookFactory } from "@/tests/factories"

describe("BookRepository", () => {
  test("creates a book", async () => {
    const book = await BookFactory.create({ title: "The Hobbit" })

    expect(book.id).toBeDefined()
    expect(book.properties.title).toBe("The Hobbit")
    expect(book.properties.author).toBeTruthy() // Random but realistic
  })

  test("retrieves books by author", async () => {
    const author = "J.R.R. Tolkien"
    await BookFactory.createList(3, { author })
    await BookFactory.createList(2, { author: "George Orwell" })

    const books = await repository.findByAuthor(author)

    expect(books).toHaveLength(3)
    expect(books.every(b => b.properties.author === author)).toBe(true)
  })

  test("handles books with minimal properties", async () => {
    const book = await BookFactory.create({
      title: "Untitled",
      author: "Unknown"
    })

    expect(book.properties.isbn).toBeDefined() // Auto-generated
    expect(book.properties.pageCount).toBeGreaterThan(0) // Sensible default
  })
})
```

---

## Builder Pattern

**Purpose:** Construct complex test data step-by-step with a fluent API.

### **Basic Builder Implementation**

```typescript
// tests/builders/BookBuilder.ts
import type { Entity, BookProperties } from "@domains/types"

export class BookBuilder {
  private entity: Partial<Entity<BookProperties>>

  constructor() {
    this.entity = {
      id: crypto.randomUUID(),
      type: "book",
      properties: {},
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1
      }
    }
  }

  withId(id: string): this {
    this.entity.id = id
    return this
  }

  withTitle(title: string): this {
    this.entity.properties!.title = title
    return this
  }

  withAuthor(author: string): this {
    this.entity.properties!.author = author
    return this
  }

  withISBN(isbn: string): this {
    this.entity.properties!.isbn = isbn
    return this
  }

  withPublisher(publisher: string): this {
    this.entity.properties!.publisher = publisher
    return this
  }

  withPageCount(pageCount: number): this {
    this.entity.properties!.pageCount = pageCount
    return this
  }

  withLanguage(language: string): this {
    this.entity.properties!.language = language
    return this
  }

  publishedOn(date: string): this {
    this.entity.properties!.publishedDate = date
    return this
  }

  createdAt(timestamp: string): this {
    this.entity.metadata!.created_at = timestamp
    return this
  }

  updatedAt(timestamp: string): this {
    this.entity.metadata!.updated_at = timestamp
    return this
  }

  build(): Entity<BookProperties> {
    // Ensure all required fields are present
    if (!this.entity.properties!.title) {
      throw new Error("Book title is required")
    }
    if (!this.entity.properties!.author) {
      throw new Error("Book author is required")
    }
    if (!this.entity.properties!.isbn) {
      throw new Error("Book ISBN is required")
    }

    return this.entity as Entity<BookProperties>
  }
}
```

### **Using Builders in Tests**

```typescript
import { BookBuilder } from "@/tests/builders"

describe("Book validation", () => {
  test("validates a complete book", () => {
    const book = new BookBuilder()
      .withTitle("1984")
      .withAuthor("George Orwell")
      .withISBN("978-0-452-28423-4")
      .withPublisher("Penguin Books")
      .withPageCount(328)
      .publishedOn("1949-06-08")
      .build()

    const validation = validateBook(book)

    expect(validation.valid).toBe(true)
    expect(validation.errors).toEqual([])
  })

  test("rejects book missing title", () => {
    expect(() => {
      new BookBuilder()
        .withAuthor("George Orwell")
        .withISBN("978-0-452-28423-4")
        .build()
    }).toThrow("Book title is required")
  })

  test("handles books with special publication dates", () => {
    const book = new BookBuilder()
      .withTitle("The Hobbit")
      .withAuthor("J.R.R. Tolkien")
      .withISBN("978-0-547-92822-7")
      .publishedOn("1937-09-21") // Specific historical date
      .build()

    expect(book.properties.publishedDate).toBe("1937-09-21")
  })
})
```

---

## Factory vs. Builder: When to Use Each

| **Factory** | **Builder** |
|-------------|-------------|
| ✅ Quick test data generation | ✅ Complex, multi-step construction |
| ✅ Sensible defaults | ✅ Explicit control over every field |
| ✅ Database integration (`create()`) | ✅ In-memory objects |
| ✅ Random realistic data | ✅ Specific test scenarios |
| ✅ Most tests (80%) | ✅ Edge cases (20%) |

**Example: Factory for most tests**
```typescript
test("creates book", async () => {
  const book = await BookFactory.create()
  expect(book.id).toBeDefined()
})
```

**Example: Builder for specific scenarios**
```typescript
test("handles books with ancient publication dates", () => {
  const book = new BookBuilder()
    .withTitle("The Epic of Gilgamesh")
    .withAuthor("Anonymous")
    .withISBN("978-0-140-44919-8")
    .publishedOn("-2100-01-01") // ~2100 BCE
    .build()

  expect(isValidPublicationDate(book.properties.publishedDate)).toBe(true)
})
```

---

## Advanced Factory Patterns

### **1. Traits (Named Configurations)**

```typescript
export class BookFactory {
  static build(overrides = {}) { /* ... */ }

  /**
   * Trait: Create a recently published book
   */
  static recentlyPublished(overrides = {}) {
    const lastYear = new Date()
    lastYear.setFullYear(lastYear.getFullYear() - 1)

    return BookFactory.build({
      publishedDate: faker.date.between({ from: lastYear, to: new Date() }).toISOString(),
      ...overrides
    })
  }

  /**
   * Trait: Create a classic book (pre-1950)
   */
  static classic(overrides = {}) {
    return BookFactory.build({
      publishedDate: faker.date.between({ from: "1800-01-01", to: "1950-01-01" }).toISOString(),
      ...overrides
    })
  }

  /**
   * Trait: Create a book with minimal metadata
   */
  static minimal(overrides = {}) {
    return BookFactory.build({
      publisher: undefined,
      pageCount: undefined,
      ...overrides
    })
  }
}

// Usage
test("searches recent books", async () => {
  await BookFactory.recentlyPublished().create()
  const books = await searchBooks({ publishedAfter: "2025-01-01" })
  expect(books).toHaveLength(1)
})
```

### **2. Sequences (Unique Values)**

```typescript
export class BookFactory {
  private static sequenceCounter = 0

  static build(overrides = {}) {
    const sequence = BookFactory.sequenceCounter++

    return {
      id: crypto.randomUUID(),
      type: "book",
      properties: {
        title: overrides.title ?? `Book ${sequence}`,
        author: overrides.author ?? `Author ${sequence}`,
        isbn: overrides.isbn ?? generateISBN(sequence),
        // ...
      }
    }
  }
}

// Usage: Guaranteed unique titles/authors
const books = BookFactory.buildList(100)
```

### **3. Associations (Related Entities)**

```typescript
export class BookFactory {
  static async withAuthor(authorOverrides = {}, bookOverrides = {}) {
    const author = await PersonFactory.create(authorOverrides)
    const book = await BookFactory.create({
      author: author.properties.name,
      ...bookOverrides
    })
    return { author, book }
  }

  static async withSeries(seriesOverrides = {}, bookOverrides = {}) {
    const series = await SeriesFactory.create(seriesOverrides)
    const book = await BookFactory.create({
      seriesId: series.id,
      ...bookOverrides
    })
    return { series, book }
  }
}

// Usage
test("retrieves books by author", async () => {
  const { author, book } = await BookFactory.withAuthor()

  const books = await repository.findByAuthor(author.properties.name)

  expect(books).toContain(book)
})
```

### **4. Transient Attributes (Computed Values)**

```typescript
export class BookFactory {
  static build(overrides = {}) {
    // Transient attribute: Use title to generate slug
    const title = overrides.title ?? faker.book.title()
    const slug = overrides.slug ?? title.toLowerCase().replace(/\s+/g, "-")

    return {
      id: crypto.randomUUID(),
      type: "book",
      properties: {
        title,
        slug,
        // ...
      }
    }
  }
}

// Usage
const book = BookFactory.build({ title: "The Hobbit" })
expect(book.properties.slug).toBe("the-hobbit")
```

---

## Event Factory Example

```typescript
// tests/factories/EventFactory.ts
import type { Event } from "@domains/types"

interface EventFactoryOptions {
  type?: string
  entityId?: string
  userId?: string
  action?: string
  data?: Record<string, unknown>
}

export class EventFactory {
  static build(overrides: EventFactoryOptions = {}): Event {
    return {
      id: crypto.randomUUID(),
      type: overrides.type ?? "book.created",
      entity_id: overrides.entityId ?? crypto.randomUUID(),
      user_id: overrides.userId ?? crypto.randomUUID(),
      action: overrides.action ?? "create",
      data: overrides.data ?? {},
      timestamp: new Date().toISOString()
    }
  }

  static async create(overrides: EventFactoryOptions = {}): Promise<Event> {
    const event = EventFactory.build(overrides)
    const repo = getDefaultTestEventRepository()
    return await repo.record(event)
  }

  /**
   * Trait: Create an audit event
   */
  static audit(overrides = {}) {
    return EventFactory.build({
      type: "audit.log",
      action: "access",
      ...overrides
    })
  }

  /**
   * Trait: Create an analytics event
   */
  static analytics(overrides = {}) {
    return EventFactory.build({
      type: "analytics.track",
      ...overrides
    })
  }
}
```

---

## User Factory Example

```typescript
// tests/factories/UserFactory.ts
import { hashPassword } from "@/utils/crypto"
import type { User } from "@domains/types"

interface UserFactoryOptions {
  email?: string
  password?: string
  name?: string
  role?: "owner" | "write" | "read"
}

export class UserFactory {
  static async build(overrides: UserFactoryOptions = {}): Promise<User> {
    const password = overrides.password ?? "password123"

    return {
      id: crypto.randomUUID(),
      email: overrides.email ?? faker.internet.email(),
      password_hash: await hashPassword(password),
      name: overrides.name ?? faker.person.fullName(),
      role: overrides.role ?? "read",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  static async create(overrides: UserFactoryOptions = {}): Promise<User> {
    const user = await UserFactory.build(overrides)
    const repo = getDefaultTestUserRepository()
    return await repo.create(user)
  }

  /**
   * Trait: Create an owner user
   */
  static async owner(overrides = {}) {
    return UserFactory.create({ role: "owner", ...overrides })
  }

  /**
   * Trait: Create a user with write permissions
   */
  static async writer(overrides = {}) {
    return UserFactory.create({ role: "write", ...overrides })
  }

  /**
   * Trait: Create a user with read-only permissions
   */
  static async reader(overrides = {}) {
    return UserFactory.create({ role: "read", ...overrides })
  }
}
```

---

## Factory Index (Barrel Export)

```typescript
// tests/factories/index.ts

export { BookFactory } from "./BookFactory"
export { PersonFactory } from "./PersonFactory"
export { SeriesFactory } from "./SeriesFactory"
export { UserFactory } from "./UserFactory"
export { EventFactory } from "./EventFactory"
export { EntityFactory } from "./EntityFactory"
```

**Usage:**
```typescript
import { BookFactory, UserFactory, EventFactory } from "@/tests/factories"

test("user creates a book", async () => {
  const user = await UserFactory.create()
  const book = await BookFactory.create({ userId: user.id })
  const event = await EventFactory.create({
    type: "book.created",
    entityId: book.id,
    userId: user.id
  })

  expect(event.data).toMatchObject({ bookId: book.id })
})
```

---

## Best Practices

### ✅ **Do:**

1. **Use realistic data** - Faker, real book titles, valid ISBNs
2. **Provide sensible defaults** - Most tests shouldn't need overrides
3. **Support overrides** - Allow customization when needed
4. **Separate build() and create()** - Build for in-memory, create for database
5. **Use traits for common scenarios** - `BookFactory.classic()`, `UserFactory.owner()`
6. **Document factory options** - TypeScript interfaces for overrides
7. **Keep factories simple** - Don't replicate business logic
8. **Use sequences for uniqueness** - Avoid random collisions

### ❌ **Don't:**

1. **Hard-code test data** - Use factories instead
2. **Duplicate business logic** - Factories create valid data, not enforce rules
3. **Create overly complex factories** - Keep them focused
4. **Share factory state between tests** - Each test gets fresh data
5. **Test factory internals** - Factories are helpers, not production code

---

## Next Steps

1. **Copy templates** from `tests/factories/` to your project
2. **Create factories** for your core domain entities
3. **Use factories in all tests** to reduce boilerplate
4. **Extract common patterns** into traits
5. **Document factory usage** in `tests/factories/README.md`

---

**Version:** 1.0.0
**Last Updated:** 2026-02-12
**Status:** ⭐️ Phase 0.2 - Testing Strategy & Infrastructure
