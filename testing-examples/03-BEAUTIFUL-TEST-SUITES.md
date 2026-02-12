# Beautiful Test Suites: Comprehensive Examples

> **Purpose:** Showcase what a beautifully refactored test suite looks like, with tests as living documentation, comprehensive coverage, and elegant patterns.

---

## Example 1: Entity Repository (Data Layer)

This example shows a **fully refactored** entity repository with comprehensive test coverage, using factories, property-based testing, and tests-as-documentation.

### **Implementation (Idealized)**

```typescript
// data/client/src/EntityRepository.ts

import type { Entity, EntityType, EntityId } from "@domains/types"
import type { DatabaseConnection } from "./connection"

export interface EntityRepository {
  /** Create a new entity and return it with generated ID */
  create<T>(entity: Omit<Entity<T>, "id">): Promise<Entity<T>>

  /** Retrieve an entity by ID, or null if not found */
  getById<T>(id: EntityId): Promise<Entity<T> | null>

  /** Find all entities of a given type */
  findByType<T>(type: EntityType): Promise<Entity<T>[]>

  /** Update an existing entity */
  update<T>(id: EntityId, updates: Partial<Entity<T>["properties"]>): Promise<Entity<T>>

  /** Soft-delete an entity (sets deleted_at timestamp) */
  delete(id: EntityId): Promise<void>

  /** Get entity history (all versions) */
  getHistory<T>(id: EntityId): Promise<Entity<T>[]>
}

export class PostgresEntityRepository implements EntityRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async create<T>(entity: Omit<Entity<T>, "id">): Promise<Entity<T>> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const created: Entity<T> = {
      ...entity,
      id,
      metadata: {
        ...entity.metadata,
        created_at: now,
        updated_at: now,
        version: 1
      }
    }

    await this.db.query(
      `INSERT INTO entities (id, type, properties, metadata) VALUES ($1, $2, $3, $4)`,
      [id, entity.type, JSON.stringify(entity.properties), JSON.stringify(created.metadata)]
    )

    return created
  }

  async getById<T>(id: EntityId): Promise<Entity<T> | null> {
    const result = await this.db.query<Entity<T>>(
      `SELECT * FROM entities WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    return result.rows[0] ?? null
  }

  async findByType<T>(type: EntityType): Promise<Entity<T>[]> {
    const result = await this.db.query<Entity<T>>(
      `SELECT * FROM entities WHERE type = $1 AND deleted_at IS NULL ORDER BY metadata->>'created_at' DESC`,
      [type]
    )
    return result.rows
  }

  async update<T>(id: EntityId, updates: Partial<Entity<T>["properties"]>): Promise<Entity<T>> {
    const existing = await this.getById<T>(id)
    if (!existing) {
      throw new EntityNotFoundError(id)
    }

    const updated: Entity<T> = {
      ...existing,
      properties: { ...existing.properties, ...updates },
      metadata: {
        ...existing.metadata,
        updated_at: new Date().toISOString(),
        version: existing.metadata.version + 1
      }
    }

    await this.db.query(
      `UPDATE entities SET properties = $1, metadata = $2 WHERE id = $3`,
      [JSON.stringify(updated.properties), JSON.stringify(updated.metadata), id]
    )

    return updated
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.query(
      `UPDATE entities SET deleted_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    )
  }

  async getHistory<T>(id: EntityId): Promise<Entity<T>[]> {
    const result = await this.db.query<Entity<T>>(
      `SELECT * FROM entities_history WHERE id = $1 ORDER BY metadata->>'version' ASC`,
      [id]
    )
    return result.rows
  }
}
```

### **Test Suite (Idealized)**

```typescript
// data/client/tests/EntityRepository.test.ts

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import fc from "fast-check"
import { PostgresEntityRepository } from "../src/EntityRepository"
import { EntityFactory } from "@/tests/factories"
import { createTestDatabase, closeTestDatabase } from "@/tests/helpers/database"
import type { DatabaseConnection } from "../src/connection"
import type { BookProperties, PersonProperties } from "@domains/types"

describe("EntityRepository", () => {
  let db: DatabaseConnection
  let repository: PostgresEntityRepository
  let testEntityType: string

  beforeAll(async () => {
    db = await createTestDatabase()
  })

  afterAll(async () => {
    await closeTestDatabase(db)
  })

  beforeEach(() => {
    // Unique entity type per test to avoid conflicts
    testEntityType = `test_entity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    repository = new PostgresEntityRepository(db)
  })

  describe("create", () => {
    /**
     * SPECIFICATION: Create should generate a unique ID for new entities
     */
    test("generates a unique ID for new entities", async () => {
      const entity = EntityFactory.build({ type: testEntityType })

      const created = await repository.create(entity)

      expect(created.id).toBeDefined()
      expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    /**
     * SPECIFICATION: Create should set created_at and updated_at to current time
     */
    test("sets timestamps to current time", async () => {
      const before = new Date().toISOString()
      const entity = EntityFactory.build({ type: testEntityType })

      const created = await repository.create(entity)
      const after = new Date().toISOString()

      expect(created.metadata.created_at).toBeGreaterThanOrEqual(before)
      expect(created.metadata.created_at).toBeLessThanOrEqual(after)
      expect(created.metadata.updated_at).toBe(created.metadata.created_at)
    })

    /**
     * SPECIFICATION: Create should initialize version to 1
     */
    test("initializes version to 1", async () => {
      const entity = EntityFactory.build({ type: testEntityType })

      const created = await repository.create(entity)

      expect(created.metadata.version).toBe(1)
    })

    /**
     * SPECIFICATION: Create should preserve entity properties exactly
     */
    test("preserves all entity properties", async () => {
      const entity = EntityFactory.build({
        type: testEntityType,
        properties: {
          title: "The Hobbit",
          author: "J.R.R. Tolkien",
          isbn: "978-0-547-92822-7"
        }
      })

      const created = await repository.create(entity)

      expect(created.properties).toEqual(entity.properties)
    })

    /**
     * PROPERTY: Create should accept any valid entity structure
     */
    test("accepts entities with arbitrary valid properties", () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            type: fc.constantFrom("book", "person", "series"),
            properties: fc.dictionary(
              fc.string().filter(k => k.length > 0),
              fc.oneof(fc.string(), fc.integer(), fc.boolean())
            )
          }),
          async (entity) => {
            const created = await repository.create({ ...entity, type: testEntityType, metadata: {} as any })

            expect(created.id).toBeDefined()
            expect(created.properties).toEqual(entity.properties)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe("getById", () => {
    /**
     * SPECIFICATION: GetById should retrieve existing entities
     */
    test("retrieves an existing entity", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)

      const retrieved = await repository.getById(entity.id)

      expect(retrieved).toEqual(entity)
    })

    /**
     * SPECIFICATION: GetById should return null for non-existent IDs
     */
    test("returns null for non-existent entity", async () => {
      const nonExistentId = crypto.randomUUID()

      const result = await repository.getById(nonExistentId)

      expect(result).toBeNull()
    })

    /**
     * SPECIFICATION: GetById should not return soft-deleted entities
     */
    test("does not return soft-deleted entities", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)
      await repository.delete(entity.id)

      const result = await repository.getById(entity.id)

      expect(result).toBeNull()
    })
  })

  describe("findByType", () => {
    /**
     * SPECIFICATION: FindByType should return all entities of the given type
     */
    test("returns all entities of a given type", async () => {
      await EntityFactory.createList(3, { type: testEntityType }, repository)
      await EntityFactory.createList(2, { type: "other_type" }, repository)

      const results = await repository.findByType(testEntityType)

      expect(results).toHaveLength(3)
      expect(results.every(e => e.type === testEntityType)).toBe(true)
    })

    /**
     * SPECIFICATION: FindByType should return entities in reverse chronological order
     */
    test("returns entities in reverse chronological order", async () => {
      const entities = await EntityFactory.createList(5, { type: testEntityType }, repository)

      const results = await repository.findByType(testEntityType)

      // Most recent first
      expect(results[0].metadata.created_at).toBeGreaterThanOrEqual(
        results[results.length - 1].metadata.created_at
      )
    })

    /**
     * SPECIFICATION: FindByType should return empty array when no entities exist
     */
    test("returns empty array when no entities of type exist", async () => {
      const results = await repository.findByType("nonexistent_type")

      expect(results).toEqual([])
    })

    /**
     * SPECIFICATION: FindByType should exclude soft-deleted entities
     */
    test("excludes soft-deleted entities", async () => {
      const entities = await EntityFactory.createList(3, { type: testEntityType }, repository)
      await repository.delete(entities[0].id)

      const results = await repository.findByType(testEntityType)

      expect(results).toHaveLength(2)
      expect(results.every(e => e.id !== entities[0].id)).toBe(true)
    })
  })

  describe("update", () => {
    /**
     * SPECIFICATION: Update should modify entity properties
     */
    test("modifies entity properties", async () => {
      const entity = await EntityFactory.create<BookProperties>({
        type: testEntityType,
        properties: { title: "Original Title", author: "Original Author" }
      }, repository)

      const updated = await repository.update(entity.id, { title: "Updated Title" })

      expect(updated.properties.title).toBe("Updated Title")
      expect(updated.properties.author).toBe("Original Author") // Unchanged
    })

    /**
     * SPECIFICATION: Update should increment version number
     */
    test("increments version number", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)

      const updated = await repository.update(entity.id, { someField: "new value" })

      expect(updated.metadata.version).toBe(entity.metadata.version + 1)
    })

    /**
     * SPECIFICATION: Update should update the updated_at timestamp
     */
    test("updates the updated_at timestamp", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay

      const updated = await repository.update(entity.id, { someField: "new value" })

      expect(updated.metadata.updated_at).toBeGreaterThan(entity.metadata.updated_at)
    })

    /**
     * SPECIFICATION: Update should throw when entity doesn't exist
     */
    test("throws EntityNotFoundError when entity doesn't exist", async () => {
      const nonExistentId = crypto.randomUUID()

      await expect(
        repository.update(nonExistentId, { someField: "value" })
      ).rejects.toThrow("Entity not found")
    })

    /**
     * SPECIFICATION: Update should preserve created_at timestamp
     */
    test("preserves created_at timestamp", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)

      const updated = await repository.update(entity.id, { someField: "new value" })

      expect(updated.metadata.created_at).toBe(entity.metadata.created_at)
    })
  })

  describe("delete", () => {
    /**
     * SPECIFICATION: Delete should soft-delete entities (set deleted_at)
     */
    test("soft-deletes entities", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)

      await repository.delete(entity.id)

      // Entity should not be retrievable via getById
      const retrieved = await repository.getById(entity.id)
      expect(retrieved).toBeNull()

      // But should still exist in database with deleted_at set
      const raw = await db.query(
        `SELECT deleted_at FROM entities WHERE id = $1`,
        [entity.id]
      )
      expect(raw.rows[0].deleted_at).toBeDefined()
    })

    /**
     * SPECIFICATION: Delete should be idempotent
     */
    test("is idempotent", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)

      await repository.delete(entity.id)
      await repository.delete(entity.id) // Delete again

      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe("getHistory", () => {
    /**
     * SPECIFICATION: GetHistory should return all versions in chronological order
     */
    test("returns all versions in chronological order", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)
      await repository.update(entity.id, { field: "update 1" })
      await repository.update(entity.id, { field: "update 2" })

      const history = await repository.getHistory(entity.id)

      expect(history).toHaveLength(3)
      expect(history[0].metadata.version).toBe(1)
      expect(history[1].metadata.version).toBe(2)
      expect(history[2].metadata.version).toBe(3)
    })

    /**
     * SPECIFICATION: GetHistory should return empty array for non-existent entities
     */
    test("returns empty array for non-existent entity", async () => {
      const nonExistentId = crypto.randomUUID()

      const history = await repository.getHistory(nonExistentId)

      expect(history).toEqual([])
    })
  })

  describe("concurrent operations", () => {
    /**
     * SPECIFICATION: Repository should handle concurrent creates without ID collisions
     */
    test("handles concurrent creates without ID collisions", async () => {
      const entities = Array.from({ length: 10 }, () =>
        EntityFactory.build({ type: testEntityType })
      )

      const created = await Promise.all(
        entities.map(e => repository.create(e))
      )

      const ids = created.map(e => e.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length) // All IDs are unique
    })

    /**
     * SPECIFICATION: Repository should handle concurrent updates with version incrementing
     */
    test("handles concurrent updates with proper versioning", async () => {
      const entity = await EntityFactory.create({ type: testEntityType }, repository)

      const updates = await Promise.all([
        repository.update(entity.id, { field: "update 1" }),
        repository.update(entity.id, { field: "update 2" }),
        repository.update(entity.id, { field: "update 3" })
      ])

      // All updates should have different versions
      const versions = updates.map(e => e.metadata.version)
      const uniqueVersions = new Set(versions)
      expect(uniqueVersions.size).toBe(versions.length)
    })
  })
})
```

### **Documentation Generated from Tests**

```markdown
# EntityRepository API Reference

