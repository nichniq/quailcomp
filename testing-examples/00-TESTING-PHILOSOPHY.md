# QuailComp Testing Philosophy

> **Purpose:** Establish a best-in-class declarative testing approach for the Phase 0.2 refactoring effort. This document defines our testing principles, patterns, and practices.

---

## Core Testing Principles

### 1. **Tests as Living Documentation**

Tests are not just validation—they're **executable specifications** that document how the system works.

**Guidelines:**
- Test names should read like sentences explaining behavior
- Tests should be understandable by someone new to the codebase
- Each test tells a story: Given → When → Then
- Comments explain "why," code shows "what"

**Example:**
```typescript
// ❌ Bad: Unclear what's being tested
test("entity validation", () => { ... })

// ✅ Good: Reads like documentation
test("createEntity rejects entities with missing required fields", () => { ... })
test("createEntity accepts entities with all valid properties", () => { ... })
test("createEntity normalizes entity type names to lowercase", () => { ... })
```

---

### 2. **Declarative Over Imperative**

Write tests that declare **what should happen**, not step-by-step **how to test it**.

**Guidelines:**
- Use factories and builders to create test data
- Extract common patterns into helpers
- Keep tests focused on the behavior being tested
- Hide setup complexity behind descriptive abstractions

**Example:**
```typescript
// ❌ Imperative: Shows all the mechanics
test("user can create a book", async () => {
  const db = await connectToDatabase({ url: process.env.DB_URL })
  const user = {
    id: crypto.randomUUID(),
    email: "test@example.com",
    password: await hashPassword("password123"),
    created_at: new Date().toISOString()
  }
  await db.insert("users", user)
  const book = {
    id: crypto.randomUUID(),
    title: "Test Book",
    author_id: user.id,
    isbn: "978-0-123456-47-2",
    created_at: new Date().toISOString()
  }
  const result = await createBook(book)
  expect(result.id).toBeDefined()
})

// ✅ Declarative: Focuses on what matters
test("user can create a book", async () => {
  const user = await UserFactory.create()
  const book = await BookFactory.create({ authorId: user.id })

  expect(book).toMatchObject({
    title: expect.any(String),
    authorId: user.id,
    isbn: expect.stringMatching(/^978-/)
  })
})
```

---

### 3. **Property-Based Testing for Validation**

Use property-based testing (via `fast-check`) to validate invariants across many generated inputs.

**When to use:**
- Parsers and validators
- Data transformations
- Serialization/deserialization
- Business rule enforcement
- Edge case discovery

**Guidelines:**
- Define properties (invariants) that must always hold
- Let the library generate test cases
- Shrink failing cases to minimal examples
- Document discovered edge cases

**Example:**
```typescript
import fc from "fast-check"

// Property: ISBN validation should accept all valid ISBN-13 formats
test("ISBN validator accepts all valid ISBN-13 formats", () => {
  fc.assert(
    fc.property(
      fc.isbn13(), // Generates valid ISBN-13 strings
      (isbn) => {
        expect(validateISBN(isbn)).toBe(true)
      }
    )
  )
})

// Property: Entity type normalization is idempotent
test("normalizeEntityType is idempotent", () => {
  fc.assert(
    fc.property(
      fc.string().filter(s => s.length > 0),
      (type) => {
        const normalized = normalizeEntityType(type)
        const doubleNormalized = normalizeEntityType(normalized)
        expect(normalized).toBe(doubleNormalized)
      }
    )
  )
})
```

---

### 4. **Test Independence and Isolation**

Each test should run independently without relying on other tests or shared state.

**Guidelines:**
- No test execution order dependencies
- Clean up resources in `afterEach()` or use unique identifiers
- Use test-specific database namespaces or unique entity types
- Mock external dependencies
- Use factories for fresh test data

**Example:**
```typescript
describe("EntityRepository", () => {
  let repository: EntityRepository
  let testEntityType: string

  beforeEach(async () => {
    // Each test gets its own entity type namespace
    testEntityType = `test_entity_${Date.now()}_${Math.random()}`
    repository = await createTestRepository()
  })

  afterEach(async () => {
    // Clean up test data
    await repository.deleteByType(testEntityType)
  })

  test("creates entity", async () => {
    const entity = EntityFactory.build({ type: testEntityType })
    const result = await repository.create(entity)
    expect(result.id).toBeDefined()
  })

  test("retrieves entity by id", async () => {
    const entity = await EntityFactory.create({ type: testEntityType })
    const retrieved = await repository.getById(entity.id)
    expect(retrieved).toEqual(entity)
  })
})
```

---

### 5. **Test Pyramid Architecture**

Balance test types for speed, coverage, and confidence:

```
        /\
       /  \  E2E Tests (5-10%)
      /____\
     /      \
    / Integ  \ Integration Tests (20-30%)
   /__________\
  /            \
 /    Unit      \ Unit Tests (60-75%)
/________________\
```

**Unit Tests (60-75% of tests):**
- Pure functions
- Business logic
- Validators, parsers, formatters
- Isolated modules
- **Fast:** < 1ms per test
- **No I/O:** No database, network, filesystem

