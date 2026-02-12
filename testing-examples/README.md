# Testing Examples: Phase 0.2 Reference

> **Purpose:** Comprehensive testing philosophy, patterns, and examples for establishing a best-in-class declarative testing approach for the QuailComp refactoring effort.

---

## 📚 Table of Contents

1. [**Testing Philosophy**](./00-TESTING-PHILOSOPHY.md) - Core principles and patterns
2. [**Factories and Builders**](./01-FACTORIES-AND-BUILDERS.md) - Test data generation
3. [**Property-Based Testing**](./02-PROPERTY-BASED-TESTING.md) - Automated edge case discovery
4. [**Beautiful Test Suites**](./03-BEAUTIFUL-TEST-SUITES.md) - Comprehensive examples
5. [**Utilities and Helpers**](./04-UTILITIES-AND-HELPERS.md) - Reusable test infrastructure

---

## 🎯 Quick Start

### **1. Read the Philosophy** (15 minutes)

Start with [00-TESTING-PHILOSOPHY.md](./00-TESTING-PHILOSOPHY.md) to understand:
- ✅ Tests as living documentation
- ✅ Declarative over imperative testing
- ✅ Test pyramid architecture
- ✅ Independence and isolation
- ✅ Coverage as a guide, not a goal

### **2. Set Up Factories** (30 minutes)

Read [01-FACTORIES-AND-BUILDERS.md](./01-FACTORIES-AND-BUILDERS.md) and create:
- `tests/factories/EntityFactory.ts`
- `tests/factories/UserFactory.ts`
- `tests/factories/BookFactory.ts`
- `tests/factories/index.ts` (barrel export)

### **3. Understand Property-Based Testing** (30 minutes)

Review [02-PROPERTY-BASED-TESTING.md](./02-PROPERTY-BASED-TESTING.md) for:
- ✅ When to use property-based testing
- ✅ Writing properties (invariants)
- ✅ Using fast-check arbitraries
- ✅ Custom arbitrary generators

### **4. Study Beautiful Examples** (45 minutes)

Explore [03-BEAUTIFUL-TEST-SUITES.md](./03-BEAUTIFUL-TEST-SUITES.md) to see:
- ✅ Fully refactored entity repository tests
- ✅ Authentication service tests
- ✅ Documentation generation from tests
- ✅ Coverage integration

### **5. Build Test Infrastructure** (1-2 hours)

Use [04-UTILITIES-AND-HELPERS.md](./04-UTILITIES-AND-HELPERS.md) to create:
- `tests/helpers/database.ts` - Database setup/teardown
- `tests/helpers/http.ts` - HTTP mocking
- `tests/helpers/matchers.ts` - Custom assertions
- `tests/helpers/assertions.ts` - Assertion helpers

---

## 🏗️ Recommended Directory Structure

```
tests/
├── README.md                          # Test organization guide
├── .test-conventions.md               # Testing standards and patterns
│
├── unit/                              # Pure functions, no I/O
│   ├── validators/
│   │   ├── isbn.test.ts
│   │   └── email.test.ts
│   ├── parsers/
│   │   └── date.test.ts
│   └── formatters/
│       └── slug.test.ts
│
├── integration/                       # Multiple modules + I/O
│   ├── data-layer/
│   │   ├── EntityRepository.test.ts
│   │   ├── EventRepository.test.ts
│   │   └── transactions.test.ts
│   ├── services/
│   │   ├── AuthenticationService.test.ts
│   │   ├── AuthorizationService.test.ts
│   │   └── MetadataService.test.ts
│   └── api/
│       ├── books-routes.test.ts
│       ├── auth-routes.test.ts
│       └── middleware.test.ts
│
├── e2e/                               # Full application flows
│   ├── auth-workflows.test.ts
│   ├── book-workflows.test.ts
│   └── analytics-workflows.test.ts
│
├── factories/                         # Test data factories
│   ├── index.ts                       # Barrel export
│   ├── EntityFactory.ts
│   ├── UserFactory.ts
│   ├── BookFactory.ts
│   ├── PersonFactory.ts
│   ├── SeriesFactory.ts
│   ├── EventFactory.ts
│   └── README.md
│
├── builders/                          # Fluent builders
│   ├── BookBuilder.ts
│   ├── RequestBuilder.ts
│   └── README.md
│
├── helpers/                           # Test utilities
│   ├── database.ts                    # DB setup/teardown
│   ├── http.ts                        # HTTP mocking
│   ├── matchers.ts                    # Custom matchers
│   ├── assertions.ts                  # Assertion helpers
│   ├── time.ts                        # Time control
│   ├── arbitraries.ts                 # Custom fast-check generators
│   └── README.md
│
├── fixtures/                          # Static test data
│   ├── books.json
│   ├── isbns.json
│   ├── metadata-responses.json
│   └── README.md
│
├── mocks/                             # Mock implementations
│   ├── MockUserRepository.ts
│   ├── MockEntityRepository.ts
│   └── README.md
│
└── templates/                         # Test file templates
    ├── unit-test.template.ts
    ├── integration-test.template.ts
    ├── e2e-test.template.ts
    └── README.md
```