> Auto-generated from test suite on 2026-02-12

## Methods

### `create<T>(entity: Omit<Entity<T>, "id">): Promise<Entity<T>>`

Create a new entity and return it with generated ID.

**Behavior:**
- ✅ Generates a unique ID for new entities
- ✅ Sets timestamps to current time
- ✅ Initializes version to 1
- ✅ Preserves all entity properties
- ✅ Accepts entities with arbitrary valid properties

**Example:**
```typescript
const entity = { type: "book", properties: { title: "The Hobbit" } }
const created = await repository.create(entity)
// { id: "...", type: "book", properties: { title: "The Hobbit" }, metadata: { ... } }
```

### `getById<T>(id: EntityId): Promise<Entity<T> | null>`

Retrieve an entity by ID, or null if not found.

**Behavior:**
- ✅ Retrieves an existing entity
- ✅ Returns null for non-existent entity
- ✅ Does not return soft-deleted entities

**Example:**
```typescript
const entity = await repository.getById("entity-id")
if (entity) {
  console.log(entity.properties.title)
}
```

### `findByType<T>(type: EntityType): Promise<Entity<T>[]>`

Find all entities of a given type.

**Behavior:**
- ✅ Returns all entities of a given type
- ✅ Returns entities in reverse chronological order
- ✅ Returns empty array when no entities of type exist
- ✅ Excludes soft-deleted entities

