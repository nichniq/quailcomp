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
 *    - Record a new event
 *    - Record multiple events in transaction
 *    - Verify recorded_at is set automatically
 *    - Verify event_id uniqueness
 *
 * 3. IMMUTABILITY ENFORCEMENT
 *    - Verify trigger prevents updates to events
 *    - Verify events cannot be modified after recording
 *
 * 4. READ OPERATIONS
 *    - Find event by ID
 *    - Find events by type
 *    - Find events by time range
 *    - Find events for specific entity
 *    - Find events by JSONB data criteria
 *    - Count events by type
 *    - Check event exists
 *
 * 5. TIME ORDERING
 *    - Verify occurred_at vs recorded_at distinction
 *    - Verify time-series queries work correctly
 *    - Verify events ordered by occurred_at (not recorded_at)
 *
 * 6. ENTITY RELATIONSHIPS
 *    - Find all events for a specific entity
 *    - Query events with multiple entity references
 *    - Verify JSONB containment queries work
 *
 * 7. EDGE CASES & ERROR HANDLING
 *    - Duplicate event_id (should fail)
 *    - Empty data object
 *    - Large data payload
 *    - Special characters in data
 *    - Future occurred_at dates
 *    - Past occurred_at dates (historical events)
 *
 * 8. INDEX EFFECTIVENESS
 *    - Queries use expected indexes
 *
 * =============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { SQL } from "bun";
import { EventsClient, type Event } from "../src/db/events";

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
}

interface BookLentData {
  book_id: number;
  borrower_id: number;
  due_date: string;
}

