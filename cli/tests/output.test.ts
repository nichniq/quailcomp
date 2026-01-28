import { describe, test, expect } from "bun:test";
import { formatTable, formatJSON } from "@cli/utils/output";

describe("formatTable", () => {
  test("formats table with headers and rows", () => {
    const headers = ["ID", "Name", "Email"];
    const rows = [
      ["1", "Alice", "alice@example.com"],
      ["2", "Bob", "bob@example.com"],
    ];

    const result = formatTable(headers, rows);

    expect(result).toContain("ID");
    expect(result).toContain("Name");
    expect(result).toContain("Email");
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
    expect(result).toContain("|"); // Table separator
    expect(result).toContain("-"); // Header separator
  });

  test("handles empty rows", () => {
    const headers = ["ID", "Name"];
    const rows: string[][] = [];

    const result = formatTable(headers, rows);

    expect(result).toBe("");
  });

  test("pads columns correctly", () => {
    const headers = ["Short", "VeryLongHeader"];
    const rows = [
      ["1", "A"],
      ["2", "B"],
    ];

    const result = formatTable(headers, rows);

    // VeryLongHeader should determine the column width
    expect(result).toContain("VeryLongHeader");
    expect(result).toContain(" 1 ");
    expect(result).toContain(" A ");
  });

  test("handles null and undefined values", () => {
    const headers = ["ID", "Value"];
    const rows = [
      ["1", null as unknown as string],
      ["2", undefined as unknown as string],
    ];

    const result = formatTable(headers, rows);

    expect(result).toContain("1");
    expect(result).toContain("2");
    // Should convert null/undefined to empty string
    expect(result).not.toContain("null");
    expect(result).not.toContain("undefined");
  });
});

describe("formatJSON", () => {
  test("formats JSON with pretty printing by default", () => {
    const data = { name: "Alice", age: 30 };
    const result = formatJSON(data);

    expect(result).toContain("{\n");
    expect(result).toContain("  \"name\": \"Alice\"");
    expect(result).toContain("  \"age\": 30");
  });

  test("formats JSON compactly when pretty is false", () => {
    const data = { name: "Alice", age: 30 };
    const result = formatJSON(data, false);

    expect(result).toBe('{"name":"Alice","age":30}');
    expect(result).not.toContain("\n");
  });

  test("handles nested objects", () => {
    const data = {
      user: {
        name: "Alice",
        address: {
          city: "NYC",
        },
      },
    };
    const result = formatJSON(data);

    expect(result).toContain("user");
    expect(result).toContain("name");
    expect(result).toContain("address");
    expect(result).toContain("city");
  });

  test("handles arrays", () => {
    const data = [1, 2, 3];
    const result = formatJSON(data);

    expect(result).toContain("[");
    expect(result).toContain("1");
    expect(result).toContain("2");
    expect(result).toContain("3");
    expect(result).toContain("]");
  });
});