**Example:**
```typescript
const books = await repository.findByType("book")
books.forEach(book => console.log(book.properties.title))
```

### `update<T>(id: EntityId, updates: Partial<Entity<T>["properties"]>): Promise<Entity<T>>`

Update an existing entity.

**Behavior:**
- ✅ Modifies entity properties
- ✅ Increments version number
- ✅ Updates the updated_at timestamp
- ✅ Throws EntityNotFoundError when entity doesn't exist
- ✅ Preserves created_at timestamp

**Example:**
```typescript
const updated = await repository.update("entity-id", { title: "New Title" })
console.log(updated.metadata.version) // Incremented
```

### `delete(id: EntityId): Promise<void>`

Soft-delete an entity (sets deleted_at timestamp).

**Behavior:**
- ✅ Soft-deletes entities
- ✅ Is idempotent

**Example:**
```typescript
await repository.delete("entity-id")
const entity = await repository.getById("entity-id") // null
```

### `getHistory<T>(id: EntityId): Promise<Entity<T>[]>`

Get entity history (all versions).

**Behavior:**
- ✅ Returns all versions in chronological order
- ✅ Returns empty array for non-existent entities

**Example:**
```typescript
const history = await repository.getHistory("entity-id")
history.forEach(version => console.log(`v${version.metadata.version}`))
```

