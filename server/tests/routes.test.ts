/**
 * Routes Test Suite
 *
 * Tests for:
 * - Health endpoints (GET /health, GET /metrics)
 * - Books CRUD endpoints (GET, POST, PUT, DELETE)
 * - Books metadata lookup endpoint
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import { healthHandler, metricsHandler } from "@/routes/health";
import { createContext, type RequestContext } from "@/context";
import { Router } from "@/router";
import { registerBookRoutes } from "@/routes/books";
import { compose } from "@/middleware/compose";
import { errorHandler } from "@/middleware/error-handler";
import type { BookEntitySnapshot } from "@domains/types/books";
import { signToken } from "@/auth/jwt";

// Test database setup
let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
});

// =============================================================================
// Health Endpoint Tests
// =============================================================================

describe("healthHandler", () => {
  test("returns healthy status when database connected", async () => {
    const request = new Request("http://localhost/health");
    const ctx = createContext(request, sql);

    const response = await healthHandler(ctx, request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("healthy");
    expect(data.database).toBe("connected");
    expect(data.timestamp).toBeDefined();
  });

  test("returns unhealthy status when database disconnected", async () => {
    const request = new Request("http://localhost/health");

    // Create a mock SQL connection that throws
    const brokenSql = {
      ...sql,
      unsafe: () => {
        throw new Error("Database connection failed");
      },
    } as unknown as Sql;

    // Override the tagged template behavior to throw
    const ctx = createContext(request, brokenSql);
    Object.defineProperty(ctx, "sql", {
      get() {
        const handler = {
          get() {
            throw new Error("Database connection failed");
          },
        };
        return new Proxy(() => { throw new Error("Database connection failed"); }, handler);
      },
    });

    const response = await healthHandler(ctx, request);

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.status).toBe("unhealthy");
    expect(data.database).toBe("disconnected");
  });
});

describe("metricsHandler", () => {
  test("returns metrics snapshot", async () => {
    const request = new Request("http://localhost/metrics");
    const ctx = createContext(request, sql);

    // Add a test metric via the context
    ctx.observability.metrics.incrementCounter("test_metric", 1, { label: "value" });

    const response = await metricsHandler(ctx, request);

    expect(response.status).toBe(200);
    // The /metrics endpoint returns Prometheus format (plain text), not JSON
    const text = await response.text();
    expect(text).toContain("test_metric");
    expect(response.headers.get("Content-Type")).toContain("text/plain");
  });
});

// =============================================================================
// Books Routes Tests
// =============================================================================

describe("Books routes", () => {
  let router: Router;
  let testUserId: bigint;
  let testBookId: number;
  const testTimestamp = Date.now();

  beforeAll(async () => {
    // Create test user in users table (required for FK constraints)
    const [user] = await sql`
      INSERT INTO users (email, username)
      VALUES (${`test-books-${testTimestamp}@example.com`}, ${`test_books_${testTimestamp}`})
      RETURNING user_id
    `;
    testUserId = BigInt(user.user_id);

    // Setup router with book routes
    router = new Router();
    registerBookRoutes(router, sql);
  });

  afterAll(async () => {
    // Clean up test user (will cascade delete entity_access entries)
    await sql`DELETE FROM users WHERE user_id = ${testUserId}`;
  });

  // Helper to create authenticated request with JWT token
  async function createAuthenticatedRequest(url: string, options?: RequestInit): Promise<Request> {
    const token = await signToken({
      user_id: Number(testUserId),
      email: `test-books-${testTimestamp}@example.com`,
      credential_id: 1,
      auth_method: "password",
    });

    const headers = new Headers(options?.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    return new Request(url, {
      ...options,
      headers,
    });
  }

  // Helper to call route handler through router
  async function callRoute(
    method: string,
    path: string,
    ctx: RequestContext,
    request: Request
  ): Promise<Response> {
    const match = router.match(method, path);
    if (!match) {
      throw new Error(`No route matched: ${method} ${path}`);
    }

    // Set params in context
    ctx.params = match.params;

    // Build handler chain: route middleware -> error handler -> handler
    // This mirrors the actual server setup where errorHandler is in globalMiddleware
    const routeMiddleware = match.route.middleware ?? [];
    const handler = compose(...routeMiddleware)(
      errorHandler(match.route.handler)
    );

    return handler(ctx, request);
  }

  describe("GET /books", () => {
    test("lists all books", async () => {
      const request = await createAuthenticatedRequest("http://localhost/books");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/books", ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.books).toBeDefined();
      expect(Array.isArray(data.books)).toBe(true);
    });

    test("requires authentication", async () => {
      const request = new Request("http://localhost/books");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/books", ctx, request);

      expect(response.status).toBe(401);
    });
  });

  describe("POST /books", () => {
    test("creates a new book", async () => {
      const bookData: BookEntitySnapshot = {
        title: "Test Book",
        author: "Test Author",
        isbn13: "9780123456789",
      };

      const request = await createAuthenticatedRequest("http://localhost/books", {
        method: "POST",
        body: JSON.stringify(bookData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/books", ctx, request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.book).toBeDefined();
      expect(data.book.entityId).toBeDefined();
      expect(data.book.data.title).toBe("Test Book");

      // Save for later tests
      testBookId = data.book.entityId;
    });

    test("returns 400 for invalid JSON", async () => {
      const request = await createAuthenticatedRequest("http://localhost/books", {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/books", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid JSON body");
      expect(data.code).toBe("INVALID_BODY");
    });

    test("requires authentication", async () => {
      const bookData: BookEntitySnapshot = {
        title: "Test Book",
        author: "Test Author",
      };

      const request = new Request("http://localhost/books", {
        method: "POST",
        body: JSON.stringify(bookData),
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/books", ctx, request);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /books/:id", () => {
    test("returns a book by ID", async () => {
      const request = await createAuthenticatedRequest(`http://localhost/books/${testBookId}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/books/${testBookId}`, ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.book).toBeDefined();
      expect(data.book.entityId).toBe(testBookId);
      expect(data.book.data.title).toBe("Test Book");
    });

    test("returns 400 for invalid ID", async () => {
      const request = await createAuthenticatedRequest("http://localhost/books/invalid");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/books/invalid", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid book ID");
      expect(data.code).toBe("INVALID_ID");
    });

    test("returns 404 for non-existent book", async () => {
      const nonExistentId = 999999999;
      const request = await createAuthenticatedRequest(`http://localhost/books/${nonExistentId}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/books/${nonExistentId}`, ctx, request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Not found");
      expect(data.code).toBe("NOT_FOUND");
    });

    test("requires authentication", async () => {
      const request = new Request(`http://localhost/books/${testBookId}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/books/${testBookId}`, ctx, request);

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /books/:id", () => {
    test("updates an existing book", async () => {
      const updatedData: BookEntitySnapshot = {
        title: "Updated Test Book",
        author: "Updated Author",
        isbn13: "9780123456789",
      };

      const request = await createAuthenticatedRequest(`http://localhost/books/${testBookId}`, {
        method: "PUT",
        body: JSON.stringify(updatedData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/books/${testBookId}`, ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.book.data.title).toBe("Updated Test Book");
      expect(data.book.data.author).toBe("Updated Author");
    });

    test("returns 400 for invalid ID", async () => {
      const request = await createAuthenticatedRequest("http://localhost/books/invalid", {
        method: "PUT",
        body: JSON.stringify({ title: "Test" }),
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", "/books/invalid", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe("INVALID_ID");
    });

    test("returns 404 for non-existent book", async () => {
      const nonExistentId = 999999999;
      const request = await createAuthenticatedRequest(`http://localhost/books/${nonExistentId}`, {
        method: "PUT",
        body: JSON.stringify({ title: "Test" }),
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/books/${nonExistentId}`, ctx, request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.code).toBe("NOT_FOUND");
    });

    test("returns 400 for invalid JSON", async () => {
      const request = await createAuthenticatedRequest(`http://localhost/books/${testBookId}`, {
        method: "PUT",
        body: "invalid json",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/books/${testBookId}`, ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe("INVALID_BODY");
    });

    test("requires authentication", async () => {
      const request = new Request(`http://localhost/books/${testBookId}`, {
        method: "PUT",
        body: JSON.stringify({ title: "Test" }),
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/books/${testBookId}`, ctx, request);

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /books/:id", () => {
    test("soft deletes a book", async () => {
      const request = await createAuthenticatedRequest(`http://localhost/books/${testBookId}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("DELETE", `/books/${testBookId}`, ctx, request);

      expect(response.status).toBe(200);
      const { book } = await response.json();
      expect(book.deletedAt).not.toBeNull();

      // Verify book is soft deleted (deleted_at is set in the latest entry)
      const [dbBook] = await sql`
        SELECT deleted_at FROM entities
        WHERE entity_id = ${testBookId}
        ORDER BY entered_at DESC
        LIMIT 1
      `;
      expect(dbBook.deleted_at).not.toBeNull();
    });

    test("returns 400 for invalid ID", async () => {
      const request = await createAuthenticatedRequest("http://localhost/books/invalid", {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("DELETE", "/books/invalid", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe("INVALID_ID");
    });

    test("returns 404 for non-existent book", async () => {
      const nonExistentId = 999999999;
      const request = await createAuthenticatedRequest(`http://localhost/books/${nonExistentId}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("DELETE", `/books/${nonExistentId}`, ctx, request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.code).toBe("NOT_FOUND");
    });

    test("requires authentication", async () => {
      // Create a new book for this test
      const [entity] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'book', ${{ title: "Delete Test" }})
        RETURNING entity_id
      `;

      const request = new Request(`http://localhost/books/${Number(entity.entity_id)}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("DELETE", `/books/${Number(entity.entity_id)}`, ctx, request);

      expect(response.status).toBe(401);

      // Clean up
      await sql`DELETE FROM entities WHERE entity_id = ${entity.entity_id}`;
    });
  });

  describe("POST /books/metadata/lookup", () => {
    test("validates ISBN format", async () => {
      const request = await createAuthenticatedRequest("http://localhost/books/metadata/lookup", {
        method: "POST",
        body: JSON.stringify({
          identifier: "invalid-isbn",
          identifierType: "isbn",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/books/metadata/lookup", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid ISBN format");
      expect(data.code).toBe("INVALID_ISBN");
    });

    test("returns 400 for missing fields", async () => {
      const request = await createAuthenticatedRequest("http://localhost/books/metadata/lookup", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/books/metadata/lookup", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe("MISSING_FIELDS");
    });

    test("returns 400 for invalid JSON", async () => {
      const request = await createAuthenticatedRequest("http://localhost/books/metadata/lookup", {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/books/metadata/lookup", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe("INVALID_BODY");
    });

    test("requires authentication", async () => {
      const request = new Request("http://localhost/books/metadata/lookup", {
        method: "POST",
        body: JSON.stringify({
          identifier: "9780345391803",
          identifierType: "isbn",
        }),
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/books/metadata/lookup", ctx, request);

      expect(response.status).toBe(401);
    });

    // Note: We don't test actual metadata lookup with real providers here
    // as that would require network calls and external API keys.
    // Those are better tested in integration tests or the book-metadata service tests.
  });
});