**Integration Tests (20-30% of tests):**
- Multiple modules working together
- Database operations
- API endpoints (without full server)
- Service layer interactions
- **Medium:** < 100ms per test
- **Limited I/O:** Test database, mocked external APIs

**E2E Tests (5-10% of tests):**
- Critical user workflows
- Full stack (client → server → database)
- Authentication flows
- Data consistency across layers
- **Slow:** < 5s per test
- **Full I/O:** Real services (in test mode)

---

### 6. **Fail Fast, Fail Clear**

When tests fail, they should immediately pinpoint the problem.

**Guidelines:**
- Descriptive error messages
- Show expected vs. actual values
- Include context about the failing scenario
- Use custom matchers for domain objects
- Fail at the first assertion (not all of them)

**Example:**
```typescript
// ❌ Bad: Unclear failure message
test("validates book", () => {
  const book = createBook()
  expect(isValid(book)).toBe(true)
})
// Error: Expected false to be true ❌

// ✅ Good: Clear failure with context
test("validates book with required fields", () => {
  const book = BookFactory.build({ title: "Test", isbn: "978-0-123456-47-2" })

  const validation = validateBook(book)

  expect(validation).toMatchObject({
    valid: true,
    errors: []
  })
})
// Error: Expected { valid: false, errors: ['ISBN checksum invalid'] }
//        to match { valid: true, errors: [] } ✅
```

---

### 7. **Coverage as a Guide, Not a Goal**

Code coverage is a **diagnostic tool**, not a target to hit.

**Philosophy:**
- 100% coverage ≠ good tests
- Focus on **behavior coverage** (are all important behaviors tested?)
- Use coverage to find **untested code paths**
- Don't write tests just to hit coverage numbers
- Prioritize **critical paths** over edge cases in low-risk code

**Coverage Guidelines:**
- **Core business logic:** 90-100% coverage (high value)
- **Data access layer:** 80-90% coverage (moderate value)
- **API routes:** 70-80% coverage (focus on happy paths + auth)
- **UI components:** 60-70% coverage (critical flows + interactions)
- **Configuration/setup:** 40-50% coverage (smoke tests)

**What to exclude:**
- Generated code (domain types from markdown)
- Migration files
- Scripts and dev tools
- Third-party code

---

### 8. **Test Data Management**

Create realistic, maintainable test data using **factories**, **builders**, and **fixtures**.

**Factories** - Generate dynamic test data:
```typescript
// Generates fresh entities with sensible defaults
const user = UserFactory.create()
const book = BookFactory.create({ authorId: user.id })
```

**Builders** - Customize test data fluently:
```typescript
const book = new BookBuilder()
  .withTitle("The Hobbit")
  .withISBN("978-0-547-92822-7")
  .withAuthor("J.R.R. Tolkien")
  .build()
```

**Fixtures** - Static, reusable test data:
```typescript
// fixtures/books.json
[
  { "title": "1984", "author": "George Orwell", "isbn": "978-0-452-28423-4" },
  { "title": "Dune", "author": "Frank Herbert", "isbn": "978-0-441-17271-9" }
]
```

**Guidelines:**
- Factories for dynamic data (entities, users, events)
- Builders for complex test scenarios
- Fixtures for static data (sample ISBNs, metadata responses)
- Use realistic data (real book titles, valid ISBNs, plausible dates)
- Avoid magic values (use constants or factories)

---

## Testing Patterns by Layer

### **Layer 0: Configuration & Build System**

**What to test:**
- Workspace dependencies are correct
- TypeScript configuration is valid
- Build scripts execute successfully
- Path aliases resolve correctly

**Approach:** Infrastructure tests (smoke tests)

---

### **Layer 1: Domain System**

**What to test:**
- Type extraction from markdown
- Generated types are valid TypeScript
- Cross-domain references resolve
- Documentation quality (links, examples)

**Approach:** Integration tests (parser + generator)

---

### **Layer 2: Core Utilities**

**What to test:**
- Logging (structured logs, levels, context)
- Error handling (error hierarchy, serialization)
- Metrics (counters, histograms, aggregation)

**Approach:** Unit tests (pure functions, mocks for I/O)

---

### **Layer 3: Data Layer**

**What to test:**
- Database connection lifecycle
- Entity CRUD operations
- Event recording (append-only)
- Transaction handling
- Concurrent access patterns
- Migration execution

**Approach:** Integration tests (real test database)

---

### **Layer 4: Business Services**

**What to test:**
- Authentication flows (login, token validation)
- Authorization checks (permission levels)
- Analytics event recording
- Metadata aggregation from providers

**Approach:** Integration tests (database + mocked external APIs)

---

### **Layer 5: API Layer**

**What to test:**
- Route matching
- Middleware composition
- Request/response handling
- Error responses
- WebSocket communication

**Approach:** Integration tests (without full server) + E2E tests (critical flows)

---

### **Layer 6: Applications**

**Frontend:**
- Component rendering
- Store mutations
- API client
- Routing

**CLI:**
- Command parsing
- Output formatting
- Database access