---

## 🛠️ Essential Tools

### **Test Framework: Bun Test**

**Why Bun Test?**
- ✅ Built into Bun runtime (zero config)
- ✅ Fast execution
- ✅ Jest-compatible API
- ✅ Native TypeScript support
- ✅ Built-in coverage reporting

**Installation:**
```bash
# Already installed with Bun
bun --version
```

**Basic Usage:**
```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test"

describe("Feature", () => {
  test("behavior", () => {
    expect(true).toBe(true)
  })
})
```

### **Property-Based Testing: fast-check**

**Installation:**
```bash
bun add -d fast-check
```

**Basic Usage:**
```typescript
import fc from "fast-check"

test("property", () => {
  fc.assert(
    fc.property(
      fc.string(),
      (str) => {
        expect(normalize(str)).toBe(normalize(normalize(str)))
      }
    )
  )
})
```

### **Test Data: Faker.js (Optional)**

**Installation:**
```bash
bun add -d @faker-js/faker
```

**Basic Usage:**
```typescript
import { faker } from "@faker-js/faker"

const user = {
  name: faker.person.fullName(),
  email: faker.internet.email(),
  isbn: faker.commerce.isbn(13)
}
```

---

## 🎨 Code Examples

### **Example 1: Unit Test with Factory**

```typescript
import { describe, test, expect } from "bun:test"
import { normalizeEntityType } from "@/utils/entity"
import { EntityFactory } from "@/tests/factories"

describe("normalizeEntityType", () => {
  test("converts to lowercase", () => {
    const result = normalizeEntityType("BOOK")
    expect(result).toBe("book")
  })

  test("replaces spaces with underscores", () => {
    const result = normalizeEntityType("book series")
    expect(result).toBe("book_series")
  })

  test("handles entities from factory", () => {
    const entity = EntityFactory.build({ type: "Book Series" })
    expect(normalizeEntityType(entity.type)).toBe("book_series")
  })
})
```

### **Example 2: Integration Test with Database**

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { PostgresEntityRepository } from "@/data/client/EntityRepository"
import { EntityFactory } from "@/tests/factories"
import { createTestDatabase, closeTestDatabase } from "@/tests/helpers/database"

describe("EntityRepository", () => {
  let db, repository

  beforeAll(async () => {
    db = await createTestDatabase()
    repository = new PostgresEntityRepository(db)
  })

  afterAll(async () => {
    await closeTestDatabase(db)
  })

  test("creates entity", async () => {
    const entity = EntityFactory.build()
    const created = await repository.create(entity)

    expect(created.id).toBeDefined()
    expect(created.properties).toEqual(entity.properties)
  })
})
```

### **Example 3: Property-Based Test**

```typescript
import { test, expect } from "bun:test"
import fc from "fast-check"
import { validateISBN } from "@/validators/isbn"

test("validates all valid ISBNs", () => {
  fc.assert(
    fc.property(
      fc.isbn13(),
      (isbn) => {
        const result = validateISBN(isbn)
        expect(result.valid).toBe(true)
      }
    )
  )
})
```

### **Example 4: E2E Test**

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { UserFactory, BookFactory } from "@/tests/factories"
import { startTestServer, stopTestServer } from "@/tests/helpers/server"

describe("Book Creation Workflow", () => {
  let server, baseUrl

  beforeAll(async () => {
    server = await startTestServer()
    baseUrl = `http://localhost:${server.port}`
  })

  afterAll(async () => {
    await stopTestServer(server)
  })

  test("user can create and retrieve a book", async () => {
    // Register user
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
        name: "Test User"
      })
    })
    expect(registerResponse.status).toBe(201)

    // Login
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123"
      })
    })
    const { accessToken } = await loginResponse.json()

    // Create book
    const createResponse = await fetch(`${baseUrl}/api/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        title: "Test Book",
        author: "Test Author",
        isbn: "978-0-123456-47-2"
      })
    })
    expect(createResponse.status).toBe(201)
    const book = await createResponse.json()

    // Retrieve book
    const getResponse = await fetch(`${baseUrl}/api/books/${book.id}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    })
    expect(getResponse.status).toBe(200)
    const retrieved = await getResponse.json()

    expect(retrieved.properties.title).toBe("Test Book")
  })
})
```

---

## 📊 Coverage

### **Running Tests with Coverage**

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/unit/validators/isbn.test.ts

# Run tests in watch mode
bun test --watch

# Generate HTML coverage report
bun test --coverage --coverage-reporter=html

# Open coverage report
open coverage/index.html
```

### **Coverage Configuration** (bunfig.toml)

