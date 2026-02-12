# Property-Based Testing with fast-check

> **Purpose:** Discover edge cases automatically by testing properties that should hold true for all inputs, not just specific examples.

---

## What is Property-Based Testing?

**Traditional Example-Based Testing:**
```typescript
test("ISBN validator accepts valid ISBNs", () => {
  expect(validateISBN("978-0-123456-47-2")).toBe(true)
  expect(validateISBN("978-0-134685-99-1")).toBe(true)
  expect(validateISBN("978-1-234567-89-0")).toBe(true)
  // What about the other 999,999,999,999,997 possible ISBNs?
})
```

**Property-Based Testing:**
```typescript
import fc from "fast-check"

test("ISBN validator accepts all valid ISBN-13 formats", () => {
  fc.assert(
    fc.property(
      fc.isbn13(), // Generates thousands of valid ISBNs
      (isbn) => {
        expect(validateISBN(isbn)).toBe(true)
      }
    )
  )
})
```

**Benefits:**
- ✅ Automatically generates thousands of test cases
- ✅ Discovers edge cases you wouldn't think of
- ✅ Shrinks failing inputs to minimal examples
- ✅ Documents invariants (properties that must always hold)
- ✅ Catches subtle bugs in validation, parsing, transformation logic

---

## Core Concepts

### **1. Properties (Invariants)**

A **property** is a statement that should be true for **all valid inputs**.

**Examples:**
- "Reversing a list twice returns the original list"
- "Parsing and then formatting a date returns the same date"
- "ISBN checksum calculation is deterministic"
- "Normalized entity types are always lowercase"
- "JSON serialization round-trips preserve data"

### **2. Arbitraries (Input Generators)**

An **arbitrary** generates random values of a specific type.

**Built-in arbitraries:**
```typescript
import fc from "fast-check"

fc.integer()                    // Random integers
fc.string()                     // Random strings
fc.boolean()                    // true or false
fc.array(fc.integer())          // Arrays of integers
fc.record({ name: fc.string(), age: fc.integer() }) // Objects
fc.date()                       // Random dates
fc.emailAddress()               // Valid email addresses
fc.uuid()                       // UUID v4 strings
```

### **3. Shrinking (Minimal Failing Examples)**

When a property fails, fast-check **shrinks** the input to the **simplest failing case**.

**Example:**
```typescript
// Property: All strings should be non-empty after trimming
fc.assert(
  fc.property(
    fc.string(),
    (str) => str.trim().length > 0
  )
)

// Original failing input: "    \n\t   " (lots of whitespace)
// Shrunk to: "" (empty string) ✅ Minimal example
```

---

## When to Use Property-Based Testing

### ✅ **Perfect for:**

1. **Validators and Parsers**
   - ISBN validation
   - Date parsing
   - URL validation
   - Entity type normalization

2. **Data Transformations**
   - Serialization/deserialization
   - Encoding/decoding
   - Format conversions

3. **Business Rules**
   - Access control (permissions)
   - Pricing calculations
   - Invariant enforcement

4. **Round-Trip Properties**
   - `parse(format(x)) === x`
   - `decode(encode(x)) === x`
   - `normalize(normalize(x)) === normalize(x)` (idempotence)

5. **Mathematical Properties**
   - Commutativity: `f(a, b) === f(b, a)`
   - Associativity: `f(f(a, b), c) === f(a, f(b, c))`
   - Identity: `f(x, identity) === x`

### ❌ **Not ideal for:**

1. **UI interactions** (too non-deterministic)
2. **External API calls** (requires mocking)
3. **Database operations** (use integration tests instead)
4. **Time-dependent logic** (hard to make deterministic)
5. **Specific business scenarios** (use example-based tests)

---

## Example 1: ISBN Validation

### **Property: Valid ISBNs are always accepted**

```typescript
import fc from "fast-check"
import { validateISBN } from "@/validators/isbn"

describe("ISBN Validation (Property-Based)", () => {
  test("accepts all valid ISBN-13 formats", () => {
    fc.assert(
      fc.property(
        fc.isbn13(), // Generates valid ISBN-13 strings
        (isbn) => {
          const result = validateISBN(isbn)
          expect(result.valid).toBe(true)
          expect(result.errors).toHaveLength(0)
        }
      )
    )
  })

  test("accepts ISBN-13 with various separators", () => {
    fc.assert(
      fc.property(
        fc.isbn13(),
        fc.constantFrom("-", " ", ""), // Different separators
        (isbn, separator) => {
          // Remove hyphens and add custom separator
          const formatted = isbn.replace(/-/g, "").match(/.{1,3}/g)!.join(separator)
          const result = validateISBN(formatted)

          expect(result.valid).toBe(true)
        }
      )
    )
  })

  test("rejects strings with invalid checksums", () => {
    fc.assert(
      fc.property(
        fc.isbn13(),
        (isbn) => {
          // Corrupt the checksum digit
          const corrupted = isbn.slice(0, -1) + ((parseInt(isbn.slice(-1)) + 1) % 10)
          const result = validateISBN(corrupted)

          expect(result.valid).toBe(false)
          expect(result.errors).toContain("Invalid checksum")
        }
      )
    )
  })

  test("handles ISBN-10 format", () => {
    fc.assert(
      fc.property(
        fc.isbn10(),
        (isbn) => {
          const result = validateISBN(isbn)
          expect(result.valid).toBe(true)
        }
      )
    )
  })
})
```

