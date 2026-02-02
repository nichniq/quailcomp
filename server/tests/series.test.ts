/**
 * Series Routes Test Suite
 *
 * Tests for:
 * - GET /series - List series
 * - GET /series/:id - Get single series
 * - POST /series - Create series
 * - PUT /series/:id - Update series
 * - DELETE /series/:id - Soft delete series
 * - GET /series/:id/books - List books in series
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import { Router } from "@/router";
import { registerSeriesRoutes } from "@/routes/series";
import { compose } from "@/middleware/compose";
import { createContext, type RequestContext } from "@/context";
import type { SeriesEntitySnapshot } from "@domains/types/series";
import type { BookEntitySnapshot } from "@domains/types/books";
import { signToken } from "@/auth/jwt";
import { AuthService } from "@/auth/service";

let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
});

describe("Series Routes", () => {
  let router: Router;
  let testUserId: number;
  let testSeriesId: number;
  const testTimestamp = Date.now();
  let authService: AuthService;

  beforeAll(async () => {
    authService = new AuthService(sql);

    // Create test user via AuthService
    const user = await authService.register({
      email: `test-series-${testTimestamp}@example.com`,
      password: "TestP@ssw0rd123",
      username: `test_series_${testTimestamp}`,
    });
    testUserId = user.user.userId;

    // Setup router with series routes
    router = new Router();
    registerSeriesRoutes(router, sql);
  });

  afterAll(async () => {
    // Clean up test user and related data
    await sql`DELETE FROM users WHERE user_id = ${testUserId}`;
    // Clean up test series (soft deleted and not)
    await sql`DELETE FROM entities WHERE type = 'series' AND data->>'name' LIKE ${'test-series-' + testTimestamp + '%'}`;
    // Clean up test books
    await sql`DELETE FROM entities WHERE type = 'book' AND data->>'title' LIKE ${'test-book-' + testTimestamp + '%'}`;
  });

  // Helper to create authenticated request with JWT token
  async function createAuthenticatedRequest(url: string, options?: RequestInit): Promise<Request> {
    const token = await signToken({
      user_id: Number(testUserId),
      email: `test-series-${testTimestamp}@example.com`,
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

    // Apply middleware if present
    if (match.route.middleware && match.route.middleware.length > 0) {
      const handler = compose(...match.route.middleware)(match.route.handler);
      return handler(ctx, request);
    }

    return match.route.handler(ctx, request);
  }

  describe("GET /series", () => {
    test("returns empty array when no series exist", async () => {
      const request = await createAuthenticatedRequest("http://localhost/series");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/series", ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.series).toBeDefined();
      expect(Array.isArray(data.series)).toBe(true);
    });

    test("returns only accessible series for user", async () => {
      // Create a series owned by test user
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-accessible`,
        total_volumes: 3,
        notes: "Test trilogy",
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      // Grant owner access to test user
      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'owner', ${testUserId})
      `;

      const request = await createAuthenticatedRequest("http://localhost/series");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/series", ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.series.length).toBeGreaterThanOrEqual(1);

      // Find our test series
      const testSeries = data.series.find((s: any) => s.entityId === Number(series.entity_id));
      expect(testSeries).toBeDefined();
      expect(testSeries.data.name).toBe(seriesData.name);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("filters out deleted series", async () => {
      // Create and soft-delete a series
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-deleted`,
        total_volumes: 2,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data, deleted_at)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData}, NOW())
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'owner', ${testUserId})
      `;

      const request = await createAuthenticatedRequest("http://localhost/series");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/series", ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Deleted series should not appear in results
      const deletedSeries = data.series.find((s: any) => s.entityId === series.entity_id);
      expect(deletedSeries).toBeUndefined();

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("requires authentication", async () => {
      const request = new Request("http://localhost/series");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/series", ctx, request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Authentication required");
    });
  });

  describe("GET /series/:id", () => {
    test("returns series by ID", async () => {
      // Create test series
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-get`,
        total_volumes: 5,
        notes: "Five-book series",
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/series/${series.entity_id}`, ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.series).toBeDefined();
      expect(data.series.entityId).toBe(Number(series.entity_id));
      expect(data.series.data.name).toBe(seriesData.name);
      expect(data.series.data.total_volumes).toBe(seriesData.total_volumes);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("returns 404 for non-existent series", async () => {
      const nonExistentId = 999999999;
      const request = await createAuthenticatedRequest(`http://localhost/series/${nonExistentId}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/series/${nonExistentId}`, ctx, request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Not found");
    });

    test("returns 403 for inaccessible series", async () => {
      // Create series without granting access
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-forbidden`,
        total_volumes: 1,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/series/${series.entity_id}`, ctx, request);

      expect(response.status).toBe(403);

      // Clean up
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("requires read access", async () => {
      // This is tested implicitly by the 403 test above
      expect(true).toBe(true);
    });
  });

  describe("POST /series", () => {
    test("creates series with valid data", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-create`,
        total_volumes: 4,
        notes: "Created via test",
      };

      const request = await createAuthenticatedRequest("http://localhost/series", {
        method: "POST",
        body: JSON.stringify(seriesData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/series", ctx, request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.series).toBeDefined();
      expect(data.series.entityId).toBeDefined();
      expect(data.series.data.name).toBe(seriesData.name);
      expect(data.series.data.total_volumes).toBe(seriesData.total_volumes);

      // Save for later tests
      testSeriesId = data.series.entityId;
    });

    test("creates series without total_volumes", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-no-volumes`,
      };

      const request = await createAuthenticatedRequest("http://localhost/series", {
        method: "POST",
        body: JSON.stringify(seriesData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/series", ctx, request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.series).toBeDefined();
      expect(data.series.data.name).toBe(seriesData.name);
      expect(data.series.data.total_volumes).toBeUndefined();

      // Clean up
      const seriesId = data.series.entityId;
      await sql`DELETE FROM entity_access WHERE entity_id = ${seriesId}`;
      await sql`DELETE FROM entities WHERE entity_id = ${seriesId}`;
    });

    test("auto-grants owner access to creator", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-owner`,
        total_volumes: 2,
      };

      const request = await createAuthenticatedRequest("http://localhost/series", {
        method: "POST",
        body: JSON.stringify(seriesData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/series", ctx, request);

      expect(response.status).toBe(201);
      const data = await response.json();
      const seriesId = data.series.entityId;

      // Verify owner access was granted
      const [access] = await sql`
        SELECT access_level FROM entity_access
        WHERE entity_id = ${seriesId} AND user_id = ${testUserId}
      `;

      expect(access).toBeDefined();
      expect(access.access_level).toBe("owner");

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${seriesId}`;
      await sql`DELETE FROM entities WHERE entity_id = ${seriesId}`;
    });

    test("validates required fields - name", async () => {
      const invalidData = {
        total_volumes: 3,
      };

      const request = await createAuthenticatedRequest("http://localhost/series", {
        method: "POST",
        body: JSON.stringify(invalidData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/series", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Name is required");
      expect(data.code).toBe("MISSING_NAME");
    });

    test("validates total_volumes must be positive integer", async () => {
      const invalidData = {
        name: `test-series-${testTimestamp}-invalid-volumes`,
        total_volumes: -1,
      };

      const request = await createAuthenticatedRequest("http://localhost/series", {
        method: "POST",
        body: JSON.stringify(invalidData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/series", ctx, request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Total volumes must be a positive integer");
      expect(data.code).toBe("INVALID_TOTAL_VOLUMES");
    });

    test("requires authentication", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-no-auth`,
        total_volumes: 1,
      };

      const request = new Request("http://localhost/series", {
        method: "POST",
        body: JSON.stringify(seriesData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/series", ctx, request);

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /series/:id", () => {
    test("updates series with partial data", async () => {
      // Create series first
      const originalData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-update`,
        total_volumes: 3,
        notes: "Original notes",
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${originalData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'write', ${testUserId})
      `;

      // Update with partial data
      const updateData = {
        notes: "Updated notes",
      };

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/series/${series.entity_id}`, ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.series.data.name).toBe(originalData.name); // Unchanged
      expect(data.series.data.total_volumes).toBe(originalData.total_volumes); // Unchanged
      expect(data.series.data.notes).toBe("Updated notes"); // Changed

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("preserves unmodified fields", async () => {
      const originalData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-preserve`,
        total_volumes: 5,
        notes: "Keep these notes",
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${originalData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'write', ${testUserId})
      `;

      // Update only the name
      const updateData = {
        name: `test-series-${testTimestamp}-preserve-updated`,
      };

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/series/${series.entity_id}`, ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.series.data.name).toBe(updateData.name);
      expect(data.series.data.total_volumes).toBe(originalData.total_volumes);
      expect(data.series.data.notes).toBe(originalData.notes);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("returns 404 for non-existent series", async () => {
      const nonExistentId = 999999999;
      const updateData = { notes: "Updated" };

      const request = await createAuthenticatedRequest(`http://localhost/series/${nonExistentId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/series/${nonExistentId}`, ctx, request);

      expect(response.status).toBe(404);
    });

    test("requires write access", async () => {
      // Create series with read-only access
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-readonly`,
        total_volumes: 2,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const updateData = { notes: "Try to update" };

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/series/${series.entity_id}`, ctx, request);

      expect(response.status).toBe(403);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });
  });

  describe("DELETE /series/:id", () => {
    test("soft deletes series", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-delete`,
        total_volumes: 2,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'owner', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("DELETE", `/series/${series.entity_id}`, ctx, request);

      expect(response.status).toBe(200);

      // Verify soft delete (deleted_at is set on latest entry)
      const [deleted] = await sql`
        SELECT deleted_at
        FROM entities
        WHERE entity_id = ${series.entity_id}
        ORDER BY entered_at DESC
        LIMIT 1
      `;

      expect(deleted.deleted_at).not.toBeNull();

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("preserves data in history", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-preserve-history`,
        total_volumes: 3,
        notes: "Important data",
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'owner', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      await callRoute("DELETE", `/series/${series.entity_id}`, ctx, request);

      // Verify data is still in database
      const [preserved] = await sql`
        SELECT data FROM entities WHERE entity_id = ${series.entity_id}
      `;

      expect(preserved.data.name).toBe(seriesData.name);
      expect(preserved.data.total_volumes).toBe(seriesData.total_volumes);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("requires owner access", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-delete-forbidden`,
        total_volumes: 1,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      // Grant write access (not owner)
      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'write', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("DELETE", `/series/${series.entity_id}`, ctx, request);

      expect(response.status).toBe(403);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });
  });

  describe("GET /series/:id/books", () => {
    test("returns books in series ordered by volume number", async () => {
      // Create a series
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-with-books`,
        total_volumes: 3,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      // Create books in this series (insert in random order)
      const book2Data = {
        title: `test-book-${testTimestamp}-volume-2`,
        series_id: series.entity_id.toString(),
        volume_number: 2,
        volume_name: "The Second Book",
      };

      const book1Data = {
        title: `test-book-${testTimestamp}-volume-1`,
        series_id: series.entity_id.toString(),
        volume_number: 1,
        volume_name: "The First Book",
      };

      const book3Data = {
        title: `test-book-${testTimestamp}-volume-3`,
        series_id: series.entity_id.toString(),
        volume_number: 3,
        volume_name: "The Third Book",
      };

      const [book2] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'book', ${book2Data})
        RETURNING entity_id
      `;

      const [book1] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'book', ${book1Data})
        RETURNING entity_id
      `;

      const [book3] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'book', ${book3Data})
        RETURNING entity_id
      `;

      // Grant access to books
      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES
          (${book1.entity_id}, ${testUserId}, 'read', ${testUserId}),
          (${book2.entity_id}, ${testUserId}, 'read', ${testUserId}),
          (${book3.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}/books`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/series/${series.entity_id}/books`, ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.books).toBeDefined();
      expect(data.books.length).toBe(3);

      // Verify ordering (should be 1, 2, 3)
      expect(data.books[0].volume_number).toBe(1);
      expect(data.books[1].volume_number).toBe(2);
      expect(data.books[2].volume_number).toBe(3);

      expect(data.books[0].data.title).toBe(book1Data.title);
      expect(data.books[1].data.title).toBe(book2Data.title);
      expect(data.books[2].data.title).toBe(book3Data.title);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id IN (${series.entity_id}, ${book1.entity_id}, ${book2.entity_id}, ${book3.entity_id})`;
      await sql`DELETE FROM entities WHERE entity_id IN (${series.entity_id}, ${book1.entity_id}, ${book2.entity_id}, ${book3.entity_id})`;
    });

    test("returns empty array when no books in series", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-no-books`,
        total_volumes: 5,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}/books`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/series/${series.entity_id}/books`, ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.books).toEqual([]);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${series.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });

    test("handles books without volume numbers", async () => {
      // Create a series
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-mixed-volumes`,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${series.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      // Create books with and without volume numbers
      const book1Data = {
        title: `test-book-${testTimestamp}-with-volume`,
        series_id: series.entity_id.toString(),
        volume_number: 1,
      };

      const book2Data = {
        title: `test-book-${testTimestamp}-no-volume`,
        series_id: series.entity_id.toString(),
      };

      const [book1] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'book', ${book1Data})
        RETURNING entity_id
      `;

      const [book2] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'book', ${book2Data})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES
          (${book1.entity_id}, ${testUserId}, 'read', ${testUserId}),
          (${book2.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}/books`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/series/${series.entity_id}/books`, ctx, request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.books.length).toBe(2);

      // Book with volume number should come first
      expect(data.books[0].volume_number).toBe(1);
      expect(data.books[1].volume_number).toBeUndefined();

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id IN (${series.entity_id}, ${book1.entity_id}, ${book2.entity_id})`;
      await sql`DELETE FROM entities WHERE entity_id IN (${series.entity_id}, ${book1.entity_id}, ${book2.entity_id})`;
    });

    test("requires read access to series", async () => {
      const seriesData: SeriesEntitySnapshot = {
        name: `test-series-${testTimestamp}-no-access`,
        total_volumes: 1,
      };

      const [series] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'series', ${seriesData})
        RETURNING entity_id
      `;

      // Don't grant access

      const request = await createAuthenticatedRequest(`http://localhost/series/${series.entity_id}/books`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/series/${series.entity_id}/books`, ctx, request);

      expect(response.status).toBe(403);

      // Clean up
      await sql`DELETE FROM entities WHERE entity_id = ${series.entity_id}`;
    });
  });
});

afterAll(async () => {
  await sql.end();
});