interface BookReturnedData {
  book_id: number;
  borrower_id: number;
  condition: string;
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

// Clean up test data between tests
beforeEach(async () => {
  // For tests, we'll work with unique event_ids to avoid conflicts
  // In a real setup, you might want to truncate tables between tests
});

// =============================================================================
// Helper Functions
// =============================================================================

async function countAllEvents(): Promise<number> {
  const result = await sql`SELECT COUNT(*) as count FROM events`;
  return Number(result[0].count);
}

function generateEventId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    expect(columnNames).toContain("event_id");
    expect(columnNames).toContain("event_type");
    expect(columnNames).toContain("occurred_at");
    expect(columnNames).toContain("data");
    expect(columnNames).toContain("recorded_at");
  });

  it("should have the immutability trigger installed", async () => {
    const triggers = await sql`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'events'
    `;

    const triggerNames = triggers.map((t: any) => t.trigger_name);
    expect(triggerNames).toContain("enforce_event_immutability");
  });

  it("should have the expected indexes", async () => {
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'events'
    `;

    const indexNames = indexes.map((i: any) => i.indexname);
    expect(indexNames).toContain("idx_events_occurred");
    expect(indexNames).toContain("idx_events_type_occurred");
    expect(indexNames).toContain("idx_events_data_gin");
  });
});

// =============================================================================
// 2. RECORD OPERATIONS
// =============================================================================

describe("Record Operations", () => {
  it("should record a new event", async () => {
    const eventId = generateEventId();
    const occurredAt = new Date();

    const event = await client.record<BookAcquiredData>({
      eventId,
      eventType: "book_acquired",
      occurredAt,
      data: {
        book_id: 1,
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        price: 15.99,
      },
    });

    expect(event.eventId).toBe(eventId);
    expect(event.eventType).toBe("book_acquired");
    expect(event.occurredAt).toEqual(occurredAt);
    expect(event.data.book_id).toBe(1);
    expect(event.data.title).toBe("The Great Gatsby");
    expect(event.recordedAt).toBeInstanceOf(Date);
    expect(event.recordedAt.getTime()).toBeGreaterThanOrEqual(occurredAt.getTime());
  });

  it("should record multiple events in a transaction", async () => {
    const events = await client.recordMany([
      {
        eventId: generateEventId(),
        eventType: "book_acquired",
        occurredAt: new Date(),
        data: { book_id: 2, title: "1984", author: "George Orwell", price: 12.99 },
      },
      {
        eventId: generateEventId(),
        eventType: "book_acquired",
        occurredAt: new Date(),
        data: { book_id: 3, title: "To Kill a Mockingbird", author: "Harper Lee", price: 14.99 },
      },
    ]);

    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("book_acquired");
    expect(events[1].eventType).toBe("book_acquired");
    expect(events[0].data.book_id).toBe(2);
    expect(events[1].data.book_id).toBe(3);
  });

  it("should auto-set recorded_at timestamp", async () => {
    const beforeRecord = new Date();

    const event = await client.record({
      eventId: generateEventId(),
      eventType: "book_lent",
      occurredAt: new Date(),
      data: { book_id: 1, borrower_id: 100, due_date: "2026-02-01" },
    });

    const afterRecord = new Date();

    expect(event.recordedAt).toBeInstanceOf(Date);
    expect(event.recordedAt.getTime()).toBeGreaterThanOrEqual(beforeRecord.getTime());
    expect(event.recordedAt.getTime()).toBeLessThanOrEqual(afterRecord.getTime());
  });

  it("should fail on duplicate event_id", async () => {
    const eventId = generateEventId();

    await client.record({
      eventId,
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 99, title: "Test Book", author: "Test Author", price: 10.0 },
    });

    // Attempting to record another event with the same ID should fail
    await expect(
      client.record({
        eventId,
        eventType: "book_acquired",
        occurredAt: new Date(),
        data: { book_id: 100, title: "Another Book", author: "Another Author", price: 20.0 },
      })
    ).rejects.toThrow();
  });
});

// =============================================================================
// 3. IMMUTABILITY ENFORCEMENT
// =============================================================================

describe("Immutability Enforcement", () => {
  it("should prevent updates to events via trigger", async () => {
    const eventId = generateEventId();

    await client.record({
      eventId,
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 50, title: "Original Title", author: "Original Author", price: 10.0 },
    });

    // Attempting to update the event should fail
    await expect(
      sql`
        UPDATE events
        SET event_type = 'book_modified'
        WHERE event_id = ${eventId}
      `
    ).rejects.toThrow(/Events are immutable/);
  });

  it("should prevent data field updates", async () => {
    const eventId = generateEventId();

    await client.record({
      eventId,
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 51, title: "Test Book", author: "Test Author", price: 15.0 },
    });

    // Attempting to update the data should fail
    await expect(
      sql`
        UPDATE events
        SET data = ${{ book_id: 51, title: "Modified Title", author: "Modified Author", price: 25.0 }}
        WHERE event_id = ${eventId}
      `
    ).rejects.toThrow(/Events are immutable/);
  });
});

// =============================================================================
// 4. READ OPERATIONS
// =============================================================================

describe("Read Operations", () => {
  it("should find event by ID", async () => {
    const eventId = generateEventId();

    await client.record<BookAcquiredData>({
      eventId,
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 10, title: "Test Book", author: "Test Author", price: 19.99 },
    });

    const found = await client.findById<BookAcquiredData>(eventId);

    expect(found).not.toBeNull();
    expect(found!.eventId).toBe(eventId);
    expect(found!.eventType).toBe("book_acquired");
    expect(found!.data.book_id).toBe(10);
  });

  it("should return null for non-existent event", async () => {
    const found = await client.findById("non_existent_id");
    expect(found).toBeNull();
  });

  it("should find events by type", async () => {
    const eventType = `book_acquired_${Date.now()}`;

    await client.recordMany([
      {
        eventId: generateEventId(),
        eventType,
        occurredAt: new Date(Date.now() - 3000),
        data: { book_id: 20, title: "Book 1", author: "Author 1", price: 10.0 },
      },
      {
        eventId: generateEventId(),
        eventType,
        occurredAt: new Date(Date.now() - 2000),
        data: { book_id: 21, title: "Book 2", author: "Author 2", price: 15.0 },
      },
      {
        eventId: generateEventId(),
        eventType,
        occurredAt: new Date(Date.now() - 1000),
        data: { book_id: 22, title: "Book 3", author: "Author 3", price: 20.0 },
      },
    ]);

    const events = await client.findByType<BookAcquiredData>(eventType);

    expect(events.length).toBeGreaterThanOrEqual(3);
    // Verify they're ordered by occurred_at DESC (most recent first)
    expect(events[0].data.book_id).toBe(22); // Most recent
    expect(events[1].data.book_id).toBe(21);
    expect(events[2].data.book_id).toBe(20); // Oldest
  });

  it("should find events by time range", async () => {
    const start = new Date(Date.now() - 10000);
    const middle = new Date(Date.now() - 5000);
    const end = new Date();

    const beforeRange = await client.record({
      eventId: generateEventId(),
      eventType: "book_lent",
      occurredAt: new Date(start.getTime() - 5000),
      data: { book_id: 30, borrower_id: 1, due_date: "2026-02-01" },
    });

    const inRange = await client.record({
      eventId: generateEventId(),
      eventType: "book_lent",
      occurredAt: middle,
      data: { book_id: 31, borrower_id: 2, due_date: "2026-02-02" },
    });

    const events = await client.findByTimeRange<BookLentData>(start, end);

    const eventIds = events.map((e) => e.eventId);
    expect(eventIds).toContain(inRange.eventId);
    expect(eventIds).not.toContain(beforeRange.eventId);
  });

  it("should find events for a specific entity", async () => {
    const bookId = 40;

    await client.recordMany([
      {
        eventId: generateEventId(),
        eventType: "book_acquired",
        occurredAt: new Date(Date.now() - 3000),
        data: { book_id: bookId, title: "Tracked Book", author: "Author", price: 25.0 },
      },
      {
        eventId: generateEventId(),
        eventType: "book_lent",
        occurredAt: new Date(Date.now() - 2000),
        data: { book_id: bookId, borrower_id: 5, due_date: "2026-02-15" },
      },
      {
        eventId: generateEventId(),
        eventType: "book_returned",
        occurredAt: new Date(Date.now() - 1000),
        data: { book_id: bookId, borrower_id: 5, condition: "good" },
      },
      // Different book - should not be included
      {
        eventId: generateEventId(),
        eventType: "book_acquired",
        occurredAt: new Date(),
        data: { book_id: 999, title: "Other Book", author: "Other Author", price: 10.0 },
      },
    ]);

    const events = await client.findForEntity("book_id", bookId);

    expect(events.length).toBeGreaterThanOrEqual(3);
    // All events should be for the same book
    events.forEach((event) => {
      expect(event.data).toHaveProperty("book_id", bookId);
    });
  });

  it("should find events by JSONB data criteria", async () => {
    const borrowerId = 100;

    await client.recordMany([
      {
        eventId: generateEventId(),
        eventType: "book_lent",
        occurredAt: new Date(Date.now() - 2000),
        data: { book_id: 60, borrower_id: borrowerId, due_date: "2026-03-01" },
      },
      {
        eventId: generateEventId(),
        eventType: "book_lent",
        occurredAt: new Date(Date.now() - 1000),
        data: { book_id: 61, borrower_id: borrowerId, due_date: "2026-03-02" },
      },
      // Different borrower - should not be included
      {
        eventId: generateEventId(),
        eventType: "book_lent",
        occurredAt: new Date(),
        data: { book_id: 62, borrower_id: 999, due_date: "2026-03-03" },
      },
    ]);

    const events = await client.findByData<BookLentData>({ borrower_id: borrowerId });

    expect(events.length).toBeGreaterThanOrEqual(2);
    events.forEach((event) => {
      expect(event.data.borrower_id).toBe(borrowerId);
    });
  });

  it("should count events by type", async () => {
    const eventType = `book_returned_${Date.now()}`;

    await client.recordMany([
      {
        eventId: generateEventId(),
        eventType,
        occurredAt: new Date(),
        data: { book_id: 70, borrower_id: 1, condition: "good" },
      },
      {
        eventId: generateEventId(),
        eventType,
        occurredAt: new Date(),
        data: { book_id: 71, borrower_id: 2, condition: "excellent" },
      },
    ]);

    const count = await client.countByType(eventType);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("should check if event exists", async () => {
    const eventId = generateEventId();

    await client.record({
      eventId,
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: { book_id: 80, title: "Existence Test", author: "Author", price: 10.0 },
    });

    const exists = await client.exists(eventId);
    expect(exists).toBe(true);

    const notExists = await client.exists("definitely_not_existing_id");
    expect(notExists).toBe(false);
  });
});

// =============================================================================
// 5. TIME ORDERING
// =============================================================================

describe("Time Ordering", () => {
  it("should distinguish between occurred_at and recorded_at", async () => {
    const occurredAt = new Date(Date.now() - 86400000); // 1 day ago

    const event = await client.record({
      eventId: generateEventId(),
      eventType: "book_acquired",
      occurredAt,
      data: { book_id: 90, title: "Historical Event", author: "Author", price: 10.0 },
    });

    // occurred_at is when it happened (in the past)
    expect(event.occurredAt).toEqual(occurredAt);

    // recorded_at is when we recorded it (now)
    expect(event.recordedAt.getTime()).toBeGreaterThan(occurredAt.getTime());
  });

  it("should order events by occurred_at, not recorded_at", async () => {
    const now = Date.now();

    // Record events in reverse chronological order of occurrence
    const event3 = await client.record({
      eventId: generateEventId(),
      eventType: "book_lent",
      occurredAt: new Date(now - 1000), // Most recent occurrence
      data: { book_id: 93, borrower_id: 1, due_date: "2026-02-03" },
    });

    const event1 = await client.record({
      eventId: generateEventId(),
      eventType: "book_lent",
      occurredAt: new Date(now - 3000), // Oldest occurrence
      data: { book_id: 91, borrower_id: 1, due_date: "2026-02-01" },
    });

    const event2 = await client.record({
      eventId: generateEventId(),
      eventType: "book_lent",
      occurredAt: new Date(now - 2000), // Middle occurrence
      data: { book_id: 92, borrower_id: 1, due_date: "2026-02-02" },
    });

    const events = await client.findByTimeRange<BookLentData>(
      new Date(now - 4000),
      new Date(now)
    );

    // Should be ordered by occurred_at DESC
    const relevantEvents = events.filter((e) =>
      [event1.eventId, event2.eventId, event3.eventId].includes(e.eventId)
    );

    expect(relevantEvents[0].eventId).toBe(event3.eventId); // Most recent
    expect(relevantEvents[1].eventId).toBe(event2.eventId);
    expect(relevantEvents[2].eventId).toBe(event1.eventId); // Oldest
  });
});

// =============================================================================
// 6. ENTITY RELATIONSHIPS
// =============================================================================

describe("Entity Relationships", () => {
  it("should track complete entity history across multiple event types", async () => {
    const bookId = 200;

    await client.recordMany([
      {
        eventId: generateEventId(),
        eventType: "book_acquired",
        occurredAt: new Date(Date.now() - 5000),
        data: { book_id: bookId, title: "Complete History", author: "Author", price: 30.0 },
      },
      {
        eventId: generateEventId(),
        eventType: "book_lent",
        occurredAt: new Date(Date.now() - 3000),
        data: { book_id: bookId, borrower_id: 10, due_date: "2026-02-20" },
      },
      {
        eventId: generateEventId(),
        eventType: "book_returned",
        occurredAt: new Date(Date.now() - 1000),
        data: { book_id: bookId, borrower_id: 10, condition: "good" },
      },
    ]);

    const events = await client.findForEntity("book_id", bookId);

    expect(events.length).toBeGreaterThanOrEqual(3);

    const eventTypes = new Set(events.map((e) => e.eventType));
    expect(eventTypes.has("book_acquired")).toBe(true);
    expect(eventTypes.has("book_lent")).toBe(true);
    expect(eventTypes.has("book_returned")).toBe(true);
  });

  it("should handle events with multiple entity references", async () => {
    const eventId = generateEventId();

    await client.record({
      eventId,
      eventType: "book_lent",
      occurredAt: new Date(),
      data: {
        book_id: 300,
        borrower_id: 400,
        librarian_id: 500,
        due_date: "2026-03-01",
      },
    });

    // Can find by any of the entity references
    const byBook = await client.findForEntity("book_id", 300);
    const byBorrower = await client.findForEntity("borrower_id", 400);
    const byLibrarian = await client.findForEntity("librarian_id", 500);

    expect(byBook.some((e) => e.eventId === eventId)).toBe(true);
    expect(byBorrower.some((e) => e.eventId === eventId)).toBe(true);
    expect(byLibrarian.some((e) => e.eventId === eventId)).toBe(true);
  });
});

// =============================================================================
// 7. EDGE CASES & ERROR HANDLING
// =============================================================================

describe("Edge Cases & Error Handling", () => {
  it("should handle empty data object", async () => {
    const event = await client.record({
      eventId: generateEventId(),
      eventType: "system_event",
      occurredAt: new Date(),
      data: {},
    });

    expect(event.data).toEqual({});
  });

  it("should handle large data payload", async () => {
    const largeData = {
      book_id: 999,
      metadata: {
        reviews: Array(100)
          .fill(null)
          .map((_, i) => ({
            reviewer: `Reviewer ${i}`,
            rating: Math.floor(Math.random() * 5) + 1,
            comment: "Lorem ipsum dolor sit amet ".repeat(10),
          })),
      },
    };

    const event = await client.record({
      eventId: generateEventId(),
      eventType: "book_reviewed",
      occurredAt: new Date(),
      data: largeData,
    });

    expect(event.data.metadata.reviews).toHaveLength(100);
  });

  it("should handle special characters in data", async () => {
    const event = await client.record({
      eventId: generateEventId(),
      eventType: "book_acquired",
      occurredAt: new Date(),
      data: {
        book_id: 888,
        title: "Book with 'quotes' and \"double quotes\"",
        author: "Author with émojis 🎉 and ñ",
        notes: "Line 1\nLine 2\tTabbed",
        price: 19.99,
      },
    });

    expect(event.data.title).toContain("'quotes'");
    expect(event.data.author).toContain("🎉");
    expect(event.data.notes).toContain("\n");
  });

  it("should handle future occurred_at dates", async () => {
    const futureDate = new Date(Date.now() + 86400000); // Tomorrow

    const event = await client.record({
      eventId: generateEventId(),
      eventType: "book_reserved",
      occurredAt: futureDate,
      data: { book_id: 777, borrower_id: 1, scheduled_date: "2026-12-31" },
    });

    expect(event.occurredAt).toEqual(futureDate);
  });

  it("should handle historical events with old occurred_at dates", async () => {
    const historicalDate = new Date("2020-01-01");

    const event = await client.record({
      eventId: generateEventId(),
      eventType: "book_acquired",
      occurredAt: historicalDate,
      data: { book_id: 666, title: "Historical Book", author: "Old Author", price: 5.0 },
    });

    expect(event.occurredAt).toEqual(historicalDate);
    expect(event.recordedAt.getTime()).toBeGreaterThan(historicalDate.getTime());
  });
});

// =============================================================================
// 8. PAGINATION
// =============================================================================

describe("Pagination", () => {
  it("should paginate results with limit and offset", async () => {
    const eventType = `paginated_${Date.now()}`;

    // Create 5 events
    await client.recordMany(
      Array(5)
        .fill(null)
        .map((_, i) => ({
          eventId: generateEventId(),
          eventType,
          occurredAt: new Date(Date.now() - (5 - i) * 1000),
          data: { book_id: 1000 + i, title: `Book ${i}`, author: "Author", price: 10.0 },
        }))
    );

    // Get first page
    const page1 = await client.findByType(eventType, { limit: 2, offset: 0 });
    expect(page1).toHaveLength(2);

    // Get second page
    const page2 = await client.findByType(eventType, { limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);

    // Ensure no overlap
    const page1Ids = page1.map((e) => e.eventId);
    const page2Ids = page2.map((e) => e.eventId);
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
  });
});