---

## Example 2: Entity Type Normalization

### **Property: Normalization is idempotent**

```typescript
import fc from "fast-check"
import { normalizeEntityType } from "@/utils/entity"

describe("Entity Type Normalization (Property-Based)", () => {
  test("normalization is idempotent", () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s.length > 0), // Non-empty strings
        (type) => {
          const normalized = normalizeEntityType(type)
          const doubleNormalized = normalizeEntityType(normalized)

          expect(normalized).toBe(doubleNormalized)
        }
      )
    )
  })

  test("normalized types are always lowercase", () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s.length > 0),
        (type) => {
          const normalized = normalizeEntityType(type)

          expect(normalized).toBe(normalized.toLowerCase())
        }
      )
    )
  })

  test("normalized types have no leading/trailing whitespace", () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s.trim().length > 0),
        (type) => {
          const normalized = normalizeEntityType(type)

          expect(normalized).toBe(normalized.trim())
        }
      )
    )
  })

  test("normalized types replace spaces with underscores", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string().filter(s => s.length > 0), { minLength: 1, maxLength: 5 }),
        (parts) => {
          const type = parts.join(" ") // "book series", "user profile"
          const normalized = normalizeEntityType(type)

          expect(normalized).not.toContain(" ")
          expect(normalized).toContain("_")
        }
      )
    )
  })

  test("preserves alphanumeric characters", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_]+$/), // Only alphanumeric + underscore
        (type) => {
          const normalized = normalizeEntityType(type)

          // Should only contain lowercase alphanumeric and underscores
          expect(normalized).toMatch(/^[a-z0-9_]+$/)
        }
      )
    )
  })
})
```

---

## Example 3: Date Formatting Round-Trip

### **Property: Formatting and parsing are inverses**

```typescript
import fc from "fast-check"
import { formatDate, parseDate } from "@/utils/date"

describe("Date Formatting (Property-Based)", () => {
  test("formatting and parsing are inverses", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1900-01-01"), max: new Date("2100-12-31") }),
        (date) => {
          const formatted = formatDate(date) // "2024-01-15"
          const parsed = parseDate(formatted)

          expect(parsed.toISOString().split("T")[0]).toBe(
            date.toISOString().split("T")[0]
          )
        }
      )
    )
  })

  test("formatted dates are always ISO 8601", () => {
    fc.assert(
      fc.property(
        fc.date(),
        (date) => {
          const formatted = formatDate(date)

          expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
      )
    )
  })

  test("handles edge case dates", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new Date("1970-01-01")), // Unix epoch
          fc.constant(new Date("2038-01-19")), // 32-bit overflow
          fc.constant(new Date("1900-01-01")), // Very old date
          fc.constant(new Date("2099-12-31"))  // Far future
        ),
        (date) => {
          const formatted = formatDate(date)
          const parsed = parseDate(formatted)

          expect(parsed).toBeInstanceOf(Date)
          expect(parsed.getTime()).toBeGreaterThan(0)
        }
      )
    )
  })
})
```

---

## Example 4: JSON Serialization

### **Property: Serialization round-trips preserve data**

```typescript
import fc from "fast-check"
import { serializeEntity, deserializeEntity } from "@/utils/serialization"

describe("Entity Serialization (Property-Based)", () => {
  // Custom arbitrary for entities
  const entityArbitrary = fc.record({
    id: fc.uuid(),
    type: fc.constantFrom("book", "person", "series"),
    properties: fc.dictionary(
      fc.string().filter(s => s.length > 0),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
    ),
    metadata: fc.record({
      created_at: fc.date().map(d => d.toISOString()),
      updated_at: fc.date().map(d => d.toISOString()),
      version: fc.integer({ min: 1 })
    })
  })

  test("serialization round-trip preserves entities", () => {
    fc.assert(
      fc.property(
        entityArbitrary,
        (entity) => {
          const serialized = serializeEntity(entity)
          const deserialized = deserializeEntity(serialized)

          expect(deserialized).toEqual(entity)
        }
      )
    )
  })

  test("serialized entities are valid JSON", () => {
    fc.assert(
      fc.property(
        entityArbitrary,
        (entity) => {
          const serialized = serializeEntity(entity)

          expect(() => JSON.parse(serialized)).not.toThrow()
        }
      )
    )
  })

  test("handles entities with nested objects", () => {
    const nestedArbitrary = fc.record({
      id: fc.uuid(),
      type: fc.string(),
      properties: fc.record({
        author: fc.record({
          name: fc.string(),
          birth_year: fc.integer({ min: 1800, max: 2024 })
        }),
        metadata: fc.array(fc.string())
      })
    })

    fc.assert(
      fc.property(
        nestedArbitrary,
        (entity) => {
          const serialized = serializeEntity(entity)
          const deserialized = deserializeEntity(serialized)

          expect(deserialized.properties.author.name).toBe(entity.properties.author.name)
          expect(deserialized.properties.metadata).toEqual(entity.properties.metadata)
        }
      )
    )
  })
})
```

