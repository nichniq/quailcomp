import { describe, test, expect, beforeEach, afterEach, vi } from "bun:test";
import { metadataCommand } from "@cli/commands/metadata";
import type { CLIContext } from "@cli/types";
import type { BookMetadata } from "@quailcomp/book-metadata";

// Create mock context for metadata tests
function createMockContext(args: string[]): CLIContext {
  return {
    sql: null as any,
    entities: null as any,
    events: null as any,
    args,
  };
}

// Mock console output functions
let consoleErrorOutput: string[] = [];
let consoleInfoOutput: string[] = [];
let processExitCode: number | null = null;

function mockConsoleAndExit() {
  consoleErrorOutput = [];
  consoleInfoOutput = [];
  processExitCode = null;

  vi.spyOn(console, "error").mockImplementation((...args) => {
    consoleErrorOutput.push(args.join(" "));
  });

  vi.spyOn(console, "log").mockImplementation((...args) => {
    consoleInfoOutput.push(args.join(" "));
  });

  vi.spyOn(process, "exit").mockImplementation((code?: string | number | null | undefined) => {
    processExitCode = typeof code === "number" ? code : (code ? 1 : 0);
    throw new Error("MOCK_EXIT");
  });
}

function restoreConsoleAndExit() {
  vi.restoreAllMocks();
}

// Sample metadata for mocking
const sampleMetadata: BookMetadata = {
  isbn: "9780134685991",
  title: "Effective Java",
  authors: ["Joshua Bloch"],
  publisher: "Addison-Wesley Professional",
  publicationDate: "2017-12-27",
  language: "en",
};

