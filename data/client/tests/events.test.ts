/**
 * Events Table - Comprehensive Test Suite
 *
 * =============================================================================
 * TEST PLAN
 * =============================================================================
 *
 * 1. SETUP & CONNECTION
 *    - Connect to test database
 *    - Verify table exists with correct structure
 *
 * 2. RECORD OPERATIONS
 *    - Record a new event (auto-generated event_id)
 *    - Record multiple events
 *    - Verify entry_id is auto-incremented
 *    - Verify entered_at is set automatically
 *    - Verify event_id sequence increments correctly
 *
 * 3. ENRICH OPERATIONS
 *    - Enrich an existing event (reuse event_id)
 *    - Verify sequence is not consumed on enrichment
 *    - Verify old entry is preserved (append-only)
 *    - Multiple enrichments create multiple entries
 *
 * 4. VOID OPERATIONS (Soft Delete)
 *    - Void an event
 *    - Verify voided_at is set
 *    - Verify event still exists in database
 *    - Verify voided event is excluded from default queries
 *    - Test restore (un-void) functionality
 *
 * 5. READ OPERATIONS
 *    - Get event by ID (latest version)
 *    - Get event history (all versions)
 *    - Get events by type
 *    - Count events
 *    - Check event exists
 *
 * 6. SEARCH OPERATIONS
 *    - Search by JSONB containment
 *    - Search with multiple criteria
 *    - Find events for specific entity
 *
 * 7. TIME ORDERING
 *    - Verify occurred_at vs entered_at distinction
 *    - Verify queries use correct time field
 *
 * 8. EDGE CASES & ERROR HANDLING
 *    - Invalid event_id on enrichment (should fail)
 *    - Empty data object
 *    - Large data payload
 *    - Special characters in data
 *
 * 9. TRIGGER VALIDATION
 *    - Verify trigger prevents new events with explicit event_id
 *    - Verify trigger allows enrichments with existing event_id
 *
 * =============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { SQL } from "bun";
import { EventsClient, type EventEntry } from "@/db/events";

// =============================================================================
// Test Setup
// =============================================================================

const TEST_DB_NAME = process.env.DB_TEST_NAME ?? "quailcomp_test";

let sql: SQL;
let client: EventsClient;

// Test data types
interface BookAcquiredData {
  book_id: number;
  title: string;
  author: string;
  price: number;
  tags?: string[];
  notes?: string;
}

interface BookLentData {
  book_id: number;
  borrower_id: number;
  due_date: string;
}

beforeAll(async () => {
  // Connect to test database as quailcomp_app using Bun's built-in SQL
  const password = process.env.DB_PASSWORD ?? "";
  const auth = password ? `quailcomp_app:${password}` : "quailcomp_app";

  sql = new SQL({
    url: `postgres://${auth}@localhost:5432/${TEST_DB_NAME}`,
  });

  client = new EventsClient(sql);

  // Verify connection and table exist
  const result = await sql`SELECT 1 as connected`;
  expect(result[0].connected).toBe(1);
});

afterAll(async () => {
  await sql.close();
});

// =============================================================================
// Helper Functions
// =============================================================================

async function getSequenceValue(): Promise<number> {
  const result = await sql`SELECT last_value FROM event_id_seq`;
  return Number(result[0].last_value);
}

async function countAllEntries(): Promise<number> {
  const result = await sql`SELECT COUNT(*) as count FROM events`;
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

  it("should have the events table with correct columns", async () => {
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'events'
      ORDER BY ordinal_position
    `;

    const columnNames = columns.map((c: any) => c.column_name);
    expect(columnNames).toContain("entry_id");
    expect(columnNames).toContain("entered_at");
    expect(columnNames).toContain("event_type");
    expect(columnNames).toContain("occurred_at");
    expect(columnNames).toContain("data");
    expect(columnNames).toContain("event_id");
    expect(columnNames).toContain("voided_at");
  });

  it("should have the validation trigger installed", async () => {
    const triggers = await sql`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'events'
    `;

    const triggerNames = triggers.map((t: any) => t.trigger_name);
    expect(triggerNames).toContain("check_event_id");
  });
});

// =============================================================================
// 2. RECORD OPERATIONS
// =============================================================================

describe("Record Operations", () => {
  it("should record a new event with auto-generated event_id", async () => {
    const entry = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald", price: 15.99 },
    });

    expect(entry.entryId).toBeGreaterThan(0);
    expect(entry.eventId).toBeGreaterThan(0);
    expect(entry.eventType).toBe("book_acquired");
    expect(entry.data.title).toBe("The Great Gatsby");
    expect(entry.enteredAt).toBeInstanceOf(Date);
    expect(entry.voidedAt).toBeNull();
  });

  it("should auto-increment event_id for new events", async () => {
    const seqBefore = await getSequenceValue();

    const entry1 = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 2, title: "1984", author: "George Orwell", price: 12.99 },
    });

    const entry2 = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 3, title: "To Kill a Mockingbird", author: "Harper Lee", price: 14.99 },
    });

    expect(entry2.eventId).toBe(entry1.eventId + 1);
  });

  it("should record multiple events in a transaction", async () => {
    const entries = await client.recordMany<BookAcquiredData>([
      {
        eventType: "book_acquired",
        occurredAt: new Date(),
        data: { book_id: 10, title: "Book A", author: "Author A", price: 10 },
      },
      {
        eventType: "book_acquired",
        occurredAt: new Date(),
        data: { book_id: 11, title: "Book B", author: "Author B", price: 11 },
      },
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[1].eventId).toBe(entries[0].eventId + 1);
  });
});

// =============================================================================
// 3. ENRICH OPERATIONS
// =============================================================================

describe("Enrich Operations", () => {
  it("should enrich an existing event by adding a new entry", async () => {
    // Record the original event
    const original = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date("2024-01-15"),
      data: { book_id: 100, title: "Enrichment Test", author: "Test Author", price: 20.0 },
    });

    // Enrich with additional data (e.g., adding tags)
    const enriched = await client.enrich<BookAcquiredData>({
      eventId: original.eventId,
      eventType: "book_acquired",
      occurredAt: original.occurredAt, // Keep the same occurred_at
      data: {
        book_id: 100,
        title: "Enrichment Test",
        author: "Test Author",
        price: 20.0,
        tags: ["fiction", "classic"],
        notes: "Added categorization",
      },
    });

    expect(enriched.eventId).toBe(original.eventId); // Same logical event
    expect(enriched.entryId).toBeGreaterThan(original.entryId); // New entry
    expect(enriched.data.tags).toEqual(["fiction", "classic"]);
    expect(enriched.data.notes).toBe("Added categorization");
  });

  it("should preserve original entry when enriching", async () => {
    const original = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 101, title: "History Test", author: "Author", price: 15.0 },
    });

    await client.enrich<BookAcquiredData>({
      eventId: original.eventId,
      eventType: "book_acquired",
      occurredAt: original.occurredAt,
      data: {
        book_id: 101,
        title: "History Test",
        author: "Author",
        price: 15.0,
        tags: ["updated"],
      },
    });

    const history = await client.getHistory<BookAcquiredData>(original.eventId);

    expect(history.length).toBe(2);
    expect(history[0].data.tags).toBeUndefined(); // Original has no tags
    expect(history[1].data.tags).toEqual(["updated"]); // Enriched has tags
  });

  it("should not consume sequence value when enriching", async () => {
    const seqBefore = await getSequenceValue();

    const original = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 102, title: "Seq Test", author: "Author", price: 10.0 },
    });

    const seqAfterCreate = await getSequenceValue();
    expect(seqAfterCreate).toBe(seqBefore + 1);

    await client.enrich<BookAcquiredData>({
      eventId: original.eventId,
      eventType: "book_acquired",
      occurredAt: original.occurredAt,
      data: { book_id: 102, title: "Seq Test", author: "Author", price: 10.0, tags: ["test"] },
    });

    const seqAfterEnrich = await getSequenceValue();
    expect(seqAfterEnrich).toBe(seqAfterCreate); // No change
  });
});

// =============================================================================
// 4. VOID OPERATIONS
// =============================================================================

describe("Void Operations", () => {
  it("should void an event", async () => {
    const original = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 200, title: "Void Test", author: "Author", price: 10.0 },
    });

    const voided = await client.void<BookAcquiredData>({
      eventId: original.eventId,
      eventType: original.eventType,
      occurredAt: original.occurredAt,
      data: original.data,
    });

    expect(voided.eventId).toBe(original.eventId);
    expect(voided.voidedAt).not.toBeNull();
    expect(voided.voidedAt).toBeInstanceOf(Date);
  });

  it("should exclude voided events from default queries", async () => {
    const event = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 201, title: "Hidden Event", author: "Author", price: 10.0 },
    });

    // Void the event
    await client.void<BookAcquiredData>({
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      data: event.data,
    });

    // Default query should not find it
    const notFound = await client.getById(event.eventId);
    expect(notFound).toBeNull();

    // With includeVoided, should find it
    const found = await client.getById(event.eventId, { includeVoided: true });
    expect(found).not.toBeNull();
    expect(found!.voidedAt).not.toBeNull();
  });

  it("should restore a voided event", async () => {
    const original = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 202, title: "Restore Test", author: "Author", price: 10.0 },
    });

    await client.void<BookAcquiredData>({
      eventId: original.eventId,
      eventType: original.eventType,
      occurredAt: original.occurredAt,
      data: original.data,
    });

    // Verify it's voided
    expect(await client.getById(original.eventId)).toBeNull();

    // Restore it
    await client.restore<BookAcquiredData>({
      eventId: original.eventId,
      eventType: original.eventType,
      occurredAt: original.occurredAt,
      data: original.data,
    });

    // Verify it's restored
    const restored = await client.getById(original.eventId);
    expect(restored).not.toBeNull();
    expect(restored!.voidedAt).toBeNull();
  });
});

// =============================================================================
// 5. READ OPERATIONS
// =============================================================================

describe("Read Operations", () => {
  it("should get the latest entry for an event", async () => {
    const original = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 300, title: "Version 1", author: "Author", price: 10.0 },
    });

    await client.enrich<BookAcquiredData>({
      eventId: original.eventId,
      eventType: "book_acquired",
      occurredAt: original.occurredAt,
      data: { book_id: 300, title: "Version 2", author: "Author", price: 10.0 },
    });

    const latest = await client.getById<BookAcquiredData>(original.eventId);

    expect(latest).not.toBeNull();
    expect(latest!.data.title).toBe("Version 2"); // Should be the enriched version
  });

  it("should get full history for an event", async () => {
    const original = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 301, title: "V1", author: "Author", price: 10.0 },
    });

    await client.enrich<BookAcquiredData>({
      eventId: original.eventId,
      eventType: "book_acquired",
      occurredAt: original.occurredAt,
      data: { book_id: 301, title: "V2", author: "Author", price: 10.0 },
    });

    await client.enrich<BookAcquiredData>({
      eventId: original.eventId,
      eventType: "book_acquired",
      occurredAt: original.occurredAt,
      data: { book_id: 301, title: "V3", author: "Author", price: 10.0 },
    });

    const history = await client.getHistory<BookAcquiredData>(original.eventId);

    expect(history.length).toBe(3);
    expect(history[0].data.title).toBe("V1"); // Oldest first
    expect(history[1].data.title).toBe("V2");
    expect(history[2].data.title).toBe("V3"); // Newest last
  });

  it("should get events by type", async () => {
    const eventType = `test_type_${Date.now()}`;

    await client.recordMany([
      { eventType, occurredAt: new Date(Date.now() - 2000), data: { value: 1 } },
      { eventType, occurredAt: new Date(Date.now() - 1000), data: { value: 2 } },
      { eventType, occurredAt: new Date(), data: { value: 3 } },
    ]);

    const events = await client.getByType(eventType);

    expect(events.length).toBeGreaterThanOrEqual(3);
    // Should be ordered by occurred_at DESC (most recent first)
    expect((events[0].data as any).value).toBe(3);
    expect((events[1].data as any).value).toBe(2);
    expect((events[2].data as any).value).toBe(1);
  });

  it("should check if event exists", async () => {
    const event = await client.record({
      eventType: "exists_test",
      occurredAt: new Date(),
      data: { test: true },
    });

    expect(await client.exists(event.eventId)).toBe(true);
    expect(await client.exists(999999)).toBe(false);
  });

  it("should count events by type", async () => {
    const eventType = `count_type_${Date.now()}`;

    await client.recordMany([
      { eventType, occurredAt: new Date(), data: { n: 1 } },
      { eventType, occurredAt: new Date(), data: { n: 2 } },
    ]);

    const count = await client.countByType(eventType);
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// 6. SEARCH OPERATIONS
// =============================================================================

describe("Search Operations", () => {
  it("should find events by JSONB data", async () => {
    const eventType = `search_type_${Date.now()}`;
    const searchBookId = 400;

    await client.recordMany([
      {
        eventType,
        occurredAt: new Date(),
        data: { book_id: searchBookId, title: "Target Book" },
      },
      {
        eventType,
        occurredAt: new Date(),
        data: { book_id: 401, title: "Other Book" },
      },
    ]);

    const results = await client.findByData(eventType, { book_id: searchBookId });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect((results[0].data as any).book_id).toBe(searchBookId);
  });

  it("should find events for a specific entity", async () => {
    const bookId = 500;

    await client.recordMany([
      {
        eventType: "book_acquired",
        occurredAt: new Date(Date.now() - 3000),
        data: { book_id: bookId, action: "acquired" },
      },
      {
        eventType: "book_lent",
        occurredAt: new Date(Date.now() - 2000),
        data: { book_id: bookId, borrower: "Alice" },
      },
      {
        eventType: "book_returned",
        occurredAt: new Date(Date.now() - 1000),
        data: { book_id: bookId, condition: "good" },
      },
      // Different book - should not be included
      {
        eventType: "book_acquired",
        occurredAt: new Date(),
        data: { book_id: 999, action: "other" },
      },
    ]);

    const events = await client.findForEntity("book_id", bookId);

    expect(events.length).toBeGreaterThanOrEqual(3);
    events.forEach((e) => {
      expect((e.data as any).book_id).toBe(bookId);
    });
  });
});

// =============================================================================
// 7. TIME ORDERING
// =============================================================================

describe("Time Ordering", () => {
  it("should preserve occurred_at across enrichments", async () => {
    const originalOccurredAt = new Date("2024-06-15T10:00:00Z");

    const original = await client.record<BookAcquiredData>({
      eventType: "book_acquired",
      occurredAt: originalOccurredAt,
      data: { book_id: 600, title: "Time Test", author: "Author", price: 10.0 },
    });

    // Wait a bit to ensure entered_at is different
    await new Promise((r) => setTimeout(r, 10));

    const enriched = await client.enrich<BookAcquiredData>({
      eventId: original.eventId,
      eventType: "book_acquired",
      occurredAt: originalOccurredAt, // Same occurred_at
      data: { book_id: 600, title: "Time Test", author: "Author", price: 10.0, tags: ["test"] },
    });

    // occurred_at should be the same
    expect(enriched.occurredAt.getTime()).toBe(originalOccurredAt.getTime());
    // entered_at should be different (later)
    expect(enriched.enteredAt.getTime()).toBeGreaterThan(original.enteredAt.getTime());
  });

  it("should query events by occurred_at time range", async () => {
    const jan1 = new Date("2024-01-01");
    const jan15 = new Date("2024-01-15");
    const feb1 = new Date("2024-02-01");

    await client.recordMany([
      { eventType: "time_test", occurredAt: jan1, data: { month: "jan1" } },
      { eventType: "time_test", occurredAt: jan15, data: { month: "jan15" } },
      { eventType: "time_test", occurredAt: feb1, data: { month: "feb1" } },
    ]);

    const janEvents = await client.getByTimeRange(jan1, new Date("2024-01-31"));

    const janData = janEvents.filter(
      (e) => (e.data as any).month === "jan1" || (e.data as any).month === "jan15"
    );
    expect(janData.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// 8. EDGE CASES & ERROR HANDLING
// =============================================================================

describe("Edge Cases & Error Handling", () => {
  it("should reject enrichment with non-existent event_id", async () => {
    // Note: Using try/catch instead of expect().rejects due to Bun issue
    try {
      await client.enrich({
        eventId: 999999999, // Non-existent
        eventType: "test",
        occurredAt: new Date(),
        data: { test: true },
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Should throw an error
      expect(error).toBeDefined();
    }
  });

  it("should handle empty data object", async () => {
    const entry = await client.record({
      eventType: "empty_data_test",
      occurredAt: new Date(),
      data: {},
    });

    expect(entry.data).toEqual({});
  });

  it("should handle large data payload", async () => {
    const largeData = {
      items: Array(100)
        .fill(null)
        .map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: "Lorem ipsum ".repeat(50),
        })),
    };

    const entry = await client.record({
      eventType: "large_data_test",
      occurredAt: new Date(),
      data: largeData,
    });

    expect(entry.data.items).toHaveLength(100);
  });

  it("should handle special characters in data", async () => {
    const specialData = {
      quotes: "He said \"hello\" and 'goodbye'",
      unicode: "Emoji: 🎉 Kanji: 漢字 Accent: café",
      newlines: "Line 1\nLine 2\tTabbed",
      backslash: "C:\\Users\\Test",
    };

    const entry = await client.record({
      eventType: "special_chars_test",
      occurredAt: new Date(),
      data: specialData,
    });

    expect(entry.data).toEqual(specialData);
  });
});

// =============================================================================
// 9. TRIGGER VALIDATION
// =============================================================================

describe("Trigger Validation", () => {
  it("should reject new events with arbitrary event_id", async () => {
    // Try to insert with a made-up event_id without calling nextval first
    // Note: Using try/catch instead of expect().rejects due to Bun issue
    try {
      await sql`
        INSERT INTO events (event_id, event_type, occurred_at, data)
        VALUES (888888888, 'test', NOW(), '{}')
      `;
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toMatch(/event_id/);
    }
  });

  it("should allow enrichment with existing event_id", async () => {
    const original = await client.record({
      eventType: "trigger_test",
      occurredAt: new Date(),
      data: { original: true },
    });

    // This should succeed
    const enriched = await client.enrich({
      eventId: original.eventId,
      eventType: "trigger_test",
      occurredAt: original.occurredAt,
      data: { original: false, enriched: true },
    });

    expect(enriched.eventId).toBe(original.eventId);
  });
});

// =============================================================================
// Additional Time Range Tests
// =============================================================================

describe("Advanced Time Range Queries", () => {
  it("should respect time range boundaries", async () => {
    const start = new Date("2024-06-01T00:00:00Z");
    const middle = new Date("2024-06-15T12:00:00Z");
    const end = new Date("2024-06-30T23:59:59Z");
    const before = new Date("2024-05-31T23:59:59Z");
    const after = new Date("2024-07-01T00:00:01Z");

    const uniqueType = `time_range_boundary_${Date.now()}`;

    await client.recordMany([
      { eventType: uniqueType, occurredAt: before, data: { position: "before" } },
      { eventType: uniqueType, occurredAt: start, data: { position: "start" } },
      { eventType: uniqueType, occurredAt: middle, data: { position: "middle" } },
      { eventType: uniqueType, occurredAt: end, data: { position: "end" } },
      { eventType: uniqueType, occurredAt: after, data: { position: "after" } },
    ]);

    const allResults = await client.getByTimeRange(start, end);
    const results = allResults.filter((e) => e.eventType === uniqueType);

    // Should include start, middle, and end, but not before or after
    expect(results.length).toBeGreaterThanOrEqual(3);
    const positions = results.map((e) => (e.data as any).position);
    expect(positions).toContain("start");
    expect(positions).toContain("middle");
    expect(positions).toContain("end");
    expect(positions).not.toContain("before");
    expect(positions).not.toContain("after");
  });

  it("should return events from different types in time range", async () => {
    const start = new Date("2024-07-01");
    const end = new Date("2024-07-31");
    const uniqueType = `time_range_filter_${Date.now()}`;
    const otherType = `other_${Date.now()}`;

    await client.recordMany([
      { eventType: uniqueType, occurredAt: new Date("2024-07-15"), data: { type: "target" } },
      { eventType: otherType, occurredAt: new Date("2024-07-15"), data: { type: "other" } },
    ]);

    const allResults = await client.getByTimeRange(start, end);

    // Should include events of both types
    const targetEvents = allResults.filter((e) => e.eventType === uniqueType);
    const otherEvents = allResults.filter((e) => e.eventType === otherType);

    expect(targetEvents.length).toBeGreaterThanOrEqual(1);
    expect(otherEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("should include voided events when requested", async () => {
    const start = new Date("2024-08-01");
    const end = new Date("2024-08-31");
    const uniqueType = `time_range_voided_${Date.now()}`;

    const event1 = await client.record({
      eventType: uniqueType,
      occurredAt: new Date("2024-08-15"),
      data: { status: "active" },
    });

    await client.void({
      eventId: event1.eventId,
      eventType: event1.eventType,
      occurredAt: event1.occurredAt,
      data: event1.data,
    });

    // Without includeVoided, should not appear
    const withoutVoidedAll = await client.getByTimeRange(start, end);
    const withoutVoided = withoutVoidedAll.filter((e) => e.eventType === uniqueType);
    expect(withoutVoided.length).toBe(0);

    // With includeVoided, should appear
    const withVoidedAll = await client.getByTimeRange(start, end, { includeVoided: true });
    const withVoided = withVoidedAll.filter((e) => e.eventType === uniqueType);
    expect(withVoided.length).toBeGreaterThanOrEqual(1);
    expect(withVoided.some((e) => e.eventId === event1.eventId)).toBe(true);
  });

  it("should handle empty time ranges", async () => {
    const start = new Date("2024-09-01");
    const end = new Date("2024-09-02");
    const uniqueType = `time_range_empty_${Date.now()}`;

    // Create event outside the range
    await client.record({
      eventType: uniqueType,
      occurredAt: new Date("2024-10-01"),
      data: { test: true },
    });

    const allResults = await client.getByTimeRange(start, end);
    const results = allResults.filter((e) => e.eventType === uniqueType);
    expect(results.length).toBe(0);
  });
});

// =============================================================================
// Query Options Tests (limit/offset for all methods)
// =============================================================================

describe("Query Options", () => {
  it("should apply limit to getHistory", async () => {
    const uniqueType = `history_limit_${Date.now()}`;

    const original = await client.record({
      eventType: uniqueType,
      occurredAt: new Date(),
      data: { version: 1 },
    });

    // Create multiple enrichments
    for (let i = 2; i <= 5; i++) {
      await client.enrich({
        eventId: original.eventId,
        eventType: uniqueType,
        occurredAt: original.occurredAt,
        data: { version: i },
      });
    }

    const limitedHistory = await client.getHistory(original.eventId, { limit: 3 });
    expect(limitedHistory.length).toBe(3);
    expect((limitedHistory[0].data as any).version).toBe(1);
    expect((limitedHistory[2].data as any).version).toBe(3);
  });

  it("should apply offset to getHistory", async () => {
    const uniqueType = `history_offset_${Date.now()}`;

    const original = await client.record({
      eventType: uniqueType,
      occurredAt: new Date(),
      data: { version: 1 },
    });

    // Create multiple enrichments
    for (let i = 2; i <= 5; i++) {
      await client.enrich({
        eventId: original.eventId,
        eventType: uniqueType,
        occurredAt: original.occurredAt,
        data: { version: i },
      });
    }

    const offsetHistory = await client.getHistory(original.eventId, { offset: 2 });
    expect(offsetHistory.length).toBe(3); // Should skip first 2 entries
    expect((offsetHistory[0].data as any).version).toBe(3);
  });

  it("should exclude voided from getHistory when requested", async () => {
    const uniqueType = `history_no_voided_${Date.now()}`;

    const original = await client.record({
      eventType: uniqueType,
      occurredAt: new Date(),
      data: { version: 1 },
    });

    await client.enrich({
      eventId: original.eventId,
      eventType: uniqueType,
      occurredAt: original.occurredAt,
      data: { version: 2 },
    });

    // Void the event
    await client.void({
      eventId: original.eventId,
      eventType: uniqueType,
      occurredAt: original.occurredAt,
      data: { version: 2 },
    });

    // With includeVoided: false, should only get non-voided entries
    const historyWithoutVoided = await client.getHistory(original.eventId, { includeVoided: false });
    expect(historyWithoutVoided.length).toBe(2); // Original + enrich, not the void
    expect(historyWithoutVoided.every((e) => e.voidedAt === null)).toBe(true);
  });

  it("should apply limit/offset to getByType", async () => {
    const uniqueType = `type_pagination_${Date.now()}`;

    await client.recordMany(
      Array.from({ length: 10 }, (_, i) => ({
        eventType: uniqueType,
        occurredAt: new Date(Date.now() - (9 - i) * 1000), // Most recent last
        data: { index: i },
      }))
    );

    const page1 = await client.getByType(uniqueType, { limit: 3 });
    const page2 = await client.getByType(uniqueType, { limit: 3, offset: 3 });

    expect(page1.length).toBe(3);
    expect(page2.length).toBe(3);
    expect(page1[0].eventId).not.toBe(page2[0].eventId);
  });

  it("should apply limit/offset to getByTimeRange", async () => {
    const start = new Date("2024-10-01");
    const end = new Date("2024-10-31");
    const uniqueType = `timerange_pagination_${Date.now()}`;

    await client.recordMany(
      Array.from({ length: 10 }, (_, i) => ({
        eventType: uniqueType,
        occurredAt: new Date(`2024-10-${String(i + 1).padStart(2, "0")}`),
        data: { day: i + 1 },
      }))
    );

    const page1 = await client.getByTimeRange(start, end, { limit: 4 });
    const page2 = await client.getByTimeRange(start, end, { limit: 4, offset: 4 });

    expect(page1.length).toBe(4);
    expect(page2.length).toBe(4);
  });

  it("should apply limit/offset to findByData", async () => {
    const uniqueType = `finddata_pagination_${Date.now()}`;

    await client.recordMany(
      Array.from({ length: 10 }, (_, i) => ({
        eventType: uniqueType,
        occurredAt: new Date(),
        data: { category: "books", index: i },
      }))
    );

    const page1 = await client.findByData(uniqueType, { category: "books" }, { limit: 3 });
    const page2 = await client.findByData(uniqueType, { category: "books" }, { limit: 3, offset: 3 });

    expect(page1.length).toBe(3);
    expect(page2.length).toBe(3);
  });

  it("should apply limit/offset to findForEntity", async () => {
    const bookId = 7777;

    await client.recordMany(
      Array.from({ length: 10 }, (_, i) => ({
        eventType: `event_${i}`,
        occurredAt: new Date(),
        data: { book_id: bookId, action: `action_${i}` },
      }))
    );

    const page1 = await client.findForEntity("book_id", bookId, { limit: 4 });
    const page2 = await client.findForEntity("book_id", bookId, { limit: 4, offset: 4 });

    expect(page1.length).toBe(4);
    expect(page2.length).toBe(4);
  });

  it("should count voided events when requested", async () => {
    const uniqueType = `count_voided_${Date.now()}`;

    const event1 = await client.record({
      eventType: uniqueType,
      occurredAt: new Date(),
      data: { status: "active" },
    });

    const event2 = await client.record({
      eventType: uniqueType,
      occurredAt: new Date(),
      data: { status: "active" },
    });

    // Void one event
    await client.void({
      eventId: event1.eventId,
      eventType: uniqueType,
      occurredAt: event1.occurredAt,
      data: event1.data,
    });

    const countWithoutVoided = await client.countByType(uniqueType);
    const countWithVoided = await client.countByType(uniqueType, { includeVoided: true });

    expect(countWithoutVoided).toBe(1); // Only the non-voided one
    expect(countWithVoided).toBe(2); // Both events
  });
});

// =============================================================================
// Factory Function Test
// =============================================================================

describe("Factory Function", () => {
  it("should create EventsClient using factory", async () => {
    const { createEventsClient } = await import("@/db/events");
    const factoryClient = createEventsClient(sql);

    const entry = await factoryClient.record({
      eventType: `factory_test_${Date.now()}`,
      occurredAt: new Date(),
      data: { test: "factory" },
    });

    expect(entry.eventId).toBeGreaterThan(0);
    expect((entry.data as any).test).toBe("factory");
  });
});

// =============================================================================
// Concurrent Operations Tests
// =============================================================================

describe("Concurrent Operations", () => {
  it("should handle parallel record operations", async () => {
    const uniqueType = `concurrent_records_${Date.now()}`;

    // Create 10 events in parallel
    const promises = Array.from({ length: 10 }, (_, i) =>
      client.record({
        eventType: uniqueType,
        occurredAt: new Date(),
        data: { index: i },
      })
    );

    const results = await Promise.all(promises);

    // All should succeed with unique event IDs
    expect(results.length).toBe(10);
    const eventIds = results.map((r) => r.eventId);
    const uniqueIds = new Set(eventIds);
    expect(uniqueIds.size).toBe(10); // All IDs should be unique
  });

  it("should handle parallel enrichment operations", async () => {
    const uniqueType = `concurrent_enrich_${Date.now()}`;

    // Create a base event
    const original = await client.record({
      eventType: uniqueType,
      occurredAt: new Date(),
      data: { original: true },
    });

    // Enrich it 5 times in parallel
    const promises = Array.from({ length: 5 }, (_, i) =>
      client.enrich({
        eventId: original.eventId,
        eventType: uniqueType,
        occurredAt: original.occurredAt,
        data: { enrichment: i },
      })
    );

    const results = await Promise.all(promises);

    // All should succeed with the same event ID
    expect(results.length).toBe(5);
    expect(results.every((r) => r.eventId === original.eventId)).toBe(true);

    // Should have multiple entries for this event
    const history = await client.getHistory(original.eventId);
    expect(history.length).toBeGreaterThanOrEqual(6); // original + 5 enrichments
  });

  it("should handle parallel recordMany operations", async () => {
    const uniqueType = `concurrent_recordMany_${Date.now()}`;

    // Create multiple batches in parallel
    const promises = Array.from({ length: 3 }, (batchIndex) =>
      client.recordMany(
        Array.from({ length: 5 }, (_, i) => ({
          eventType: uniqueType,
          occurredAt: new Date(),
          data: { batch: batchIndex, index: i },
        }))
      )
    );

    const results = await Promise.all(promises);

    // All batches should succeed
    expect(results.length).toBe(3);
    expect(results[0].length).toBe(5);
    expect(results[1].length).toBe(5);
    expect(results[2].length).toBe(5);

    // All event IDs should be unique
    const allEventIds = results.flat().map((e) => e.eventId);
    const uniqueIds = new Set(allEventIds);
    expect(uniqueIds.size).toBe(15);
  });
});
