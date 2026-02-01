/**
 * E2E Book Workflow Tests
 *
 * Tests complete book management flows:
 * - Creating books
 * - Reading book details
 * - Updating books
 * - Deleting books
 * - Listing books
 * - Metadata lookup integration
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createServer, type ServerInstance } from "@/server";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

let server: ServerInstance;
let baseUrl: string;
let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
  server = createServer({ port: 0 }); // Use random available port
  baseUrl = server.url.toString().replace(/\/$/, "");
});

afterAll(() => {
  server.stop();
});

/**
 * Helper to register a user and return their token
 */
async function registerUser(email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  return data.token;
}

describe("E2E Book Workflow", () => {
  const timestamp = Date.now();

  test("create book with minimal data", async () => {
    const token = await registerUser(`create-minimal-${timestamp}@example.com`, "password123");

    const response = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "Minimal Book",
        isbn: `978000100${timestamp}`,
      }),
    });

    expect(response.status).toBe(201);

    const { book } = await response.json();
    expect(book.type).toBe("book");
    expect(book.data.title).toBe("Minimal Book");
    expect(book.data.isbn).toBe(`978000100${timestamp}`);
    expect(book.entityId).toBeGreaterThan(0);
    expect(book.enteredAt).toBeDefined();
  });

  test("create book with full data", async () => {
    const token = await registerUser(`create-full-${timestamp}@example.com`, "password123");

    const bookData = {
      title: "Complete Book",
      isbn: `978000101${timestamp}`,
      authors: ["Author One", "Author Two"],
      publisher: "Test Publisher",
      publishedDate: "2024-01-15",
      description: "A complete book with all fields",
      pageCount: 350,
      categories: ["Fiction", "Adventure"],
      language: "en",
    };

    const response = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bookData),
    });

    expect(response.status).toBe(201);

    const { book } = await response.json();
    expect(book.data.title).toBe("Complete Book");
    expect(book.data.authors).toEqual(["Author One", "Author Two"]);
    expect(book.data.publisher).toBe("Test Publisher");
    expect(book.data.pageCount).toBe(350);
  });

  test("create book without authentication fails", async () => {
    const response = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Unauthenticated Book",
        isbn: `978000102${timestamp}`,
      }),
    });

    expect(response.status).toBe(401);
  });

  test("get book by ID", async () => {
    const token = await registerUser(`get-book-${timestamp}@example.com`, "password123");

    // Create book
    const createResponse = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "Get Me Book",
        isbn: `978000103${timestamp}`,
      }),
    });
    const { book: created } = await createResponse.json();

    // Get book
    const getResponse = await fetch(`${baseUrl}/books/${created.entityId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(getResponse.status).toBe(200);

    const { book } = await getResponse.json();
    expect(book.entityId).toBe(created.entityId);
    expect(book.data.title).toBe("Get Me Book");
  });

  test("get non-existent book returns 404", async () => {
    const token = await registerUser(`get-404-${timestamp}@example.com`, "password123");

    const response = await fetch(`${baseUrl}/books/999999999`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(404);
  });

  test("update book", async () => {
    const token = await registerUser(`update-book-${timestamp}@example.com`, "password123");

    // Create book
    const createResponse = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "Original Title",
        isbn: `978000104${timestamp}`,
        pageCount: 100,
      }),
    });
    const { book: created } = await createResponse.json();

    // Update book
    const updateResponse = await fetch(`${baseUrl}/books/${created.entityId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "Updated Title",
        pageCount: 150,
        publisher: "New Publisher",
      }),
    });

    expect(updateResponse.status).toBe(200);

    const { book: updated } = await updateResponse.json();
    expect(updated.data.title).toBe("Updated Title");
    expect(updated.data.pageCount).toBe(150);
    expect(updated.data.publisher).toBe("New Publisher");
    expect(updated.data.isbn).toBe(`978000104${timestamp}`); // Preserved
  });

  test("update preserves unmodified fields", async () => {
    const token = await registerUser(`update-preserve-${timestamp}@example.com`, "password123");

    // Create book with multiple fields
    const createResponse = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "Preserve Test",
        isbn: `978000105${timestamp}`,
        authors: ["Author One"],
        publisher: "Original Publisher",
        pageCount: 200,
      }),
    });
    const { book: created } = await createResponse.json();

    // Update only title
    const updateResponse = await fetch(`${baseUrl}/books/${created.entityId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "New Title Only",
      }),
    });

    const { book: updated } = await updateResponse.json();
    expect(updated.data.title).toBe("New Title Only");
    expect(updated.data.isbn).toBe(`978000105${timestamp}`);
    expect(updated.data.authors).toEqual(["Author One"]);
    expect(updated.data.publisher).toBe("Original Publisher");
    expect(updated.data.pageCount).toBe(200);
  });

  test("delete book (soft delete)", async () => {
    const token = await registerUser(`delete-book-${timestamp}@example.com`, "password123");

    // Create book
    const createResponse = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "Delete Me",
        isbn: `978000106${timestamp}`,
      }),
    });
    const { book: created } = await createResponse.json();

    // Delete book
    const deleteResponse = await fetch(`${baseUrl}/books/${created.entityId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(deleteResponse.status).toBe(200);

    // Verify book is soft-deleted (has deletedAt)
    const { book: deleted } = await deleteResponse.json();
    expect(deleted.deletedAt).toBeDefined();
    expect(deleted.deletedAt).not.toBeNull();

    // Getting deleted book should return 404 by default
    const getResponse = await fetch(`${baseUrl}/books/${created.entityId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getResponse.status).toBe(404);
  });

  test("list books returns user's books", async () => {
    const token = await registerUser(`list-books-${timestamp}@example.com`, "password123");

    // Create multiple books
    const book1Response = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "List Book 1",
        isbn: `978000107${timestamp}`,
      }),
    });
    const { book: book1 } = await book1Response.json();

    const book2Response = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "List Book 2",
        isbn: `978000108${timestamp}`,
      }),
    });
    const { book: book2 } = await book2Response.json();

    // List books
    const listResponse = await fetch(`${baseUrl}/books`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(listResponse.status).toBe(200);

    const { books } = await listResponse.json();
    expect(books.length).toBeGreaterThanOrEqual(2);
    expect(books.some((b: any) => b.entityId === book1.entityId)).toBe(true);
    expect(books.some((b: any) => b.entityId === book2.entityId)).toBe(true);
  });

  test("list books without authentication fails", async () => {
    const response = await fetch(`${baseUrl}/books`);
    expect(response.status).toBe(401);
  });

  test("complete CRUD workflow", async () => {
    const token = await registerUser(`crud-workflow-${timestamp}@example.com`, "password123");

    // Create
    const createResponse = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "CRUD Test Book",
        isbn: `978000109${timestamp}`,
        pageCount: 100,
      }),
    });
    expect(createResponse.status).toBe(201);
    const { book: created } = await createResponse.json();
    const bookId = created.entityId;

    // Read
    const readResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(readResponse.status).toBe(200);
    const { book: read } = await readResponse.json();
    expect(read.data.title).toBe("CRUD Test Book");

    // Update
    const updateResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "CRUD Updated Book",
        pageCount: 200,
      }),
    });
    expect(updateResponse.status).toBe(200);
    const { book: updated } = await updateResponse.json();
    expect(updated.data.title).toBe("CRUD Updated Book");
    expect(updated.data.pageCount).toBe(200);

    // Delete
    const deleteResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.status).toBe(200);

    // Verify deleted
    const afterDeleteResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(afterDeleteResponse.status).toBe(404);
  });

  test("metadata lookup with ISBN", async () => {
    const token = await registerUser(`metadata-lookup-${timestamp}@example.com`, "password123");

    // Use a well-known ISBN (The Great Gatsby)
    const isbn = "9780743273565";

    const response = await fetch(`${baseUrl}/books/metadata/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ identifier: isbn, identifierType: "isbn" }),
    });

    expect(response.status).toBe(200);

    const { results } = await response.json();
    // Should return results from at least one provider
    expect(results.length).toBeGreaterThan(0);

    // Check if we got data from any provider
    const hasResults = results.some((result: any) => result.data !== null);
    // Note: This might fail if all APIs are down, but that's expected
    if (hasResults) {
      const firstResult = results.find((r: any) => r.data !== null);
      expect(firstResult.data.title).toBeDefined();
    }
  });

  test("metadata lookup without ISBN fails", async () => {
    const token = await registerUser(`metadata-no-isbn-${timestamp}@example.com`, "password123");

    const response = await fetch(`${baseUrl}/books/metadata/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test("metadata lookup with invalid ISBN", async () => {
    const token = await registerUser(`metadata-invalid-isbn-${timestamp}@example.com`, "password123");

    const response = await fetch(`${baseUrl}/books/metadata/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ identifier: "invalid-isbn", identifierType: "isbn" }),
    });

    // Should return 400 for invalid ISBN format
    expect(response.status).toBe(400);

    const { error, code } = await response.json();
    expect(error).toBe("Invalid ISBN format");
    expect(code).toBe("INVALID_ISBN");
  });

  test("book history tracking via event sourcing", async () => {
    const token = await registerUser(`history-tracking-${timestamp}@example.com`, "password123");

    // Create book
    const createResponse = await fetch(`${baseUrl}/books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: "History Book v1",
        isbn: `978000110${timestamp}`,
      }),
    });
    const { book: created } = await createResponse.json();
    const bookId = created.entityId;

    // Update #1
    await fetch(`${baseUrl}/books/${bookId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: "History Book v2" }),
    });

    // Update #2
    await fetch(`${baseUrl}/books/${bookId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: "History Book v3" }),
    });

    // Check current state
    const currentResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { book: current } = await currentResponse.json();
    expect(current.data.title).toBe("History Book v3");

    // Verify history exists in database
    const history = await sql`
      SELECT * FROM entities
      WHERE entity_id = ${bookId}
      ORDER BY entered_at ASC
    `;

    expect(history.length).toBe(3); // Create + 2 updates
    expect(history[0].data.title).toBe("History Book v1");
    expect(history[1].data.title).toBe("History Book v2");
    expect(history[2].data.title).toBe("History Book v3");
  });
});