## Concurrent Operations

**Thread Safety:**
- ✅ Handles concurrent creates without ID collisions
- ✅ Handles concurrent updates with proper versioning

---

*Coverage: 98.5% (lines), 100% (branches)*
*Last Updated: 2026-02-12*
*Test Suite: data/client/tests/EntityRepository.test.ts*
```

---

## Example 2: Authentication Service (Business Logic)

### **Implementation (Idealized)**

```typescript
// server/src/services/auth/AuthenticationService.ts

import type { User, Credentials, AuthToken } from "@domains/types"
import { hashPassword, verifyPassword } from "@/utils/crypto"
import { generateJWT, verifyJWT } from "@/utils/jwt"
import { UserRepository } from "@/repositories/UserRepository"

export interface AuthenticationService {
  /** Register a new user with email and password */
  register(email: string, password: string, name: string): Promise<User>

  /** Authenticate user with email and password */
  login(email: string, password: string): Promise<AuthToken>

  /** Verify an auth token and return the user */
  verifyToken(token: string): Promise<User>

  /** Refresh an expired token */
  refreshToken(refreshToken: string): Promise<AuthToken>
}

export class JWTAuthenticationService implements AuthenticationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtSecret: string
  ) {}

  async register(email: string, password: string, name: string): Promise<User> {
    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new InvalidEmailError(email)
    }

    // Check if user already exists
    const existing = await this.userRepository.findByEmail(email)
    if (existing) {
      throw new UserAlreadyExistsError(email)
    }

    // Validate password strength
    if (!this.isStrongPassword(password)) {
      throw new WeakPasswordError()
    }

    // Create user with hashed password
    const passwordHash = await hashPassword(password)
    const user = await this.userRepository.create({
      email,
      password_hash: passwordHash,
      name,
      role: "read" // Default role
    })

    return user
  }

  async login(email: string, password: string): Promise<AuthToken> {
    const user = await this.userRepository.findByEmail(email)
    if (!user) {
      throw new InvalidCredentialsError()
    }

    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      throw new InvalidCredentialsError()
    }

    const accessToken = await generateJWT(
      { userId: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      "15m" // 15 minute expiry
    )

    const refreshToken = await generateJWT(
      { userId: user.id, type: "refresh" },
      this.jwtSecret,
      "7d" // 7 day expiry
    )

    return { accessToken, refreshToken, expiresIn: 900 }
  }

  async verifyToken(token: string): Promise<User> {
    const payload = await verifyJWT(token, this.jwtSecret)
    const user = await this.userRepository.getById(payload.userId)

    if (!user) {
      throw new InvalidTokenError()
    }

    return user
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    const payload = await verifyJWT(refreshToken, this.jwtSecret)

    if (payload.type !== "refresh") {
      throw new InvalidTokenError()
    }

    const user = await this.userRepository.getById(payload.userId)
    if (!user) {
      throw new InvalidTokenError()
    }

    const accessToken = await generateJWT(
      { userId: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      "15m"
    )

    return { accessToken, refreshToken, expiresIn: 900 }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  private isStrongPassword(password: string): boolean {
    return password.length >= 8 // Simplifi for example
  }
}
```

### **Test Suite (Idealized)**

```typescript
// server/tests/services/AuthenticationService.test.ts

import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test"
import fc from "fast-check"
import { JWTAuthenticationService } from "@/services/auth/AuthenticationService"
import { UserFactory } from "@/tests/factories"
import { createMockUserRepository } from "@/tests/helpers/mocks"
import { emailArbitrary } from "@/tests/helpers/arbitraries"

describe("AuthenticationService", () => {
  let service: JWTAuthenticationService
  let userRepository: ReturnType<typeof createMockUserRepository>
  const jwtSecret = "test-secret-key"

  beforeEach(() => {
    userRepository = createMockUserRepository()
    service = new JWTAuthenticationService(userRepository, jwtSecret)
  })

  describe("register", () => {
    /**
     * SPECIFICATION: Register should create a new user with hashed password
     */
    test("creates a new user with hashed password", async () => {
      const email = "test@example.com"
      const password = "StrongPass123!"
      const name = "Test User"

      const user = await service.register(email, password, name)

      expect(user.email).toBe(email)
      expect(user.name).toBe(name)
      expect(user.password_hash).not.toBe(password) // Should be hashed
      expect(user.role).toBe("read") // Default role
    })

    /**
     * SPECIFICATION: Register should reject invalid email addresses
     */
    test("rejects invalid email addresses", async () => {
      const invalidEmails = [
        "not-an-email",
        "@example.com",
        "test@",
        "test @example.com",
        ""
      ]

      for (const email of invalidEmails) {
        await expect(
          service.register(email, "password123", "Test")
        ).rejects.toThrow("Invalid email")
      }
    })

    /**
     * PROPERTY: Register should reject any malformed email
     */
    test("rejects malformed email addresses", () => {
      fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => !s.includes("@") || !s.includes(".")),
          fc.string().filter(s => s.length >= 8),
          async (email, password) => {
            await expect(
              service.register(email, password, "Test")
            ).rejects.toThrow()
          }
        )
      )
    })

    /**
     * SPECIFICATION: Register should reject weak passwords
     */
    test("rejects weak passwords", async () => {
      await expect(
        service.register("test@example.com", "short", "Test")
      ).rejects.toThrow("Weak password")
    })

    /**
     * SPECIFICATION: Register should reject duplicate emails
     */
    test("rejects duplicate email addresses", async () => {
      await service.register("test@example.com", "password123", "User 1")

      await expect(
        service.register("test@example.com", "password456", "User 2")
      ).rejects.toThrow("User already exists")
    })

    /**
     * PROPERTY: Register should accept all valid email/password combinations
     */
    test("accepts valid email and password combinations", () => {
      fc.assert(
        fc.asyncProperty(
          emailArbitrary(),
          fc.string({ minLength: 8 }),
          fc.string({ minLength: 1 }),
          async (email, password, name) => {
            // Skip if email already exists
            const existing = await userRepository.findByEmail(email)
            fc.pre(!existing)

            const user = await service.register(email, password, name)

            expect(user.email).toBe(email)
            expect(user.name).toBe(name)
            expect(user.password_hash).toBeDefined()
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe("login", () => {
    /**
     * SPECIFICATION: Login should return a valid auth token for correct credentials
     */
    test("returns auth token for valid credentials", async () => {
      const email = "test@example.com"
      const password = "password123"
      await service.register(email, password, "Test User")

      const token = await service.login(email, password)

      expect(token.accessToken).toBeDefined()
      expect(token.refreshToken).toBeDefined()
      expect(token.expiresIn).toBe(900) // 15 minutes
    })

    /**
     * SPECIFICATION: Login should reject incorrect passwords
     */
    test("rejects incorrect password", async () => {
      const email = "test@example.com"
      await service.register(email, "correct-password", "Test")

      await expect(
        service.login(email, "wrong-password")
      ).rejects.toThrow("Invalid credentials")
    })

    /**
     * SPECIFICATION: Login should reject non-existent users
     */
    test("rejects non-existent users", async () => {
      await expect(
        service.login("nonexistent@example.com", "password")
      ).rejects.toThrow("Invalid credentials")
    })

    /**
     * SPECIFICATION: Login should be case-sensitive for passwords
     */
    test("is case-sensitive for passwords", async () => {
      const email = "test@example.com"
      const password = "Password123"
      await service.register(email, password, "Test")

      await expect(
        service.login(email, "password123") // Lowercase
      ).rejects.toThrow("Invalid credentials")
    })
  })

  describe("verifyToken", () => {
    /**
     * SPECIFICATION: VerifyToken should return user for valid token
     */
    test("returns user for valid token", async () => {
      const email = "test@example.com"
      await service.register(email, "password123", "Test User")
      const { accessToken } = await service.login(email, "password123")

      const user = await service.verifyToken(accessToken)

      expect(user.email).toBe(email)
    })

    /**
     * SPECIFICATION: VerifyToken should reject expired tokens
     */
    test("rejects expired tokens", async () => {
      // Create token with past expiry
      const expiredToken = await generateJWT(
        { userId: "test", email: "test@example.com", role: "read" },
        jwtSecret,
        "-1h" // Expired 1 hour ago
      )

      await expect(
        service.verifyToken(expiredToken)
      ).rejects.toThrow("Invalid token")
    })

    /**
     * SPECIFICATION: VerifyToken should reject malformed tokens
     */
    test("rejects malformed tokens", async () => {
      const malformedTokens = [
        "not.a.token",
        "invalid-jwt",
        "",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"
      ]

      for (const token of malformedTokens) {
        await expect(
          service.verifyToken(token)
        ).rejects.toThrow()
      }
    })
  })

  describe("refreshToken", () => {
    /**
     * SPECIFICATION: RefreshToken should issue new access token
     */
    test("issues new access token from valid refresh token", async () => {
      const email = "test@example.com"
      await service.register(email, "password123", "Test")
      const { refreshToken: oldRefreshToken } = await service.login(email, "password123")

      const { accessToken, refreshToken } = await service.refreshToken(oldRefreshToken)

      expect(accessToken).toBeDefined()
      expect(refreshToken).toBe(oldRefreshToken) // Refresh token unchanged
    })

    /**
     * SPECIFICATION: RefreshToken should reject access tokens (not refresh tokens)
     */
    test("rejects access tokens", async () => {
      const email = "test@example.com"
      await service.register(email, "password123", "Test")
      const { accessToken } = await service.login(email, "password123")

      await expect(
        service.refreshToken(accessToken)
      ).rejects.toThrow("Invalid token")
    })
  })

  describe("security properties", () => {
    /**
     * PROPERTY: Password hashing should be deterministic
     */
    test("password hashing is deterministic", () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8 }),
          async (password) => {
            const hash1 = await hashPassword(password)
            const hash2 = await hashPassword(password)

            // Hashes should be consistent (for verification)
            const valid1 = await verifyPassword(password, hash1)
            const valid2 = await verifyPassword(password, hash2)

            expect(valid1).toBe(true)
            expect(valid2).toBe(true)
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * PROPERTY: JWT tokens should be verifiable
     */
    test("JWT tokens round-trip correctly", () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            email: emailArbitrary(),
            role: fc.constantFrom("owner", "write", "read")
          }),
          async (payload) => {
            const token = await generateJWT(payload, jwtSecret, "1h")
            const verified = await verifyJWT(token, jwtSecret)

            expect(verified.userId).toBe(payload.userId)
            expect(verified.email).toBe(payload.email)
            expect(verified.role).toBe(payload.role)
          }
        )
      )
    })
  })
})
```

---

## Coverage Integration

### **Generating Coverage Reports**

```bash
# Run tests with coverage
bun test --coverage