---

## Example 5: Access Control

### **Property: Permission checks are consistent**

```typescript
import fc from "fast-check"
import { checkPermission, Permission } from "@/services/authz"

describe("Access Control (Property-Based)", () => {
  const userArbitrary = fc.record({
    id: fc.uuid(),
    role: fc.constantFrom("owner", "write", "read")
  })

  const resourceArbitrary = fc.record({
    id: fc.uuid(),
    owner_id: fc.uuid()
  })

  test("owners always have full access", () => {
    fc.assert(
      fc.property(
        resourceArbitrary,
        fc.constantFrom(Permission.READ, Permission.WRITE, Permission.DELETE),
        (resource, permission) => {
          const owner = { id: resource.owner_id, role: "owner" as const }

          const result = checkPermission(owner, resource, permission)

          expect(result.allowed).toBe(true)
        }
      )
    )
  })

  test("read-only users cannot write or delete", () => {
    fc.assert(
      fc.property(
        userArbitrary.filter(u => u.role === "read"),
        resourceArbitrary,
        fc.constantFrom(Permission.WRITE, Permission.DELETE),
        (user, resource, permission) => {
          const result = checkPermission(user, resource, permission)

          expect(result.allowed).toBe(false)
        }
      )
    )
  })

  test("permission hierarchy is transitive", () => {
    // If user can delete, they can write and read
    fc.assert(
      fc.property(
        userArbitrary,
        resourceArbitrary,
        (user, resource) => {
          const canDelete = checkPermission(user, resource, Permission.DELETE)

          if (canDelete.allowed) {
            const canWrite = checkPermission(user, resource, Permission.WRITE)
            const canRead = checkPermission(user, resource, Permission.READ)

            expect(canWrite.allowed).toBe(true)
            expect(canRead.allowed).toBe(true)
          }
        }
      )
    )
  })

  test("denying access is idempotent", () => {
    fc.assert(
      fc.property(
        userArbitrary.filter(u => u.role === "read"),
        resourceArbitrary,
        (user, resource) => {
          const result1 = checkPermission(user, resource, Permission.WRITE)
          const result2 = checkPermission(user, resource, Permission.WRITE)

          expect(result1).toEqual(result2)
        }
      )
    )
  })
})
```

---

## Example 6: URL Slug Generation

### **Property: Slugs are URL-safe**

```typescript
import fc from "fast-check"
import { generateSlug } from "@/utils/slug"

describe("Slug Generation (Property-Based)", () => {
  test("slugs only contain URL-safe characters", () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const slug = generateSlug(input)

          // URL-safe: lowercase letters, numbers, hyphens
          expect(slug).toMatch(/^[a-z0-9-]*$/)
        }
      )
    )
  })

  test("slugs have no consecutive hyphens", () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const slug = generateSlug(input)

          expect(slug).not.toContain("--")
        }
      )
    )
  })

  test("slugs have no leading or trailing hyphens", () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const slug = generateSlug(input)

          if (slug.length > 0) {
            expect(slug[0]).not.toBe("-")
            expect(slug[slug.length - 1]).not.toBe("-")
          }
        }
      )
    )
  })

  test("slug generation is deterministic", () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const slug1 = generateSlug(input)
          const slug2 = generateSlug(input)

          expect(slug1).toBe(slug2)
        }
      )
    )
  })

  test("different inputs produce different slugs", () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s.trim().length > 0),
        fc.string().filter(s => s.trim().length > 0),
        (input1, input2) => {
          fc.pre(input1.toLowerCase() !== input2.toLowerCase()) // Skip if same

          const slug1 = generateSlug(input1)
          const slug2 = generateSlug(input2)

          expect(slug1).not.toBe(slug2)
        }
      )
    )
  })
})
```

---

## Custom Arbitraries

### **Creating Domain-Specific Generators**