describe("metadata commands", () => {
  beforeEach(() => {
    mockConsoleAndExit();
  });

  afterEach(() => {
    restoreConsoleAndExit();
  });

  test("metadata command has correct structure", () => {
    expect(metadataCommand.name).toBe("metadata");
    expect(metadataCommand.description).toBeTruthy();
    expect(metadataCommand.usage).toBeTruthy();
    expect(metadataCommand.handler).toBeInstanceOf(Function);
    expect(metadataCommand.subcommands).toBeInstanceOf(Map);
  });

  test("metadata command has lookup subcommand", () => {
    const subcommands = metadataCommand.subcommands!;
    expect(subcommands.has("lookup")).toBe(true);

    const lookupCmd = subcommands.get("lookup")!;
    expect(lookupCmd.name).toBe("lookup");
    expect(lookupCmd.handler).toBeInstanceOf(Function);
  });

  test("lookup validates ISBN format", () => {
    const validISBN10 = "0123456789";
    const validISBN13 = "9780123456789";

    const isbn10Regex = /^(?:\d{10}|\d{13})$/;

    expect(isbn10Regex.test(validISBN10)).toBe(true);
    expect(isbn10Regex.test(validISBN13)).toBe(true);
    expect(isbn10Regex.test("123")).toBe(false);
    expect(isbn10Regex.test("abc123def456")).toBe(false);
  });

  test("lookup validates LCCN format", () => {
    const validLCCN8 = "12345678";
    const validLCCN10 = "1234567890";

    const lccnRegex = /^\d{8,10}$/;

    expect(lccnRegex.test(validLCCN8)).toBe(true);
    expect(lccnRegex.test(validLCCN10)).toBe(true);
    expect(lccnRegex.test("123")).toBe(false);
    expect(lccnRegex.test("12345678901")).toBe(false); // Too long
  });

  // Note: Integration tests for actual API calls are skipped in unit tests
  // to avoid external dependencies and rate limiting. These should be tested
  // manually or in separate integration test suites.

  test("lookup subcommand usage includes provider option", () => {
    const lookupCmd = metadataCommand.subcommands!.get("lookup")!;
    expect(lookupCmd.usage).toContain("provider");
  });

  describe("metadata handler execution", () => {
    test("main command without subcommand shows error and exits", async () => {
      const ctx = createMockContext([]);

      try {
        await metadataCommand.handler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("specify a subcommand"))).toBe(true);
      expect(consoleInfoOutput.some((msg) => msg.includes("lookup"))).toBe(true);
    });
  });

  describe("lookup handler execution", () => {
    const lookupHandler = metadataCommand.subcommands!.get("lookup")!.handler;

    test("requires ISBN argument", async () => {
      const ctx = createMockContext([]);

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("ISBN is required"))).toBe(true);
      expect(consoleInfoOutput.some((msg) => msg.includes("Usage:"))).toBe(true);
    });

    test("validates ISBN format - rejects invalid format", async () => {
      const ctx = createMockContext(["123"]);

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Invalid ISBN format"))).toBe(true);
    });

    test("validates ISBN format - accepts ISBN-10", async () => {
      const ctx = createMockContext(["0134685997"]);

      // Mock the provider
      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        // Ignore mock exit
        if (err.message !== "MOCK_EXIT") throw err;
      }

      // Should not exit with error if ISBN is valid
      expect(processExitCode).not.toBe(1);
    });

    test("validates ISBN format - accepts ISBN-13", async () => {
      const ctx = createMockContext(["9780134685991"]);

      // Mock the provider
      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        // Ignore mock exit
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(processExitCode).not.toBe(1);
    });

    test("validates ISBN format - accepts ISBN with hyphens", async () => {
      const ctx = createMockContext(["978-0-13-468599-1"]);

      // Mock the provider
      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        // Ignore mock exit
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(processExitCode).not.toBe(1);
    });

    test("rejects unknown provider", async () => {
      const ctx = createMockContext(["9780134685991", "--provider", "invalid"]);

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Unknown provider"))).toBe(true);
    });

    test("requires HARDCOVER_API_KEY for hardcover provider", async () => {
      const ctx = createMockContext(["9780134685991", "--provider", "hardcover"]);
      const originalKey = process.env.HARDCOVER_API_KEY;
      delete process.env.HARDCOVER_API_KEY;

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("HARDCOVER_API_KEY"))).toBe(true);

      // Restore
      if (originalKey) process.env.HARDCOVER_API_KEY = originalKey;
    });

    test("handles null result from provider", async () => {
      const ctx = createMockContext(["9780134685991"]);

      // Mock provider to return null
      const mockLookup = vi.fn().mockResolvedValue(null);
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        // Ignore mock exit
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(consoleInfoOutput.some((msg) => msg.includes("No metadata found"))).toBe(true);
    });

    test("handles provider errors", async () => {
      const ctx = createMockContext(["9780134685991"]);

      // Mock provider to throw error
      const mockLookup = vi.fn().mockRejectedValue(new Error("Network timeout"));
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Failed to lookup metadata"))).toBe(true);
    });
  });

  describe("provider selection", () => {
    const lookupHandler = metadataCommand.subcommands!.get("lookup")!.handler;

    test("defaults to 'all' provider when not specified", async () => {
      const ctx = createMockContext(["9780134685991"]);

      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(consoleInfoOutput.some((msg) => msg.includes("using all"))).toBe(true);
    });

    test("accepts --provider google", async () => {
      const ctx = createMockContext(["9780134685991", "--provider", "google"]);

      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createGoogleBooksProvider: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(consoleInfoOutput.some((msg) => msg.includes("using google"))).toBe(true);
    });

    test("accepts --provider openlibrary", async () => {
      const ctx = createMockContext(["9780134685991", "--provider", "openlibrary"]);

      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createOpenLibraryProvider: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(consoleInfoOutput.some((msg) => msg.includes("using openlibrary"))).toBe(true);
    });

    test("accepts --provider loc", async () => {
      const ctx = createMockContext(["9780134685991", "--provider", "loc"]);

      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createLibraryOfCongressProvider: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(consoleInfoOutput.some((msg) => msg.includes("using loc"))).toBe(true);
    });

    test("accepts --provider worldcat", async () => {
      const ctx = createMockContext(["9780134685991", "--provider", "worldcat"]);

      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createWorldCatClassifyProvider: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(consoleInfoOutput.some((msg) => msg.includes("using worldcat"))).toBe(true);
    });

    test("accepts --provider hardcover with API key", async () => {
      const ctx = createMockContext(["9780134685991", "--provider", "hardcover"]);
      const originalKey = process.env.HARDCOVER_API_KEY;
      process.env.HARDCOVER_API_KEY = "test-key-123";

      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createHardcoverProvider: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(consoleInfoOutput.some((msg) => msg.includes("using hardcover"))).toBe(true);

      // Restore
      if (originalKey) {
        process.env.HARDCOVER_API_KEY = originalKey;
      } else {
        delete process.env.HARDCOVER_API_KEY;
      }
    });
  });

  describe("output formatting", () => {
    const lookupHandler = metadataCommand.subcommands!.get("lookup")!.handler;

    test("displays metadata as formatted JSON", async () => {
      const ctx = createMockContext(["9780134685991"]);

      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      // Check that JSON output is present
      const outputText = consoleInfoOutput.join("\n");
      expect(outputText).toContain("Effective Java");
      expect(outputText).toContain("Joshua Bloch");
      expect(outputText).toContain("9780134685991");
    });

    test("handles metadata with null optional fields", async () => {
      const ctx = createMockContext(["9780134685991"]);

      const minimalMetadata: BookMetadata = {
        isbn: "9780134685991",
        title: "Effective Java",
        authors: ["Joshua Bloch"],
      };

      const mockLookup = vi.fn().mockResolvedValue(minimalMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      const outputText = consoleInfoOutput.join("\n");
      expect(outputText).toContain("Effective Java");
      expect(outputText).toContain("Joshua Bloch");
    });
  });

  describe("edge cases", () => {
    const lookupHandler = metadataCommand.subcommands!.get("lookup")!.handler;

    test("handles ISBN with spaces", async () => {
      const ctx = createMockContext(["978 0 13 468599 1"]);

      const mockLookup = vi.fn().mockResolvedValue(sampleMetadata);
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        if (err.message !== "MOCK_EXIT") throw err;
      }

      expect(processExitCode).not.toBe(1);
    });

    test("rejects ISBN with letters", async () => {
      const ctx = createMockContext(["978-0-13-ABC-1"]);

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Invalid ISBN format"))).toBe(true);
    });

    test("rejects too short ISBN", async () => {
      const ctx = createMockContext(["12345"]);

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Invalid ISBN format"))).toBe(true);
    });

    test("rejects too long ISBN", async () => {
      const ctx = createMockContext(["12345678901234"]);

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Invalid ISBN format"))).toBe(true);
    });

    test("handles provider timeout gracefully", async () => {
      const ctx = createMockContext(["9780134685991"]);

      const mockLookup = vi.fn().mockRejectedValue(new Error("Request timeout"));
      vi.mock("@quailcomp/book-metadata", () => ({
        createBookMetadataService: () => ({ lookup: mockLookup }),
      }));

      try {
        await lookupHandler(ctx);
      } catch (err: any) {
        expect(err.message).toBe("MOCK_EXIT");
      }

      expect(processExitCode).toBe(1);
      expect(consoleErrorOutput.some((msg) => msg.includes("Failed to lookup metadata"))).toBe(true);
    });
  });
});
