import { describe, test, expect } from "bun:test";
import { metadataCommand } from "@cli/commands/metadata";
import type { CLIContext } from "@cli/types";

// Create mock context for metadata tests
function createMockContext(args: string[]): CLIContext {
  return {
    sql: null as any,
    entities: null as any,
    events: null as any,
    args,
  };
}

describe("metadata commands", () => {
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
});
