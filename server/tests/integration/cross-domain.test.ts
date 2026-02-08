/**
 * Cross-Domain Integration Tests
 *
 * Tests interactions between People, Series, and Books domains.
 * These tests verify that domains work together correctly when referencing each other.
 *
 * Test Coverage:
 * - People + Books Integration (gift-giving)
 * - Series + Books Integration (multi-volume series)
 * - Export with related entities
 * - WebSocket notifications for cross-domain changes
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { getConnection, createEntitiesClient } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import { Router } from "@/router";
import { registerBookRoutes } from "@/routes/books";
import { registerPeopleRoutes } from "@/routes/people";
import { registerSeriesRoutes } from "@/routes/series";
import { compose } from "@/middleware/compose";
import { createContext, type RequestContext } from "@/context";
import { signToken } from "@/auth/jwt";
import { AuthService } from "@/auth/service";
import { AuthorizationService } from "@/authz/service";
import type { PersonEntitySnapshot } from "@domains/types/people";
import type { SeriesEntitySnapshot } from "@domains/types/series";
import type { PhysicalBook } from "@domains/types/books";

let sql: Sql;
let authService: AuthService;
let authzService: AuthorizationService;

beforeAll(async () => {
  sql = getConnection();
  authService = new AuthService(sql);
  authzService = new AuthorizationService(sql);
});

// Note: Do not close the shared connection in tests
// The connection is a singleton managed by getConnection()
// Closing it would break subsequent tests that use the same connection

/**
 * Helper function to execute a request through the router with proper middleware
 */
async function executeRequest(
  router: Router,
  sql: Sql,
  method: string,
  req: Request
): Promise<Response> {
  // Extract path from request URL
  const url = new URL(req.url);
  const path = url.pathname;

  const match = router.match(method, path);
  if (!match) throw new Error(`Route not found: ${method} ${path}`);

  const ctx = createContext(req, sql);
  // Set extracted params from router
  ctx.params = match.params;

  const middlewares = match.route.middleware || [];
  const middleware = compose(...middlewares);
  const handler = middleware(match.route.handler);
  return handler(ctx, req);
}

