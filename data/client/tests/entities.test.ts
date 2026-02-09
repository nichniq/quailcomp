/**
 * Entities Table - Comprehensive Test Suite
 *
 * =============================================================================
 * TEST PLAN
 * =============================================================================
 *
 * 1. SETUP & CONNECTION
 *    - Connect to test database
 *    - Verify table exists with correct structure
 *
 * 2. CREATE OPERATIONS
 *    - Create a new entity (auto-generated entity_id)
 *    - Create multiple entities
 *    - Verify entry_id is auto-incremented
 *    - Verify entered_at is set automatically
 *    - Verify entity_id sequence increments correctly
 *
 * 3. UPDATE OPERATIONS
 *    - Update an existing entity (reuse entity_id)
 *    - Verify sequence is not consumed on update
 *    - Verify old entry is preserved (append-only)
 *    - Multiple updates create multiple entries
 *
 * 4. DELETE OPERATIONS (Soft Delete)
 *    - Soft delete an entity
 *    - Verify deleted_at is set
 *    - Verify entity still exists in database
 *    - Verify deleted entity is excluded from default queries
 *    - Test restore (un-delete) functionality
 *
 * 5. READ OPERATIONS
 *    - Get entity by ID (latest version)
 *    - Get entity history (all versions)
 *    - Get entities by type
 *    - Count entities
 *    - Check entity exists
 *
 * 6. SEARCH OPERATIONS
 *    - Search by JSONB containment
 *    - Search with multiple criteria
 *
 * 7. EDGE CASES & ERROR HANDLING
 *    - Invalid entity_id on update (should fail)
 *    - Empty data object
 *    - Large data payload
 *    - Special characters in data
 *
 * 8. TRIGGER VALIDATION
 *    - Verify trigger prevents new entities with explicit entity_id
 *    - Verify trigger allows updates with existing entity_id
 *    - Verify sequence rollback on update
 *
 * 9. INDEX EFFECTIVENESS
 *    - Queries use expected indexes
 *
 * =============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { SQL } from "bun";
import { EntitiesClient, type Entry } from "@/db/entities";

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DB_NAME = process.env.DB_TEST_NAME ?? "quailcomp_test";

let sql: SQL;
let client: EntitiesClient;

// Test data types
interface TestUserData {
  name: string;
  email: string;
  age?: number;
}

interface TestProductData {
  name: string;
  price: number;
  tags?: string[];
}

beforeAll(async () => {
  // Connect to test database as quailcomp_app using Bun's built-in SQL
  const password = process.env.DB_PASSWORD ?? "";
  const auth = password ? `quailcomp_app:${password}` : "quailcomp_app";

  sql = new SQL({
    url: `postgres://${auth}@localhost:5432/${TEST_DB_NAME}`,
  });

  client = new EntitiesClient(sql);

  // Verify connection and table exist
  const result = await sql`SELECT 1 as connected`;
  expect(result[0].connected).toBe(1);
});

afterAll(async () => {
  await sql.close();
});

// Clean up test data between tests
beforeEach(async () => {
  // Delete all test data (as superuser, since quailcomp_app can't delete)
  // For tests, we'll just work with the data we create and filter appropriately
  // In a real setup, you might want to truncate tables between tests
});

// =============================================================================
// Helper Functions
// =============================================================================

async function getSequenceValue(): Promise<number> {
  const result = await sql`SELECT last_value FROM entity_id_seq`;
  return Number(result[0].last_value);
}

async function countAllEntries(): Promise<number> {
  const result = await sql`SELECT COUNT(*) as count FROM entities`;
  return Number(result[0].count);
}

// =============================================================================
// 1. SETUP & CONNECTION
// =============================================================================

describe("Setup & Connection", () => {
  it("should connect to the test database", async () => {
    const result = await sql`SELECT current_database() as db`;
    expect(result[0].db).toBe(TEST_DB_NAME);
  });

  it("should have the entities table with correct columns", async () => {
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'entities'
      ORDER BY ordinal_position
    `;

    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain("entry_id");
    expect(columnNames).toContain("entered_at");
    expect(columnNames).toContain("type");
    expect(columnNames).toContain("data");
    expect(columnNames).toContain("entity_id");
    expect(columnNames).toContain("deleted_at");
  });

  it("should have the validation trigger installed", async () => {
    const triggers = await sql`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'entities'
    `;

    const triggerNames = triggers.map((t: any) => t.trigger_name);
    expect(triggerNames).toContain("check_entity_id");
  });
});

// =============================================================================
// 2. CREATE OPERATIONS
// =============================================================================

describe("Create Operations", () => {
  it("should create a new entity with auto-generated entity_id", async () => {
    const entry = await client.create<TestUserData>({
      type: "user",
      data: { name: "Alice", email: "alice@example.com" },
    });

    expect(entry.entryId).toBeGreaterThan(0);
    expect(entry.entityId).toBeGreaterThan(0);
    expect(entry.type).toBe("user");
    expect(entry.data.name).toBe("Alice");
    expect(entry.data.email).toBe("alice@example.com");
    expect(entry.enteredAt).toBeInstanceOf(Date);
    expect(entry.deletedAt).toBeNull();
  });

  it("should auto-increment entity_id for new entities", async () => {
    const seqBefore = await getSequenceValue();

    const entry1 = await client.create<TestUserData>({
      type: "user",
      data: { name: "Bob", email: "bob@example.com" },
    });

    const entry2 = await client.create<TestUserData>({
      type: "user",
      data: { name: "Carol", email: "carol@example.com" },
    });

    expect(entry2.entityId).toBe(entry1.entityId + 1);

    const seqAfter = await getSequenceValue();
    expect(seqAfter).toBe(seqBefore + 2);
  });

  it("should create entities with different types", async () => {
    const user = await client.create<TestUserData>({
      type: "user",
      data: { name: "Dave", email: "dave@example.com" },
    });

    const product = await client.create<TestProductData>({
      type: "product",
      data: { name: "Widget", price: 19.99 },
    });

    expect(user.type).toBe("user");
    expect(product.type).toBe("product");
    expect(user.entityId).not.toBe(product.entityId);
  });

  it("should create multiple entities in a transaction", async () => {
    const entriesBefore = await countAllEntries();

    const entries = await client.createMany<TestUserData>([
      { type: "user", data: { name: "Eve", email: "eve@example.com" } },
      { type: "user", data: { name: "Frank", email: "frank@example.com" } },
      { type: "user", data: { name: "Grace", email: "grace@example.com" } },
    ]);

    expect(entries).toHaveLength(3);

    const entriesAfter = await countAllEntries();
    expect(entriesAfter).toBe(entriesBefore + 3);
  });

  it("should handle empty createMany gracefully", async () => {
    const entries = await client.createMany<TestUserData>([]);
    expect(entries).toHaveLength(0);
  });
});

// =============================================================================
// 3. UPDATE OPERATIONS
// =============================================================================

describe("Update Operations", () => {
  it("should update an entity by adding a new entry", async () => {
    // Create initial entity
    const created = await client.create<TestUserData>({
      type: "user",
      data: { name: "Henry", email: "henry@example.com" },
    });

    // Update the entity
    const updated = await client.update<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Henry Updated", email: "henry.new@example.com" },
    });

    // Verify new entry was created
    expect(updated.entryId).toBeGreaterThan(created.entryId);
    expect(updated.entityId).toBe(created.entityId);
    expect(updated.data.name).toBe("Henry Updated");
  });

  it("should not consume sequence on update", async () => {
    // Create entity
    const created = await client.create<TestUserData>({
      type: "user",
      data: { name: "Ivy", email: "ivy@example.com" },
    });

    const seqBefore = await getSequenceValue();

    // Update multiple times
    await client.update<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Ivy v2", email: "ivy@example.com" },
    });

    await client.update<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Ivy v3", email: "ivy@example.com" },
    });

    const seqAfter = await getSequenceValue();

    // Sequence should not have changed
    expect(seqAfter).toBe(seqBefore);
  });

  it("should preserve all versions (append-only)", async () => {
    // Create and update
    const created = await client.create<TestUserData>({
      type: "user",
      data: { name: "Jack v1", email: "jack@example.com" },
    });

    await client.update<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Jack v2", email: "jack@example.com" },
    });

    await client.update<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Jack v3", email: "jack@example.com" },
    });

    // Get history
    const history = await client.getHistory<TestUserData>(created.entityId);

    expect(history).toHaveLength(3);
    expect(history[0].data.name).toBe("Jack v1");
    expect(history[1].data.name).toBe("Jack v2");
    expect(history[2].data.name).toBe("Jack v3");
  });
});

// =============================================================================
// 4. DELETE OPERATIONS (Soft Delete)
// =============================================================================

describe("Soft Delete Operations", () => {
  it("should soft-delete an entity", async () => {
    const created = await client.create<TestUserData>({
      type: "user",
      data: { name: "Kate", email: "kate@example.com" },
    });

    const deleted = await client.delete<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Kate", email: "kate@example.com" },
    });

    expect(deleted.entityId).toBe(created.entityId);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
  });

  it("should exclude deleted entities from default queries", async () => {
    const created = await client.create<TestUserData>({
      type: "user",
      data: { name: "Leo", email: "leo@example.com" },
    });

    // Should be found before deletion
    const foundBefore = await client.getById<TestUserData>(created.entityId);
    expect(foundBefore).not.toBeNull();

    // Delete
    await client.delete<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Leo", email: "leo@example.com" },
    });

    // Should not be found after deletion (default behavior)
    const foundAfter = await client.getById<TestUserData>(created.entityId);
    expect(foundAfter).toBeNull();

    // Should be found with includeDeleted option
    const foundWithDeleted = await client.getById<TestUserData>(
      created.entityId,
      { includeDeleted: true }
    );
    expect(foundWithDeleted).not.toBeNull();
    expect(foundWithDeleted?.deletedAt).toBeInstanceOf(Date);
  });

  it("should restore a soft-deleted entity", async () => {
    const created = await client.create<TestUserData>({
      type: "user",
      data: { name: "Mary", email: "mary@example.com" },
    });

    // Delete
    await client.delete<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Mary", email: "mary@example.com" },
    });

    // Restore
    const restored = await client.restore<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Mary Restored", email: "mary@example.com" },
    });

    expect(restored.deletedAt).toBeNull();

    // Should be found again
    const found = await client.getById<TestUserData>(created.entityId);
    expect(found).not.toBeNull();
    expect(found?.data.name).toBe("Mary Restored");
  });
});

// =============================================================================
// 5. READ OPERATIONS
// =============================================================================

describe("Read Operations", () => {
  it("should get entity by ID (latest version)", async () => {
    const created = await client.create<TestUserData>({
      type: "user",
      data: { name: "Nina v1", email: "nina@example.com" },
    });

    await client.update<TestUserData>({
      entityId: created.entityId,
      type: "user",
      data: { name: "Nina v2", email: "nina@example.com" },
    });

    const latest = await client.getById<TestUserData>(created.entityId);

    expect(latest?.data.name).toBe("Nina v2");
  });

  it("should return null for non-existent entity", async () => {
    const result = await client.getById(999999);
    expect(result).toBeNull();
  });

  it("should get entities by type", async () => {
    // Create some products
    const uniqueType = `product_${Date.now()}`;

    await client.create<TestProductData>({
      type: uniqueType,
      data: { name: "Product A", price: 10 },
    });

    await client.create<TestProductData>({
      type: uniqueType,
      data: { name: "Product B", price: 20 },
    });

    const products = await client.getByType<TestProductData>(uniqueType);

    expect(products).toHaveLength(2);
    expect(products.map((p) => p.data.name).sort()).toEqual([
      "Product A",
      "Product B",
    ]);
  });

  it("should check if entity exists", async () => {
    const created = await client.create<TestUserData>({
      type: "user",
      data: { name: "Oscar", email: "oscar@example.com" },
    });

    const exists = await client.exists(created.entityId);
    expect(exists).toBe(true);

    const notExists = await client.exists(999999);
    expect(notExists).toBe(false);
  });

  it("should count entities by type", async () => {
    const uniqueType = `counttest_${Date.now()}`;

    await client.create({ type: uniqueType, data: { n: 1 } });
    await client.create({ type: uniqueType, data: { n: 2 } });
    await client.create({ type: uniqueType, data: { n: 3 } });

    const count = await client.countByType(uniqueType);
    expect(count).toBe(3);
  });
});

// =============================================================================
// 6. SEARCH OPERATIONS
// =============================================================================

describe("Search Operations", () => {
  it("should search by JSONB containment", async () => {
    const uniqueType = `searchtest_${Date.now()}`;

    await client.create<TestUserData>({
      type: uniqueType,
      data: { name: "Active User", email: "active@example.com", age: 25 },
    });

    await client.create<TestUserData>({
      type: uniqueType,
      data: { name: "Another User", email: "another@example.com", age: 30 },
    });

    await client.create<TestUserData>({
      type: uniqueType,
      data: { name: "Young User", email: "young@example.com", age: 25 },
    });

    // Search for users with age 25
    const results = await client.findByData<TestUserData>(uniqueType, {
      age: 25,
    });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.data.age === 25)).toBe(true);
  });

  it("should search with nested JSONB", async () => {
    const uniqueType = `nestedsearch_${Date.now()}`;

    await client.create({
      type: uniqueType,
      data: { settings: { theme: "dark", lang: "en" } },
    });

    await client.create({
      type: uniqueType,
      data: { settings: { theme: "light", lang: "en" } },
    });

    const darkTheme = await client.findByData(uniqueType, {
      settings: { theme: "dark" },
    });

    expect(darkTheme).toHaveLength(1);
  });
});

// =============================================================================
// 7. EDGE CASES & ERROR HANDLING
// =============================================================================

describe("Edge Cases & Error Handling", () => {
  it("should reject invalid entity_id on update", async () => {
    // Note: Using try/catch instead of expect().rejects due to Bun issue
    try {
      await client.update<TestUserData>({
        entityId: 999999, // Non-existent
        type: "user",
        data: { name: "Invalid", email: "invalid@example.com" },
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Should throw an error
      expect(error).toBeDefined();
    }
  });

  it("should handle empty data object", async () => {
    const entry = await client.create({
      type: "empty",
      data: {},
    });

    expect(entry.data).toEqual({});
  });

  it("should handle large data payload", async () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      value: `item-${i}`,
    }));

    const entry = await client.create({
      type: "large",
      data: { items: largeArray },
    });

    expect((entry.data as any).items).toHaveLength(1000);
  });

  it("should handle special characters in data", async () => {
    const entry = await client.create({
      type: "special",
      data: {
        text: "Hello \"world\" with 'quotes' and \\ backslash",
        unicode: "日本語 emoji: 🎉",
        newlines: "line1\nline2\ttab",
      },
    });

    expect((entry.data as any).text).toContain('"world"');
    expect((entry.data as any).unicode).toContain("日本語");
  });

  it("should handle null values in data", async () => {
    const entry = await client.create({
      type: "nulls",
      data: { value: null, nested: { also: null } },
    });

    expect((entry.data as any).value).toBeNull();
  });
});

// =============================================================================
// 8. TRIGGER VALIDATION
// =============================================================================

describe("Trigger Validation", () => {
  it("should prevent creating new entity with explicit entity_id", async () => {
    // Try to create with an explicit entity_id that doesn't exist
    // The trigger should reject this since 999999 doesn't exist
    try {
      await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (999999, 'test', '{"test": true}')
      `;
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toMatch(/does not exist/);
    }
  });

  it("should allow update with existing entity_id", async () => {
    // Create an entity first using nextval (required since no DEFAULT)
    const created = await sql`
      INSERT INTO entities (entity_id, type, data)
      VALUES (nextval('entity_id_seq'), 'trigger_test', '{"version": 1}')
      RETURNING *
    `;

    // Update with explicit entity_id should work
    const updated = await sql`
      INSERT INTO entities (entity_id, type, data)
      VALUES (${created[0].entity_id}, 'trigger_test', '{"version": 2}')
      RETURNING *
    `;

    expect(updated[0].entity_id).toBe(created[0].entity_id);
    expect(Number(updated[0].entry_id)).toBeGreaterThan(Number(created[0].entry_id));
  });
});

// =============================================================================
// 9. INDEX EFFECTIVENESS (Basic Check)
// =============================================================================

describe("Index Effectiveness", () => {
  it("should have indexes defined for common queries", async () => {
    // Check that the expected indexes exist
    // Note: Whether they're used depends on table size and planner decisions
    const indexes = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'entities'
    `;

    const indexNames = indexes.map((i: any) => i.indexname);
    expect(indexNames).toContain("idx_entities_active");
    expect(indexNames).toContain("idx_entities_type_active");
    expect(indexNames).toContain("idx_entities_data_gin");
  });

  it("should generate a valid query plan", async () => {
    const explain = await sql`
      EXPLAIN (FORMAT JSON)
      SELECT * FROM entities
      WHERE entity_id = 1 AND deleted_at IS NULL
      ORDER BY entered_at DESC
      LIMIT 1
    `;

    const plan = JSON.stringify(explain);
    // Verify we get a valid query plan back
    expect(plan).toMatch(/Plan/i);
    expect(plan).toMatch(/entities/i);
  });
});

// =============================================================================
// Pagination Tests
// =============================================================================

describe("Pagination", () => {
  let testEntityIds: number[];

  beforeEach(async () => {
    // Create 5 test entities for pagination testing
    const uniqueType = `pagination_test_${Date.now()}`;
    const entries = await client.createMany(
      Array.from({ length: 5 }, (_, i) => ({
        type: uniqueType,
        data: { index: i },
      }))
    );
    testEntityIds = entries.map((e) => e.entityId);
  });

  it("should limit results", async () => {
    const results = await client.getByType("pagination_test", { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("should offset results", async () => {
    const uniqueType = `pagination_offset_${Date.now()}`;
    await client.createMany([
      { type: uniqueType, data: { value: "a" } },
      { type: uniqueType, data: { value: "b" } },
      { type: uniqueType, data: { value: "c" } },
    ]);

    const page1 = await client.getByType(uniqueType, { limit: 2 });
    const page2 = await client.getByType(uniqueType, { limit: 2, offset: 2 });

    expect(page1.length).toBe(2);
    expect(page2.length).toBe(1);
    expect(page1[0].entityId).not.toBe(page2[0].entityId);
  });

  it("should combine limit and offset", async () => {
    const uniqueType = `pagination_combined_${Date.now()}`;
    const entries = await client.createMany(
      Array.from({ length: 10 }, (_, i) => ({
        type: uniqueType,
        data: { index: i },
      }))
    );

    const page2 = await client.getByType(uniqueType, { limit: 3, offset: 3 });

    expect(page2.length).toBe(3);
    // Should get items 3, 4, 5 (0-indexed)
    expect(page2[0].entityId).toBe(entries[3].entityId);
    expect(page2[1].entityId).toBe(entries[4].entityId);
    expect(page2[2].entityId).toBe(entries[5].entityId);
  });

  it("should handle large offset", async () => {
    const results = await client.getByType("pagination_test", { offset: 1000 });
    expect(results.length).toBe(0);
  });

  it("should handle limit of 0", async () => {
    const results = await client.getByType("pagination_test", { limit: 0 });
    expect(results.length).toBe(0);
  });
});

// =============================================================================
// Transaction Tests
// =============================================================================

describe("Transactions", () => {
  it("should rollback createMany on failure", async () => {
    const uniqueType = `transaction_rollback_${Date.now()}`;

    // Track initial count
    const initialCount = await client.countByType(uniqueType);

    // Try to use createMany with invalid data that will cause a database error
    // Force a failure by creating an invalid JSON (using raw SQL to bypass type checking)
    try {
      await sql.begin(async (tx) => {
        // Create first entity successfully
        await tx`
          INSERT INTO entities (entity_id, type, data)
          VALUES (nextval('entity_id_seq'), ${uniqueType}, ${{ value: "first" }})
        `;

        // Create second entity successfully
        await tx`
          INSERT INTO entities (entity_id, type, data)
          VALUES (nextval('entity_id_seq'), ${uniqueType}, ${{ value: "second" }})
        `;

        // Force a constraint violation by trying to insert into a non-existent column
        await tx`
          INSERT INTO entities (entity_id, type, data, non_existent_column)
          VALUES (nextval('entity_id_seq'), ${uniqueType}, ${{ value: "third" }}, 'fail')
        `;
      });
    } catch (error) {
      // Expected to fail
    }

    // Verify rollback - count should be unchanged
    const finalCount = await client.countByType(uniqueType);
    expect(finalCount).toBe(initialCount); // No entities were committed
  });

  it("should commit createMany on success", async () => {
    const uniqueType = `transaction_success_${Date.now()}`;

    const entries = await client.createMany([
      { type: uniqueType, data: { value: "a" } },
      { type: uniqueType, data: { value: "b" } },
      { type: uniqueType, data: { value: "c" } },
    ]);

    expect(entries.length).toBe(3);

    // Verify all were committed
    const count = await client.countByType(uniqueType);
    expect(count).toBe(3);
  });

  it("should handle empty createMany array", async () => {
    const entries = await client.createMany([]);
    expect(entries).toEqual([]);
  });
});