# Generate HTML report
bun test --coverage --coverage-reporter=html

# Open report in browser
open coverage/index.html
```

### **Coverage Badge (README.md)**

```markdown
# QuailComp

[![Test Coverage](https://img.shields.io/badge/coverage-98.5%25-brightgreen)]()
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen)]()

...
```

### **Coverage Thresholds (bunfig.toml)**

```toml
[test]
coverageThreshold = 0.90  # Fail if coverage drops below 90%
```

---

## Summary

**Beautiful test suites have:**

1. ✅ **Clear specifications** - Each test documents a behavioral requirement
2. ✅ **Descriptive names** - Test names read like documentation
3. ✅ **Comprehensive coverage** - All behaviors tested (unit + property-based)
4. ✅ **Proper organization** - Grouped by functionality (`describe` blocks)
5. ✅ **Factory-driven data** - No hard-coded test data
6. ✅ **Living documentation** - Auto-generated API docs from tests
7. ✅ **Coverage integration** - Track and maintain high coverage
8. ✅ **Property-based testing** - Discover edge cases automatically

**Next Steps:**

1. Review the examples above
2. Apply these patterns to your refactored code
3. Generate documentation from your test suites
4. Track coverage metrics
5. Iterate and refine

---

**Version:** 1.0.0
**Last Updated:** 2026-02-12
**Status:** ⭐️ Phase 0.2 - Testing Strategy & Infrastructure