```typescript
import fc from "fast-check"

/**
 * Arbitrary for valid ISBN-13 strings
 */
export const isbn13Arbitrary = (): fc.Arbitrary<string> => {
  return fc.integer({ min: 0, max: 9999999999 }).map((num) => {
    const prefix = "978"
    const body = num.toString().padStart(9, "0")
    const checksum = calculateISBN13Checksum(prefix + body)
    return `${prefix}-${body.slice(0, 1)}-${body.slice(1, 7)}-${body.slice(7, 9)}-${checksum}`
  })
}

/**
 * Arbitrary for valid email addresses
 */
export const emailArbitrary = (): fc.Arbitrary<string> => {
  return fc.record({
    local: fc.stringMatching(/^[a-z0-9._%+-]+$/),
    domain: fc.stringMatching(/^[a-z0-9.-]+$/),
    tld: fc.constantFrom("com", "org", "net", "edu", "io")
  }).map(({ local, domain, tld }) => `${local}@${domain}.${tld}`)
}

/**
 * Arbitrary for valid book entities
 */
export const bookEntityArbitrary = (): fc.Arbitrary<Entity<BookProperties>> => {
  return fc.record({
    id: fc.uuid(),
    type: fc.constant("book"),
    properties: fc.record({
      title: fc.string({ minLength: 1, maxLength: 200 }),
      author: fc.string({ minLength: 1, maxLength: 100 }),
      isbn: isbn13Arbitrary(),
      publishedDate: fc.date({ min: new Date("1800-01-01") }).map(d => d.toISOString()),
      publisher: fc.option(fc.string()),
      pageCount: fc.option(fc.integer({ min: 1, max: 10000 })),
      language: fc.constantFrom("en", "es", "fr", "de", "it", "pt", "ja", "zh")
    }),
    metadata: fc.record({
      created_at: fc.date().map(d => d.toISOString()),
      updated_at: fc.date().map(d => d.toISOString()),
      version: fc.integer({ min: 1 })
    })
  })
}

// Usage
test("serializes all valid book entities", () => {
  fc.assert(
    fc.property(
      bookEntityArbitrary(),
      (book) => {
        const serialized = serializeEntity(book)
        const deserialized = deserializeEntity(serialized)
        expect(deserialized).toEqual(book)
      }
    )
  )
})
```

---

## Configuration

### **Adjusting Test Run Count**

```typescript
test("runs 1000 test cases", () => {
  fc.assert(
    fc.property(
      fc.string(),
      (str) => {
        expect(normalizeEntityType(str)).toBe(normalizeEntityType(str))
      }
    ),
    { numRuns: 1000 } // Default is 100
  )
})
```

### **Seeding for Reproducibility**

```typescript
test("deterministic test runs", () => {
  fc.assert(
    fc.property(
      fc.string(),
      (str) => {
        expect(validateInput(str)).toBeDefined()
      }
    ),
    { seed: 42 } // Same seed = same test cases
  )
})
```

### **Verbose Output**

```typescript
test("shows generated values on failure", () => {
  fc.assert(
    fc.property(
      fc.string(),
      (str) => {
        expect(str.length).toBeGreaterThan(0)
      }
    ),
    { verbose: true } // Show all generated values
  )
})
```

---

## Best Practices

### ✅ **Do:**

1. **Start with simple properties** - "Output is always lowercase"
2. **Use built-in arbitraries** - `fc.string()`, `fc.integer()`, `fc.date()`
3. **Filter invalid inputs** - `.filter(s => s.length > 0)`
4. **Document the property** - Comment what invariant is being tested
5. **Combine with example tests** - Use both property-based and example-based tests
6. **Shrink to minimal examples** - fast-check does this automatically
7. **Use custom arbitraries** - Create domain-specific generators
8. **Test idempotence** - `f(f(x)) === f(x)`
9. **Test commutativity** - `f(a, b) === f(b, a)`
10. **Test round-trips** - `decode(encode(x)) === x`

### ❌ **Don't:**

1. **Test non-deterministic code** - Time, randomness, external APIs
2. **Over-constrain arbitraries** - Too many filters = slow tests
3. **Ignore shrinking failures** - The minimal example is the real bug
4. **Test implementation details** - Focus on observable behavior
5. **Use property-based testing everywhere** - It's a complement, not a replacement

---

## Summary

**Property-based testing is powerful for:**
- ✅ Validators (ISBN, email, URL)
- ✅ Parsers (dates, JSON, domain types)
- ✅ Transformations (normalization, serialization)
- ✅ Business rules (permissions, calculations)
- ✅ Discovering edge cases automatically

**Use example-based testing for:**
- ✅ Specific business scenarios
- ✅ UI interactions
- ✅ Database operations
- ✅ External API integrations
- ✅ Regression tests (known bugs)

**Best results:** Combine both approaches for comprehensive coverage.

---

**Version:** 1.0.0
**Last Updated:** 2026-02-12
**Status:** ⭐️ Phase 0.2 - Testing Strategy & Infrastructure