```toml
[test]
coverage = false                    # Disabled by default (faster)
coverageReporter = "text"           # text, html, lcov
coverageDir = "coverage"            # Output directory
coverageThreshold = 0.90            # 90% minimum coverage

# Exclude from coverage
coveragePathIgnorePatterns = [
  "**/node_modules/**",
  "**/dist/**",
  "**/*.test.ts",
  "**/scripts/**",
  "**/migrations/**",
  "frontend/**",                    # Frontend uses Vitest
  "domains/types/**"                # Auto-generated files
]
```

---

## 🚀 Running Tests

### **Common Commands**

```bash
# Run all tests
bun test

# Run tests in specific directory
bun test tests/unit/

# Run tests matching pattern
bun test --test-name-pattern "ISBN"

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch

# Bail on first failure
bun test --bail

# Run tests in parallel
bun test --concurrent

# Set timeout (milliseconds)
bun test --timeout 5000
```

### **Test Scripts** (package.json)

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "test:coverage:html": "bun test --coverage --coverage-reporter=html",
    "test:coverage:view": "bun test --coverage --coverage-reporter=html && open coverage/index.html",
    "test:unit": "bun test tests/unit/",
    "test:integration": "bun test tests/integration/",
    "test:e2e": "bun test tests/e2e/"
  }
}
```

---

## 📋 Checklist for Phase 0.2

### **Infrastructure Setup** ✅

- [ ] Create `tests/` directory structure
- [ ] Set up factories in `tests/factories/`
- [ ] Create helpers in `tests/helpers/`
- [ ] Add fixtures in `tests/fixtures/`
- [ ] Configure coverage in `bunfig.toml`
- [ ] Add test scripts to `package.json`

### **Documentation** ✅

- [ ] Review all testing philosophy documents
- [ ] Create `tests/README.md` with organization guide
- [ ] Document testing conventions in `tests/.test-conventions.md`
- [ ] Create test templates in `tests/templates/`

### **Tools & Dependencies** ✅

- [ ] Install fast-check: `bun add -d fast-check`
- [ ] Install @faker-js/faker: `bun add -d @faker-js/faker` (optional)
- [ ] Verify Bun test works: `bun test`

### **First Tests** ✅

- [ ] Write first unit test (e.g., ISBN validator)
- [ ] Write first integration test (e.g., entity repository)
- [ ] Write first property-based test (e.g., normalization)
- [ ] Generate coverage report
- [ ] Document discoveries in refactoring journal

---

## 🎓 Learning Path

### **Week 1: Foundations**
1. Read testing philosophy
2. Set up directory structure
3. Create first factory
4. Write first unit tests

### **Week 2: Integration**
1. Set up database helpers
2. Write integration tests for data layer
3. Create custom matchers
4. Practice test-driven development

### **Week 3: Advanced Patterns**
1. Learn property-based testing
2. Write custom arbitraries
3. Create builder patterns
4. Document test patterns

### **Week 4: E2E & Coverage**
1. Write end-to-end tests
2. Set up coverage reporting
3. Generate documentation from tests
4. Refine and iterate

---

## 🔗 External Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [fast-check Documentation](https://fast-check.dev/)
- [Test Pyramid by Martin Fowler](https://martinfowler.com/bliki/TestPyramid.html)
- [Property-Based Testing Guide](https://fsharpforfunandprofit.com/posts/property-based-testing/)
- [Growing Object-Oriented Software, Guided by Tests](http://www.growing-object-oriented-software.com/)

---

## 📝 Next Steps

1. ✅ **Read all documentation** in `testing-examples/`
2. ✅ **Set up directory structure** following the recommended layout
3. ✅ **Create factories** for your core domain entities
4. ✅ **Write your first tests** using the patterns shown
5. ✅ **Generate coverage reports** to track progress
6. ✅ **Document learnings** in your refactoring journal

---

## 🙋 Questions?

As you work through Phase 0.2, document any questions or insights in:
- `docs/refactor-journal.md` - Daily learnings
- `docs/decision-log.md` - Architectural decisions
- `docs/.quick-capture.md` - Quick notes

---

**Version:** 1.0.0
**Last Updated:** 2026-02-12
**Status:** ⭐️ Phase 0.2 - Testing Strategy & Infrastructure
**Author:** Claude Sonnet 4.5 (with human guidance)

---

## 🎯 Summary

This testing examples directory provides:

1. **📖 Philosophy** - Clear principles for testing
2. **🏭 Factories** - Test data generation patterns
3. **🔬 Property-Based Testing** - Automated edge case discovery
4. **💎 Beautiful Examples** - Comprehensive, real-world test suites
5. **🛠️ Utilities** - Reusable test infrastructure
6. **📚 Documentation** - Living docs from tests

**Goal:** Establish a best-in-class declarative testing approach that makes tests:
- ✅ Easy to read (tests as documentation)
- ✅ Easy to write (factories and helpers)
- ✅ Comprehensive (unit + integration + property-based + E2E)
- ✅ Maintainable (DRY, focused, independent)
- ✅ Fast (proper test pyramid, mocking)

**Use these examples as a reference** as you build out your test suite during the refactoring effort. Happy testing! 🚀
