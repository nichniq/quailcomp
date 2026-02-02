/**
 * Export formatters for CSV, JSON, and XLSX formats
 *
 * Converts BookEntitySnapshot objects into various file formats
 * for bulk export operations.
 */

import type { BookEntitySnapshot } from "@domains/types/books";

/**
 * Format books as CSV
 *
 * Output format:
 * title,subtitle,author,isbn10,isbn13,lccn,note
 * "The Hobbit","","J.R.R. Tolkien","0547928246","9780547928241","","Great book"
 *
 * @param books - Array of book entity snapshots with entityId
 * @returns CSV content as string
 */
export function exportCSV(
  books: Array<{ entityId: number; data: BookEntitySnapshot }>
): string {
  // CSV header
  const headers = [
    "entity_id",
    "title",
    "subtitle",
    "author",
    "series_id",
    "isbn10",
    "isbn13",
    "lccn",
    "note",
  ];

  const lines: string[] = [headers.join(",")];

  // Data rows
  for (const book of books) {
    const values = [
      book.entityId.toString(),
      escapeCSV(book.data.title ?? ""),
      escapeCSV(book.data.subtitle ?? ""),
      escapeCSV(book.data.author ?? ""),
      escapeCSV(book.data.series_id ?? ""),
      escapeCSV(book.data.isbn10 ?? ""),
      escapeCSV(book.data.isbn13 ?? ""),
      escapeCSV(book.data.lccn ?? ""),
      escapeCSV(book.data.note ?? ""),
    ];

    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Escape a CSV field value
 *
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes quotes by doubling them
 *
 * @param value - Field value to escape
 * @returns Escaped value
 */
function escapeCSV(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Format books as JSON
 *
 * Output format:
 * [
 *   { "entity_id": 1, "title": "The Hobbit", "author": "J.R.R. Tolkien", ... },
 *   ...
 * ]
 *
 * @param books - Array of book entity snapshots with entityId
 * @returns JSON content as string
 */
export function exportJSON(
  books: Array<{ entityId: number; data: BookEntitySnapshot }>
): string {
  const output = books.map((book) => ({
    entity_id: book.entityId,
    ...book.data,
  }));

  return JSON.stringify(output, null, 2);
}

/**
 * Format books as XLSX
 *
 * Note: This requires the 'xlsx' library to be installed.
 * Output is similar to CSV but in Excel format.
 *
 * @param books - Array of book entity snapshots with entityId
 * @returns XLSX file as Buffer
 */
export async function exportXLSX(
  books: Array<{ entityId: number; data: BookEntitySnapshot }>
): Promise<Buffer> {
  try {
    // Dynamic import to avoid requiring xlsx when not needed
    const XLSX = await import("xlsx");

    // Prepare data rows
    const rows = books.map((book) => ({
      entity_id: book.entityId,
      title: book.data.title ?? "",
      subtitle: book.data.subtitle ?? "",
      author: book.data.author ?? "",
      series_id: book.data.series_id ?? "",
      isbn10: book.data.isbn10 ?? "",
      isbn13: book.data.isbn13 ?? "",
      lccn: book.data.lccn ?? "",
      note: book.data.note ?? "",
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Books");

    // Write to buffer
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return Buffer.from(buffer);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Cannot find module 'xlsx'")
    ) {
      throw new Error(
        "XLSX export requires the 'xlsx' library. Install with: bun add xlsx"
      );
    }
    throw err;
  }
}