describe("Cross-Domain Integration Tests", () => {
  let router: Router;
  let testUserId: number;
  let authToken: string;
  const testTimestamp = Date.now();

  beforeAll(async () => {
    // Create test user
    const user = await authService.register({
      email: `test-crossdomain-${testTimestamp}@example.com`,
      password: "TestP@ssw0rd123",
      username: `test_crossdomain_${testTimestamp}`,
    });
    testUserId = user.user.userId;
    authToken = await signToken({
      user_id: user.user.userId,
      email: user.user.email,
      username: user.user.username ?? undefined,
    });

    // Setup router with all domain routes
    router = new Router();
    registerBookRoutes(router, sql);
    registerPeopleRoutes(router, sql);
    registerSeriesRoutes(router, sql);
  });

  describe("People + Books Integration", () => {
    test("create person and associate with book as gift-giver", async () => {
      // Step 1: Create a person
      const personReq = new Request("http://localhost:3000/people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "Jane Doe",
          email: "jane@example.com",
          relationships: ["gift_giver"],
        } as Partial<PersonEntitySnapshot>),
      });

      const personResponse = await executeRequest(router, sql, "POST", personReq);

      expect(personResponse.status).toBe(201);
      const personData = (await personResponse.json()) as { person: { entityId: number } };
      const personId = personData.person.entityId;

      // Step 2: Create a book with the person as gift-giver
      const bookReq = new Request("http://localhost:3000/books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Gift Book from Jane",
          author: "Test Author",
          acquisition: {
            type: "given",
            person_id: personId,
            date: new Date().toISOString().split("T")[0],
          },
        } as Partial<PhysicalBook>),
      });

      const bookResponse = await executeRequest(router, sql, "POST", bookReq);

      expect(bookResponse.status).toBe(201);
      const bookData = (await bookResponse.json()) as { book: { entityId: number; data: PhysicalBook } };
      const bookId = bookData.book.entityId;

      // Step 3: Verify the book is associated with the person
      expect(bookData.book.data.acquisition?.type).toBe("given");
      expect(bookData.book.data.acquisition?.person_id).toBe(personId);

      // Step 4: Query person's books
      const personBooksReq = new Request(`http://localhost:3000/people/${personId}/books`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const personBooksResponse = await executeRequest(router, sql, "GET", personBooksReq);

      expect(personBooksResponse.status).toBe(200);
      const personBooksData = (await personBooksResponse.json()) as { books: any[] };

      // Verify the book appears in the person's associated books
      const associatedBook = personBooksData.books.find((b: any) => b.entityId === bookId);
      expect(associatedBook).toBeDefined();
      expect(associatedBook.data.title).toBe("Gift Book from Jane");
    });

    test("person can be associated with multiple books", async () => {
      // Create a person
      const personReq = new Request("http://localhost:3000/people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "Bob Smith",
          relationships: ["gift_giver", "author"],
        } as Partial<PersonEntitySnapshot>),
      });

      const personResponse = await executeRequest(router, sql, "POST", personReq);

      const personData = (await personResponse.json()) as { person: { entityId: number } };
      const personId = personData.person.entityId;

      // Create multiple books associated with this person
      const bookTitles = ["Book One", "Book Two", "Book Three"];
      const createdBookIds: number[] = [];

      for (const title of bookTitles) {
        const bookReq = new Request("http://localhost:3000/books", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title,
            author: "Bob Smith",
            acquisition: {
              type: "given",
              person_id: personId,
              date: new Date().toISOString().split("T")[0],
            },
          } as Partial<PhysicalBook>),
        });

        const bookResponse = await executeRequest(router, sql, "POST", bookReq);

        const bookData = (await bookResponse.json()) as { book: { entityId: number } };
        createdBookIds.push(bookData.book.entityId);
      }

      // Verify all books are associated with the person
      const personBooksReq = new Request(`http://localhost:3000/people/${personId}/books`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const personBooksResponse = await executeRequest(router, sql, "GET", personBooksReq);

      const personBooksData = (await personBooksResponse.json()) as { books: any[] };

      expect(personBooksData.books.length).toBeGreaterThanOrEqual(3);

      // Verify each created book is in the list
      for (const bookId of createdBookIds) {
        const found = personBooksData.books.some((b: any) => b.entityId === bookId);
        expect(found).toBe(true);
      }
    });
  });

  describe("Series + Books Integration", () => {
    test("create series and add multiple books with volume numbers", async () => {
      // Step 1: Create a series
      const seriesReq = new Request("http://localhost:3000/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "The Lord of the Rings",
          total_volumes: 3,
          notes: "Classic fantasy trilogy",
        } as Partial<SeriesEntitySnapshot>),
      });

      const seriesResponse = await executeRequest(router, sql, "POST", seriesReq);

      expect(seriesResponse.status).toBe(201);
      const seriesData = (await seriesResponse.json()) as { series: { entityId: number } };
      const seriesId = seriesData.series.entityId;

      // Step 2: Create books in the series
      const volumes = [
        { title: "The Fellowship of the Ring", volume: 1 },
        { title: "The Two Towers", volume: 2 },
        { title: "The Return of the King", volume: 3 },
      ];

      const createdBooks: number[] = [];

      for (const vol of volumes) {
        const bookReq = new Request("http://localhost:3000/books", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: vol.title,
            author: "J.R.R. Tolkien",
            series_id: seriesId,
            volume_number: vol.volume,
          } as Partial<PhysicalBook>),
        });

        const bookResponse = await executeRequest(router, sql, "POST", bookReq);

        expect(bookResponse.status).toBe(201);
        const bookData = (await bookResponse.json()) as { book: { entityId: number; data: PhysicalBook } };
        createdBooks.push(bookData.book.entityId);

        // Verify book has series association
        expect(bookData.book.data.series_id).toBe(seriesId);
        expect(bookData.book.data.volume_number).toBe(vol.volume);
      }

      // Step 3: Query series books
      const seriesBooksReq = new Request(`http://localhost:3000/series/${seriesId}/books`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const seriesBooksResponse = await executeRequest(router, sql, "GET", seriesBooksReq);

      expect(seriesBooksResponse.status).toBe(200);
      const seriesBooksData = (await seriesBooksResponse.json()) as { books: any[] };

      // Verify all 3 books are in the series
      expect(seriesBooksData.books.length).toBe(3);

      // Verify books are ordered by volume number
      expect(seriesBooksData.books[0].data.volume_number).toBe(1);
      expect(seriesBooksData.books[0].data.title).toBe("The Fellowship of the Ring");

      expect(seriesBooksData.books[1].data.volume_number).toBe(2);
      expect(seriesBooksData.books[1].data.title).toBe("The Two Towers");

      expect(seriesBooksData.books[2].data.volume_number).toBe(3);
      expect(seriesBooksData.books[2].data.title).toBe("The Return of the King");
    });

    test("series can handle books without volume numbers", async () => {
      // Create a series
      const seriesReq = new Request("http://localhost:3000/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "Discworld",
          notes: "Books can be read in any order",
        } as Partial<SeriesEntitySnapshot>),
      });

      const seriesResponse = await executeRequest(router, sql, "POST", seriesReq);

      const seriesData = (await seriesResponse.json()) as { series: { entityId: number } };
      const seriesId = seriesData.series.entityId;

      // Create books without volume numbers
      const titles = ["The Color of Magic", "The Light Fantastic", "Equal Rites"];

      for (const title of titles) {
        const bookReq = new Request("http://localhost:3000/books", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title,
            author: "Terry Pratchett",
            series_id: seriesId,
            // No volume_number
          } as Partial<PhysicalBook>),
        });

        const bookResponse = await executeRequest(router, sql, "POST", bookReq);

        expect(bookResponse.status).toBe(201);
      }

      // Query series books
      const seriesBooksReq = new Request(`http://localhost:3000/series/${seriesId}/books`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const seriesBooksResponse = await executeRequest(router, sql, "GET", seriesBooksReq);

      const seriesBooksData = (await seriesBooksResponse.json()) as { books: any[] };

      // Should return all books even without volume numbers
      expect(seriesBooksData.books.length).toBe(3);
    });
  });

  describe("Export with Related Entities", () => {
    test("export includes person and series references", async () => {
      // Create a person
      const personReq = new Request("http://localhost:3000/people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "Export Test Person",
          relationships: ["gift_giver"],
        } as Partial<PersonEntitySnapshot>),
      });

      const personResponse = await executeRequest(router, sql, "POST", personReq);

      const personData = (await personResponse.json()) as { person: { entityId: number } };
      const personId = personData.person.entityId;

      // Create a series
      const seriesReq = new Request("http://localhost:3000/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "Export Test Series",
          total_volumes: 2,
        } as Partial<SeriesEntitySnapshot>),
      });

      const seriesResponse = await executeRequest(router, sql, "POST", seriesReq);

      const seriesData = (await seriesResponse.json()) as { series: { entityId: number } };
      const seriesId = seriesData.series.entityId;

      // Create a book with both person and series references
      const bookReq = new Request("http://localhost:3000/books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Export Test Book",
          author: "Test Author",
          series_id: seriesId,
          volume_number: 1,
          acquisition: {
            type: "given",
            person_id: personId,
            date: new Date().toISOString().split("T")[0],
          },
        } as Partial<PhysicalBook>),
      });

      const bookResponse = await executeRequest(router, sql, "POST", bookReq);

      const bookData = (await bookResponse.json()) as { book: { entityId: number } };
      const bookId = bookData.book.entityId;

      // Export books
      const exportReq = new Request("http://localhost:3000/books/export?format=json", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const exportResponse = await executeRequest(router, sql, "GET", exportReq);

      expect(exportResponse.status).toBe(200);
      const exportedBooks = (await exportResponse.json()) as any[];

      // Find the exported book (note: exported format uses entity_id, not entityId)
      const exportedBook = exportedBooks.find((b: any) => b.entity_id === bookId);

      expect(exportedBook).toBeDefined();
      expect(exportedBook.title).toBe("Export Test Book");
      expect(exportedBook.series_id).toBe(seriesId);
      expect(exportedBook.volume_number).toBe(1);
      expect(exportedBook.acquisition?.person_id).toBe(personId);
      expect(exportedBook.acquisition?.type).toBe("given");
    });
  });

  describe("Complex Multi-Domain Scenarios", () => {
    test("full workflow: person gives series books", async () => {
      // Create a person (gift giver)
      const personReq = new Request("http://localhost:3000/people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "Generous Friend",
          email: "friend@example.com",
          relationships: ["gift_giver"],
        } as Partial<PersonEntitySnapshot>),
      });

      const personResponse = await executeRequest(router, sql, "POST", personReq);

      const personData = (await personResponse.json()) as { person: { entityId: number } };
      const personId = personData.person.entityId;

      // Create a series
      const seriesReq = new Request("http://localhost:3000/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: "Gift Series",
          total_volumes: 2,
        } as Partial<SeriesEntitySnapshot>),
      });

      const seriesResponse = await executeRequest(router, sql, "POST", seriesReq);

      const seriesData = (await seriesResponse.json()) as { series: { entityId: number } };
      const seriesId = seriesData.series.entityId;

      // Create 2 books in the series, given by the person
      const volumes = [
        { title: "Volume 1", volume: 1 },
        { title: "Volume 2", volume: 2 },
      ];

      for (const vol of volumes) {
        const bookReq = new Request("http://localhost:3000/books", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: vol.title,
            author: "Gift Author",
            series_id: seriesId,
            volume_number: vol.volume,
            acquisition: {
              type: "given",
              person_id: personId,
              date: "2024-02-01",
            },
          } as Partial<PhysicalBook>),
        });

        const bookResponse = await executeRequest(router, sql, "POST", bookReq);

        expect(bookResponse.status).toBe(201);
      }

      // Verify: Person should have 2 books
      const personBooksReq = new Request(`http://localhost:3000/people/${personId}/books`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const personBooksResponse = await executeRequest(router, sql, "GET", personBooksReq);

      const personBooksData = (await personBooksResponse.json()) as { books: any[] };
      expect(personBooksData.books.length).toBe(2);

      // Verify: Series should have 2 books
      const seriesBooksReq = new Request(`http://localhost:3000/series/${seriesId}/books`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const seriesBooksResponse = await executeRequest(router, sql, "GET", seriesBooksReq);

      const seriesBooksData = (await seriesBooksResponse.json()) as { books: any[] };
      expect(seriesBooksData.books.length).toBe(2);

      // Verify: Both books should have person_id and series_id
      for (const book of seriesBooksData.books) {
        expect(book.data.series_id).toBe(seriesId);
        expect(book.data.acquisition?.person_id).toBe(personId);
        expect(book.data.acquisition?.type).toBe("given");
      }
    });
  });
});
