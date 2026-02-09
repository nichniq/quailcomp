import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "bun:test";
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

// Mock console output
let consoleOutput: string[] = [];
let consoleErrorOutput: string[] = [];
let processExitCode: number | null = null;

function mockConsoleAndExit() {
  consoleOutput = [];
  consoleErrorOutput = [];
  processExitCode = null;

  vi.spyOn(console, "log").mockImplementation((...args) => {
    consoleOutput.push(args.join(" "));
  });

  vi.spyOn(console, "error").mockImplementation((...args) => {
    consoleErrorOutput.push(args.join(" "));
  });

  vi.spyOn(process, "exit").mockImplementation((code?: string | number | null | undefined) => {
    processExitCode = typeof code === "number" ? code : (code ? 1 : 0);
    throw new Error("MOCK_EXIT");
  });
}

function restoreConsoleAndExit() {
  vi.restoreAllMocks();
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

  describe("list command", () => {
    beforeEach(() => {
      mockConsoleAndExit();
    });

    afterEach(() => {
      restoreConsoleAndExit();
    });

    test("displays books in table format", async () => {
      const context = createTestContext([]);
      const listHandler = booksCommand.subcommands!.get("list")!.handler;

      await listHandler(context);

      const output = consoleOutput.join("\n");
      // Should contain table headers
      expect(output).toContain("ID");
      expect(output).toContain("Title");
      expect(output).toContain("Author");
      expect(output).toContain("ISBN-13");
      // Should contain total count
      expect(output).toContain("Total:");
    });

    test("shows empty state when no books exist", async () => {
      // Create a fresh context with a unique type that has no books
      const uniqueType = `book_empty_test_${Date.now()}`;
      const context = createTestContext([]);

      // Temporarily override getByType to return empty array
      const originalGetByType = context.entities.getByType;
      context.entities.getByType = async () => [];

      const listHandler = booksCommand.subcommands!.get("list")!.handler;
      await listHandler(context);

      const output = consoleOutput.join("\n");
      expect(output).toContain("No books found");

      // Restore
      context.entities.getByType = originalGetByType;
    });

    test("excludes deleted books", async () => {
      // This is tested implicitly by the includeDeleted: false option
      // We can verify by checking that a deleted book doesn't appear
      const context = createTestContext([]);

      // Create and delete a book
      const entry = await context.entities.create<BookEntitySnapshot>({
        type: "book",
        data: { title: "Deleted Book" },
      });
      await context.entities.delete({
        entityId: entry.entityId,
        type: "book",
        data: entry.data,
      });

      const listHandler = booksCommand.subcommands!.get("list")!.handler;
      await listHandler(context);

      const output = consoleOutput.join("\n");
      // Should not contain the deleted book
      expect(output).not.toContain("Deleted Book");
    });

    test("handles database errors gracefully", async () => {
      const context = createTestContext([]);

      // Mock getByType to throw error
      const originalGetByType = context.entities.getByType;
      context.entities.getByType = async () => {
        throw new Error("Database connection failed");
      };

      const listHandler = booksCommand.subcommands!.get("list")!.handler;

      try {
        await listHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Failed to list books"))).toBe(true);

      // Restore
      context.entities.getByType = originalGetByType;
    });
  });

  describe("error paths", () => {
    beforeEach(() => {
      mockConsoleAndExit();
    });

    afterEach(() => {
      restoreConsoleAndExit();
    });

    test("main command without subcommand shows error", async () => {
      const context = createTestContext([]);

      try {
        await booksCommand.handler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("specify a subcommand"))).toBe(true);
    });

    test("show requires book ID", async () => {
      const context = createTestContext([]);
      const showHandler = booksCommand.subcommands!.get("show")!.handler;

      try {
        await showHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Book ID is required"))).toBe(true);
    });

    test("show rejects invalid ID format", async () => {
      const context = createTestContext(["not-a-number"]);
      const showHandler = booksCommand.subcommands!.get("show")!.handler;

      try {
        await showHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Invalid book ID"))).toBe(true);
    });

    test("show handles non-existent book", async () => {
      const context = createTestContext(["999999999"]);
      const showHandler = booksCommand.subcommands!.get("show")!.handler;

      try {
        await showHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Book not found"))).toBe(true);
    });

    test("add requires title", async () => {
      const context = createTestContext(["--author", "Some Author"]);
      const addHandler = booksCommand.subcommands!.get("add")!.handler;

      try {
        await addHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Title is required"))).toBe(true);
    });

    test("add rejects unknown options", async () => {
      const context = createTestContext(["--unknown-option", "value"]);
      const addHandler = booksCommand.subcommands!.get("add")!.handler;

      try {
        await addHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Unknown option"))).toBe(true);
    });

    test("update requires book ID", async () => {
      const context = createTestContext([]);
      const updateHandler = booksCommand.subcommands!.get("update")!.handler;

      try {
        await updateHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Book ID is required"))).toBe(true);
    });

    test("update rejects invalid ID format", async () => {
      const context = createTestContext(["not-a-number", "--title", "New Title"]);
      const updateHandler = booksCommand.subcommands!.get("update")!.handler;

      try {
        await updateHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Invalid book ID"))).toBe(true);
    });

    test("update handles non-existent book", async () => {
      const context = createTestContext(["999999999", "--title", "New Title"]);
      const updateHandler = booksCommand.subcommands!.get("update")!.handler;

      try {
        await updateHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Book not found"))).toBe(true);
    });

    test("update rejects unknown options", async () => {
      const context = createTestContext([String(testBookId), "--unknown-option", "value"]);
      const updateHandler = booksCommand.subcommands!.get("update")!.handler;

      try {
        await updateHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Unknown option"))).toBe(true);
    });

    test("delete requires book ID", async () => {
      const context = createTestContext([]);
      const deleteHandler = booksCommand.subcommands!.get("delete")!.handler;

      try {
        await deleteHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Book ID is required"))).toBe(true);
    });

    test("delete rejects invalid ID format", async () => {
      const context = createTestContext(["not-a-number"]);
      const deleteHandler = booksCommand.subcommands!.get("delete")!.handler;

      try {
        await deleteHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Invalid book ID"))).toBe(true);
    });

    test("delete handles non-existent book", async () => {
      const context = createTestContext(["999999999"]);
      const deleteHandler = booksCommand.subcommands!.get("delete")!.handler;

      try {
        await deleteHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Book not found"))).toBe(true);
    });

    test("delete rejects already deleted book", async () => {
      // Create and delete a book
      const context = createTestContext([]);
      const entry = await context.entities.create<BookEntitySnapshot>({
        type: "book",
        data: { title: "Already Deleted" },
      });
      await context.entities.delete({
        entityId: entry.entityId,
        type: "book",
        data: entry.data,
      });

      // Try to delete again
      const deleteContext = createTestContext([String(entry.entityId)]);
      const deleteHandler = booksCommand.subcommands!.get("delete")!.handler;

      try {
        await deleteHandler(deleteContext);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      // getById returns null for deleted books by default, so it says "not found"
      expect(consoleErrorOutput.some((msg) => msg.includes("Book not found"))).toBe(true);
    });

    test("history requires book ID", async () => {
      const context = createTestContext([]);
      const historyHandler = booksCommand.subcommands!.get("history")!.handler;

      try {
        await historyHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Book ID is required"))).toBe(true);
    });

    test("history rejects invalid ID format", async () => {
      const context = createTestContext(["not-a-number"]);
      const historyHandler = booksCommand.subcommands!.get("history")!.handler;

      try {
        await historyHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Invalid book ID"))).toBe(true);
    });

    test("history handles non-existent book", async () => {
      const context = createTestContext(["999999999"]);
      const historyHandler = booksCommand.subcommands!.get("history")!.handler;

      try {
        await historyHandler(context);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Book not found"))).toBe(true);
    });
  });
});
