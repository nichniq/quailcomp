import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConnection, createEntitiesClient } from "@quailcomp/data";
import type { CLIContext } from "@cli/types";
import { booksCommand } from "@cli/commands/books";
import type { BookEntitySnapshot } from "@domains/types/books";

// Use unique type names to avoid conflicts
const TEST_BOOK_TYPE = `book_cli_test_${Date.now()}`;

// Create test context
function createTestContext(args: string[]): CLIContext {
  const sql = getConnection();
  const entities = createEntitiesClient(sql);
  const events = null as any;

  return {
    sql,
    entities,
    events,
    args,
  };
}

describe("books commands", () => {
  let testBookId: number;

  // Create a test book before tests
  beforeAll(async () => {
    const context = createTestContext([]);
    const entry = await context.entities.create<BookEntitySnapshot>({
      type: TEST_BOOK_TYPE,
      data: {
        title: "Test Book",
        author: "Test Author",
        isbn13: "9781234567890",
      },
    });
    testBookId = entry.entityId;
  });

  // Clean up test book after tests
  afterAll(async () => {
    const context = createTestContext([]);
    const existing = await context.entities.getById<BookEntitySnapshot>(testBookId);
    if (existing && !existing.deletedAt) {
      await context.entities.delete({
        entityId: testBookId,
        type: TEST_BOOK_TYPE,
        data: existing.data,
      });
    }
  });

  test("books command has correct structure", () => {
    expect(booksCommand.name).toBe("books");
    expect(booksCommand.description).toBeTruthy();
    expect(booksCommand.usage).toBeTruthy();
    expect(booksCommand.handler).toBeInstanceOf(Function);
    expect(booksCommand.subcommands).toBeInstanceOf(Map);
  });

  test("books command has all expected subcommands", () => {
    const subcommands = booksCommand.subcommands!;
    expect(subcommands.has("list")).toBe(true);
    expect(subcommands.has("show")).toBe(true);
    expect(subcommands.has("add")).toBe(true);
    expect(subcommands.has("update")).toBe(true);
    expect(subcommands.has("delete")).toBe(true);
    expect(subcommands.has("history")).toBe(true);
  });

  test("show command retrieves book by ID", async () => {
    const context = createTestContext([String(testBookId)]);
    const showHandler = booksCommand.subcommands!.get("show")!.handler;

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    await showHandler(context);

    console.log = originalLog;

    // Verify output contains book data
    const output = logs.join("\n");
    expect(output).toContain(String(testBookId));
    expect(output).toContain("Test Book");
  });

  test("add command creates new book", async () => {
    const uniqueTitle = `CLI Test Book ${Date.now()}`;
    const context = createTestContext([
      "--title",
      uniqueTitle,
      "--author",
      "CLI Test Author",
    ]);

    const addHandler = booksCommand.subcommands!.get("add")!.handler;

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    await addHandler(context);

    console.log = originalLog;

    // Verify book was created
    const output = logs.join("\n");
    expect(output).toContain(uniqueTitle);
    expect(output).toContain("CLI Test Author");

    // Extract entity ID from output (format: "Book created with ID: <id>")
    const match = output.match(/ID: (\d+)/);
    expect(match).toBeTruthy();

    if (match) {
      const entityId = parseInt(match[1], 10);
      // Clean up the created book
      const entry = await context.entities.getById<BookEntitySnapshot>(entityId);
      if (entry) {
        await context.entities.delete({
          entityId,
          type: "book",
          data: entry.data,
        });
      }
    }
  });

  test("update command modifies existing book", async () => {
    const newAuthor = `Updated Author ${Date.now()}`;
    const context = createTestContext([String(testBookId), "--author", newAuthor]);

    const updateHandler = booksCommand.subcommands!.get("update")!.handler;

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    await updateHandler(context);

    console.log = originalLog;

    // Verify update succeeded
    const output = logs.join("\n");
    expect(output).toContain(newAuthor);

    // Verify book was actually updated in database
    const updated = await context.entities.getById<BookEntitySnapshot>(testBookId);
    expect(updated?.data.author).toBe(newAuthor);
  });

  test("history command shows all versions", async () => {
    const context = createTestContext([String(testBookId)]);
    const historyHandler = booksCommand.subcommands!.get("history")!.handler;

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    await historyHandler(context);

    console.log = originalLog;

    // Verify output shows history
    const output = logs.join("\n");
    expect(output).toContain("History");
    expect(output).toContain("Version");
    expect(output).toContain(String(testBookId));
  });

  test("delete command soft deletes book", async () => {
    // Create a book specifically for deletion test
    const context = createTestContext([]);
    const createEntry = await context.entities.create<BookEntitySnapshot>({
      type: "book", // Use the actual type that the books command expects
      data: {
        title: "Book to Delete",
        author: "Deletion Test",
      },
    });
    const deleteId = createEntry.entityId;

    // Delete the book
    const deleteContext = createTestContext([String(deleteId)]);
    const deleteHandler = booksCommand.subcommands!.get("delete")!.handler;

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    await deleteHandler(deleteContext);

    console.log = originalLog;

    // Verify deletion succeeded
    const output = logs.join("\n");
    expect(output).toContain("deleted");

    // Verify book is marked as deleted in database (need includeDeleted option)
    const deleted = await context.entities.getById<BookEntitySnapshot>(deleteId, {
      includeDeleted: true,
    });
    expect(deleted?.deletedAt).toBeTruthy();
  });
});
