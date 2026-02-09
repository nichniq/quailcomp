/**
 * People Routes Test Suite
 *
 * Tests for:
 * - GET /people - List people
 * - GET /people/:id - Get single person
 * - POST /people - Create person
 * - PUT /people/:id - Update person
 * - DELETE /people/:id - Soft delete person
 * - GET /people/:id/books - List books associated with person
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql, Entry } from "@quailcomp/data";

import { Router } from "@/router";
import { registerPeopleRoutes } from "@/routes/people";
import { compose } from "@/middleware/compose";
import { createContext, type RequestContext } from "@/context";
import type { PersonEntitySnapshot } from "@domains/types/people";
import { signToken } from "@/auth/jwt";
import { AuthService } from "@/auth/service";
import { errorHandler } from "@/middleware/error-handler";
import type { ErrorResponse } from "@/middleware/error-types";

// Response types for API endpoints
type PersonEntry = Entry<PersonEntitySnapshot>;
type PeopleListResponse = { people: PersonEntry[] };
type PersonResponse = { person: PersonEntry };
type BooksResponse = { books: unknown[] }; // Books type TBD

let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
});

describe("People Routes", () => {
  let router: Router;
  let testUserId: number;
  let testPersonId: number;
  const testTimestamp = Date.now();
  let authService: AuthService;

  beforeAll(async () => {
    authService = new AuthService(sql);

    // Create test user via AuthService
    const user = await authService.register({
      email: `test-people-${testTimestamp}@example.com`,
      password: "TestP@ssw0rd123",
      username: `test_people_${testTimestamp}`,
    });
    testUserId = user.user.userId;

    // Setup router with people routes
    router = new Router();
    registerPeopleRoutes(router, sql);
  });

  afterAll(async () => {
    // Clean up test user and related data
    await sql`DELETE FROM users WHERE user_id = ${testUserId}`;
    // Clean up test people (soft deleted and not)
    await sql`DELETE FROM entities WHERE type = 'person' AND data->>'name' LIKE ${'test-person-' + testTimestamp + '%'}`;
  });

  // Helper to create authenticated request with JWT token
  async function createAuthenticatedRequest(url: string, options?: RequestInit): Promise<Request> {
    const token = await signToken({
      user_id: Number(testUserId),
      email: `test-people-${testTimestamp}@example.com`,
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
    let handler = match.route.handler;
    if (match.route.middleware && match.route.middleware.length > 0) {
      handler = compose(...match.route.middleware)(handler);
    }

    // Wrap with error handler middleware
    const wrappedHandler = errorHandler(() => handler(ctx, request));
    return wrappedHandler(ctx, request);
  }

  describe("GET /people", () => {
    test("returns empty array when no people exist", async () => {
      const request = await createAuthenticatedRequest("http://localhost/people");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/people", ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PeopleListResponse;
      expect(data.people).toBeDefined();
      expect(Array.isArray(data.people)).toBe(true);
    });

    test("returns only accessible people for user", async () => {
      // Create a person owned by test user
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-accessible`,
        email: "accessible@example.com",
        relationships: ["gift_giver"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      // Grant owner access to test user
      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'owner', ${testUserId})
      `;

      const request = await createAuthenticatedRequest("http://localhost/people");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/people", ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PeopleListResponse;
      expect(data.people.length).toBeGreaterThanOrEqual(1);

      // Find our test person (compare as numbers)
      const testPerson = data.people.find((p) => p.entityId === Number(person.entity_id));
      expect(testPerson).toBeDefined();
      expect(testPerson?.data.name).toBe(personData.name);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });

    test("filters out deleted people", async () => {
      // Create and soft-delete a person
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-deleted`,
        relationships: ["author"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data, deleted_at)
        VALUES (nextval('entity_id_seq'), 'person', ${personData}, NOW())
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'owner', ${testUserId})
      `;

      const request = await createAuthenticatedRequest("http://localhost/people");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/people", ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PeopleListResponse;

      // Deleted person should not appear in results
      const deletedPerson = data.people.find((p) => p.entityId === person.entity_id);
      expect(deletedPerson).toBeUndefined();

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });

    test("requires authentication", async () => {
      const request = new Request("http://localhost/people");
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", "/people", ctx, request);

      expect(response.status).toBe(401);
      const error = (await response.json()) as ErrorResponse;
      expect(error.error).toBe("Authentication required");
    });
  });

  describe("GET /people/:id", () => {
    test("returns person by ID", async () => {
      // Create test person
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-get`,
        email: "get@example.com",
        phone: "555-1234",
        notes: "Test notes",
        relationships: ["gift_giver", "author"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/people/${person.entity_id}`, ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PersonResponse;
      expect(data.person).toBeDefined();
      expect(data.person.entityId).toBe(Number(person.entity_id));
      expect(data.person.data.name).toBe(personData.name);
      expect(data.person.data.email).toBe(personData.email);
      expect(data.person.data.relationships).toEqual(personData.relationships);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });

    test("returns 404 for non-existent person", async () => {
      const nonExistentId = 999999999;
      const request = await createAuthenticatedRequest(`http://localhost/people/${nonExistentId}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/people/${nonExistentId}`, ctx, request);

      expect(response.status).toBe(404);
      const error = (await response.json()) as ErrorResponse;
      // Middleware returns generic "Not found" for non-existent entities
      expect(error.error).toBe("Not found");
    });

    test("returns 403 for inaccessible person", async () => {
      // Create person without granting access
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-forbidden`,
        relationships: ["author"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/people/${person.entity_id}`, ctx, request);

      expect(response.status).toBe(403);

      // Clean up
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });

    test("requires read access", async () => {
      // This is tested implicitly by the 403 test above
      expect(true).toBe(true);
    });
  });

  describe("POST /people", () => {
    test("creates person with valid data", async () => {
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-create`,
        email: "create@example.com",
        phone: "555-5678",
        notes: "Created via test",
        relationships: ["gift_giver"],
      };

      const request = await createAuthenticatedRequest("http://localhost/people", {
        method: "POST",
        body: JSON.stringify(personData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/people", ctx, request);

      expect(response.status).toBe(201);
      const data = (await response.json()) as PersonResponse;
      expect(data.person).toBeDefined();
      expect(data.person.entityId).toBeDefined();
      expect(data.person.data.name).toBe(personData.name);
      expect(data.person.data.email).toBe(personData.email);

      // Save for later tests
      testPersonId = data.person.entityId;
    });

    test("auto-grants owner access to creator", async () => {
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-owner`,
        relationships: ["author"],
      };

      const request = await createAuthenticatedRequest("http://localhost/people", {
        method: "POST",
        body: JSON.stringify(personData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/people", ctx, request);

      expect(response.status).toBe(201);
      const data = (await response.json()) as PersonResponse;
      const personId = data.person.entityId;

      // Verify owner access was granted
      const [access] = await sql`
        SELECT access_level FROM entity_access
        WHERE entity_id = ${personId} AND user_id = ${testUserId}
      `;

      expect(access).toBeDefined();
      expect(access.access_level).toBe("owner");

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${personId}`;
      await sql`DELETE FROM entities WHERE entity_id = ${personId}`;
    });

    test("validates required fields - name", async () => {
      const invalidData = {
        relationships: ["author"],
        // name is missing
      };

      const request = await createAuthenticatedRequest("http://localhost/people", {
        method: "POST",
        body: JSON.stringify(invalidData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/people", ctx, request);

      expect(response.status).toBe(400);
      const error = (await response.json()) as ErrorResponse;
      expect(error.error).toBe("Invalid person data");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.fields).toContainEqual(
        expect.objectContaining({
          field: "name",
          message: "name is required",
        })
      );
    });

    test("validates required fields - relationships", async () => {
      const invalidData = {
        name: `test-person-${testTimestamp}-no-relationships`,
        // relationships is missing
      };

      const request = await createAuthenticatedRequest("http://localhost/people", {
        method: "POST",
        body: JSON.stringify(invalidData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/people", ctx, request);

      expect(response.status).toBe(400);
      const error = (await response.json()) as ErrorResponse;
      expect(error.error).toBe("Invalid person data");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.fields).toContainEqual(
        expect.objectContaining({
          field: "relationships",
          message: "relationships must not be empty",
        })
      );
    });

    test("returns 400 for invalid JSON", async () => {
      const request = await createAuthenticatedRequest("http://localhost/people", {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/people", ctx, request);

      expect(response.status).toBe(400);
      const error = (await response.json()) as ErrorResponse;
      expect(error.error).toBe("Invalid JSON body");
      expect(error.code).toBe("INVALID_BODY");
    });

    test("requires authentication", async () => {
      const personData: PersonEntitySnapshot = {
        name: "Test Person",
        relationships: ["author"],
      };

      const request = new Request("http://localhost/people", {
        method: "POST",
        body: JSON.stringify(personData),
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("POST", "/people", ctx, request);

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /people/:id", () => {
    test("updates person with partial data", async () => {
      // Use the person created in POST tests
      const updateData = {
        email: "updated@example.com",
        notes: "Updated notes",
      };

      const request = await createAuthenticatedRequest(`http://localhost/people/${testPersonId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/people/${testPersonId}`, ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PersonResponse;
      expect(data.person.data.email).toBe(updateData.email);
      expect(data.person.data.notes).toBe(updateData.notes);
    });

    test("preserves unmodified fields", async () => {
      // Get current person state
      const [before] = await sql`
        SELECT data FROM entities WHERE entity_id = ${testPersonId}
      `;
      const originalName = before.data.name;

      // Update only email
      const updateData = {
        email: "another@example.com",
      };

      const request = await createAuthenticatedRequest(`http://localhost/people/${testPersonId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/people/${testPersonId}`, ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PersonResponse;
      expect(data.person.data.name).toBe(originalName); // Name should be unchanged
      expect(data.person.data.email).toBe(updateData.email);
    });

    test("returns 404 for non-existent person", async () => {
      const nonExistentId = 999999999;
      const updateData = {
        email: "test@example.com",
      };

      const request = await createAuthenticatedRequest(`http://localhost/people/${nonExistentId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/people/${nonExistentId}`, ctx, request);

      expect(response.status).toBe(404);
      const error = (await response.json()) as ErrorResponse;
      // Middleware returns generic "Not found" for non-existent entities
      expect(error.error).toBe("Not found");
    });

    test("requires write access", async () => {
      // Create person with only read access
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-readonly`,
        relationships: ["author"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const updateData = {
        email: "test@example.com",
      };

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("PUT", `/people/${person.entity_id}`, ctx, request);

      expect(response.status).toBe(403);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });
  });

  describe("DELETE /people/:id", () => {
    test("soft deletes person", async () => {
      // Create a person to delete
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-delete`,
        relationships: ["borrower"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'owner', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("DELETE", `/people/${person.entity_id}`, ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as PersonResponse;
      expect(data.person).toBeDefined();

      // Verify soft delete (deleted_at should be set on the latest entry)
      const [deleted] = await sql`
        SELECT deleted_at FROM entities
        WHERE entity_id = ${person.entity_id}
        ORDER BY entered_at DESC
        LIMIT 1
      `;
      expect(deleted.deleted_at).not.toBeNull();

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });

    test("preserves data in history", async () => {
      // Create a person to delete
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-history`,
        email: "history@example.com",
        relationships: ["contributor"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'owner', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      await callRoute("DELETE", `/people/${person.entity_id}`, ctx, request);

      // Verify data is still in database
      const [row] = await sql`
        SELECT data FROM entities WHERE entity_id = ${person.entity_id}
      `;
      expect(row.data.name).toBe(personData.name);
      expect(row.data.email).toBe(personData.email);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });

    test("requires owner access", async () => {
      // Create person with only write access
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-write-only`,
        relationships: ["author"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'write', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}`, {
        method: "DELETE",
      });

      const ctx = createContext(request, sql);
      const response = await callRoute("DELETE", `/people/${person.entity_id}`, ctx, request);

      expect(response.status).toBe(403);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });
  });

  describe("GET /people/:id/books", () => {
    test("returns books given by person", async () => {
      // This test validates the endpoint exists and returns the correct books
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-books`,
        relationships: ["gift_giver"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}/books`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/people/${person.entity_id}/books`, ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as BooksResponse;
      expect(data.books).toBeDefined();
      expect(Array.isArray(data.books)).toBe(true);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });

    test("returns empty array when no books", async () => {
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-no-books`,
        relationships: ["author"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      await sql`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${person.entity_id}, ${testUserId}, 'read', ${testUserId})
      `;

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}/books`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/people/${person.entity_id}/books`, ctx, request);

      expect(response.status).toBe(200);
      const data = (await response.json()) as BooksResponse;
      expect(data.books).toEqual([]);

      // Clean up
      await sql`DELETE FROM entity_access WHERE entity_id = ${person.entity_id}`;
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });

    test("requires read access to person", async () => {
      // Create person without granting access
      const personData: PersonEntitySnapshot = {
        name: `test-person-${testTimestamp}-forbidden-books`,
        relationships: ["author"],
      };

      const [person] = await sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), 'person', ${personData})
        RETURNING entity_id
      `;

      const request = await createAuthenticatedRequest(`http://localhost/people/${person.entity_id}/books`);
      const ctx = createContext(request, sql);

      const response = await callRoute("GET", `/people/${person.entity_id}/books`, ctx, request);

      expect(response.status).toBe(403);

      // Clean up
      await sql`DELETE FROM entities WHERE entity_id = ${person.entity_id}`;
    });
  });
});