**DevTools:**
- File watching
- Task execution

**Approach:** Component tests + E2E tests (critical user flows)

---

## Test Organization Structure

```
tests/
├── README.md                      # Test organization guide
├── .test-conventions.md           # Testing standards
│
├── unit/                          # Pure functions, no I/O
│   ├── validators/
│   ├── parsers/
│   ├── formatters/
│   └── business-logic/
│
├── integration/                   # Multiple modules + I/O
│   ├── data-layer/
│   ├── services/
│   └── api/
│
├── e2e/                           # Full application flows
│   ├── auth-workflows.test.ts
│   ├── book-workflows.test.ts
│   └── analytics-workflows.test.ts
│
├── factories/                     # Test data factories
│   ├── index.ts                   # Export all factories
│   ├── UserFactory.ts
│   ├── BookFactory.ts
│   ├── EntityFactory.ts
│   ├── EventFactory.ts
│   └── README.md                  # Factory usage guide
│
├── builders/                      # Fluent test builders
│   ├── BookBuilder.ts
│   ├── RequestBuilder.ts
│   └── README.md
│
├── helpers/                       # Test utilities
│   ├── database.ts                # DB setup/teardown
│   ├── http.ts                    # Mock HTTP utilities
│   ├── assertions.ts              # Custom matchers
│   ├── matchers.ts                # Domain-specific matchers
│   └── README.md
│
├── fixtures/                      # Static test data
│   ├── books.json
│   ├── isbns.json
│   ├── metadata-responses.json
│   └── README.md
│
└── templates/                     # Test file templates
    ├── unit-test.template.ts
    ├── integration-test.template.ts
    ├── e2e-test.template.ts
    └── README.md
```

---

## Testing Workflow

### 1. **Before Writing Code**

Write a **specification test** that describes the expected behavior:

```typescript
test.todo("createBook rejects books with invalid ISBNs")
test.todo("createBook normalizes author names to title case")
test.todo("createBook generates unique IDs for new books")
```

### 2. **While Writing Code**

Implement tests alongside code:

```typescript
test("createBook rejects books with invalid ISBNs", async () => {
  const book = BookFactory.build({ isbn: "invalid-isbn" })

  await expect(createBook(book)).rejects.toThrow("Invalid ISBN")
})
```

### 3. **After Writing Code**

Run the full test suite:

```bash
bun test                          # Run all tests
bun test --coverage               # Generate coverage report
bun test --watch                  # Watch mode
```

### 4. **Before Committing**

Ensure all tests pass and coverage meets thresholds:

```bash
bun run test:coverage:generate    # Full coverage pipeline
bun run coverage:view             # View HTML report
```

---

## Best Practices

### ✅ **Do:**

1. **Write tests first** (or alongside code)
2. **Use descriptive test names** that explain behavior
3. **Keep tests focused** on a single behavior
4. **Use factories** for test data
5. **Mock external dependencies** (APIs, filesystem, time)
6. **Clean up resources** in `afterEach()`
7. **Test edge cases** (empty arrays, null values, boundary conditions)
8. **Use property-based testing** for validators and parsers
9. **Document complex test scenarios** with comments
10. **Run tests before committing**

### ❌ **Don't:**

1. **Write tests just for coverage**
2. **Test implementation details** (test behavior, not internals)
3. **Share state between tests**
4. **Use hard-coded IDs or dates** (use factories)
5. **Test third-party code** (mock it instead)
6. **Write flaky tests** (non-deterministic, timing-dependent)
7. **Ignore failing tests** (fix or mark as `.todo`)
8. **Test everything** (focus on critical paths and business logic)
9. **Over-mock** (prefer real implementations when fast)
10. **Commit with failing tests**

---

## Tools & Libraries

### **Test Frameworks:**
- **Bun Test** (recommended) - Built-in, fast, zero-config
- **Vitest** (frontend only) - Modern, Vite-powered

### **Property-Based Testing:**
- **fast-check** - Generate test cases automatically

### **Mocking:**
- `mock()` (Bun test) - Function mocking
- `vi.mock()` (Vitest) - Module mocking
- `vi.spyOn()` (Vitest) - Object method spying

### **Test Data:**
- Custom factories (see `tests/factories/`)
- Custom builders (see `tests/builders/`)
- JSON fixtures (see `tests/fixtures/`)

### **Coverage:**
- Built-in coverage (Bun test)
- LCOV format for merging reports
- HTML reports for visualization

---

## Next Steps

1. **Read:** Review example test files in `testing-examples/`
2. **Practice:** Write tests using the templates in `tests/templates/`
3. **Refine:** Adapt patterns to your specific needs
4. **Document:** Update this guide as you discover new patterns

---

## References

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [Test Pyramid by Martin Fowler](https://martinfowler.com/bliki/TestPyramid.html)
- [Property-Based Testing Guide](https://fsharpforfunandprofit.com/posts/property-based-testing/)

---

**Version:** 1.0.0
**Last Updated:** 2026-02-12
**Status:** ⭐️ Phase 0.2 - Testing Strategy & Infrastructure
