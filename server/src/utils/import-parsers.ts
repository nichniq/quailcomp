/**
 * Import parsers for CSV, JSON, and XLSX formats
 *
 * Converts various file formats into BookEntitySnapshot objects
 * for bulk import operations.
 */

import type { BookEntitySnapshot } from "@domains/types/books";

/**
 * Parse CSV content into book entities
 *
 * Expected CSV format:
 * title,subtitle,author,isbn10,isbn13,lccn,note
 * "The Hobbit","","J.R.R. Tolkien","0547928246","9780547928241","","Great book"
 *
 * @param content - CSV file content as string
 * @returns Array of BookEntitySnapshot objects
 */
export function parseCSV(content: string): BookEntitySnapshot[] {
  const lines = content.trim().split("\n");

  if (lines.length === 0) {
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const books: BookEntitySnapshot[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      continue;
    }

    const values = parseCSVLine(line);
    const book: Partial<BookEntitySnapshot> = {};

    // Map CSV columns to book fields
    headers.forEach((header, index) => {
      const value = values[index]?.trim();

      if (value) {
        // Map common header names to book fields
        const normalizedHeader = header.toLowerCase().trim();

        switch (normalizedHeader) {
          case "title":
            book.title = value;
            break;
          case "subtitle":
            book.subtitle = value;
            break;
          case "author":
            book.author = value;
            break;
          case "series_id":
          case "seriesid":
          case "series":
          case "series id":
            book.series_id = value;
            break;
          case "isbn10":
          case "isbn-10":
            book.isbn10 = value;
            break;
          case "isbn13":
          case "isbn-13":
          case "isbn":
            book.isbn13 = value;
            break;
          case "lccn":
            book.lccn = value;
            break;
          case "note":
          case "notes":
            book.note = value;
            break;
        }
      }
    });

    books.push(book as BookEntitySnapshot);
  }

  return books;
}

/**
 * Parse a single CSV line, handling quoted values
 *
 * Handles:
 * - Comma-separated values
 * - Quoted values with commas: "value,with,commas"
 * - Escaped quotes: "value with ""quotes"""
 *
 * @param line - Single line from CSV
 * @returns Array of field values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add final field
  values.push(current);

  return values;
}

/**
 * Parse JSON content into book entities
 *
 * Expected format:
 * [
 *   { "title": "The Hobbit", "author": "J.R.R. Tolkien", ... },
 *   ...
 * ]
 *
 * @param content - JSON file content as string
 * @returns Array of BookEntitySnapshot objects
 */
export function parseJSON(content: string): BookEntitySnapshot[] {
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error("JSON content must be an array of books");
  }

  return parsed.map((item) => {
    // Validate that each item is an object
    if (typeof item !== "object" || item === null) {
      throw new Error("Each book must be an object");
    }

    // Extract valid book fields
    const book: Partial<BookEntitySnapshot> = {};

    if (typeof item.title === "string") book.title = item.title;
    if (typeof item.subtitle === "string") book.subtitle = item.subtitle;
    if (typeof item.author === "string") book.author = item.author;
    if (typeof item.series_id === "string") book.series_id = item.series_id;
    if (typeof item.isbn10 === "string") book.isbn10 = item.isbn10;
    if (typeof item.isbn13 === "string") book.isbn13 = item.isbn13;
    if (typeof item.lccn === "string") book.lccn = item.lccn;
    if (typeof item.note === "string") book.note = item.note;

    return book as BookEntitySnapshot;
  });
}

/**
 * Parse XLSX content into book entities
 *
 * Note: This requires the 'xlsx' library to be installed.
 * Format is similar to CSV - first row is headers, subsequent rows are data.
 *
 * @param buffer - XLSX file content as ArrayBuffer
 * @returns Array of BookEntitySnapshot objects
 */
export async function parseXLSX(
  buffer: ArrayBuffer
): Promise<BookEntitySnapshot[]> {
  try {
    // Dynamic import to avoid requiring xlsx when not needed
    const XLSX = await import("xlsx");

    // Parse workbook
    const workbook = XLSX.read(buffer, { type: "array" });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("XLSX file has no sheets");
    }

    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON (array of objects)
    const data = XLSX.utils.sheet_to_json(sheet, {
      raw: false, // Return formatted strings
      defval: "", // Default value for empty cells
    }) as Record<string, string>[];

    // Map to BookEntitySnapshot
    const books: BookEntitySnapshot[] = data.map((row) => {
      const book: Partial<BookEntitySnapshot> = {};

      // Map common column names (case-insensitive)
      Object.entries(row).forEach(([key, value]) => {
        const normalizedKey = key.toLowerCase().trim();
        const trimmedValue = value?.toString().trim();

        if (!trimmedValue) return;

        switch (normalizedKey) {
          case "title":
            book.title = trimmedValue;
            break;
          case "subtitle":
            book.subtitle = trimmedValue;
            break;
          case "author":
            book.author = trimmedValue;
            break;
          case "series_id":
          case "seriesid":
          case "series":
            book.series_id = trimmedValue;
            break;
          case "isbn10":
          case "isbn-10":
            book.isbn10 = trimmedValue;
            break;
          case "isbn13":
          case "isbn-13":
          case "isbn":
            book.isbn13 = trimmedValue;
            break;
          case "lccn":
            book.lccn = trimmedValue;
            break;
          case "note":
          case "notes":
            book.note = trimmedValue;
            break;
        }
      });

      return book as BookEntitySnapshot;
    });

    return books;
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Cannot find module 'xlsx'")
    ) {
      throw new Error(
        "XLSX parsing requires the 'xlsx' library. Install with: bun add xlsx"
      );
    }
    throw err;
  }
}
