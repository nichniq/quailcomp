/**
 * Middleware Test Suite
 *
 * Tests for:
 * - Authentication middleware (requireAuth, optionalAuth)
 * - Authorization middleware (requireAccess, requireRead, requireWrite, requireOwner)
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import { requireAuth, optionalAuth } from "@/auth/middleware";
import { requireAccess, requireRead, requireWrite, requireOwner } from "@/authz/middleware";
import { createContext, type RequestContext } from "@/context";
import type { Handler } from "@/middleware/types";
import { signToken } from "@/auth/jwt";
import { AuthService } from "@/auth/service";
import { AuthorizationService } from "@/authz/service";

// Test database setup
let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
});

afterAll(async () => {
  await sql.end();
});

// Test helper: create a mock handler
function createMockHandler(responseText: string = "success"): Handler {
  return async (ctx: RequestContext, req: Request) => {
    return new Response(responseText);
  };
}

// Test helper: extract response body as text
async function getResponseText(response: Response): Promise<string> {
  return response.text();
}

// Test helper: extract response body as JSON
async function getResponseJSON(response: Response): Promise<any> {
  return response.json();
}

// =============================================================================
// Authentication Middleware Tests
// =============================================================================

describe("requireAuth middleware", () => {
  const testTimestamp = Date.now();
  let testUserId: number;
  let validToken: string;

  beforeAll(async () => {
    // Create test user
    const authService = new AuthService(sql);
    const result = await authService.register({
      email: `auth-middleware-${testTimestamp}@example.com`,
      password: "password123",
      username: `auth_mw_${testTimestamp}`,
    });
    testUserId = result.user.userId;
    validToken = result.token;
  });

  test("allows request with valid Bearer token", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler("authenticated");
    const middleware = requireAuth(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await getResponseText(response)).toBe("authenticated");
    expect(ctx.user).not.toBeNull();
    expect(ctx.user?.userId).toBe(testUserId);
  });

  test("returns 401 for missing Authorization header", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requireAuth(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(401);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Authentication required");
  });

  test("returns 401 for invalid token", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Authorization: "Bearer invalid.token.here",
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requireAuth(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(401);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Invalid or expired token");
  });

  test("attaches user to context on success", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = requireAuth(handler);

    await middleware(ctx, request);

    expect(ctx.user).not.toBeNull();
    expect(ctx.user?.email).toContain("auth-middleware");
    expect(ctx.user?.username).toContain("auth_mw");
  });
});

describe("optionalAuth middleware", () => {
  const testTimestamp = Date.now();
  let validToken: string;

  beforeAll(async () => {
    const authService = new AuthService(sql);
    const result = await authService.register({
      email: `optional-auth-${testTimestamp}@example.com`,
      password: "password123",
    });
    validToken = result.token;
  });

  test("continues without authentication when no token provided", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler("public-content");
    const middleware = optionalAuth(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await getResponseText(response)).toBe("public-content");
    expect(ctx.user).toBeNull();
  });

  test("attaches user when valid token provided", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler("personalized-content");
    const middleware = optionalAuth(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await getResponseText(response)).toBe("personalized-content");
    expect(ctx.user).not.toBeNull();
  });

  test("continues without user when invalid token provided", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Authorization: "Bearer invalid.token",
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler("public-fallback");
    const middleware = optionalAuth(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await getResponseText(response)).toBe("public-fallback");
    expect(ctx.user).toBeNull();
  });
});

// =============================================================================
// Authorization Middleware Tests
// =============================================================================

describe("requireAccess middleware", () => {
  const testTimestamp = Date.now();
  let ownerId: number;
  let readerId: number;
  let nonAccessUserId: number;
  let entityId: number;
  let ownerToken: string;
  let readerToken: string;
  let nonAccessToken: string;

  beforeAll(async () => {
    const authService = new AuthService(sql);
    const authzService = new AuthorizationService(sql);

    // Create owner user
    const owner = await authService.register({
      email: `owner-${testTimestamp}@example.com`,
      password: "password123",
    });
    ownerId = owner.user.userId;
    ownerToken = owner.token;

    // Create reader user
    const reader = await authService.register({
      email: `reader-${testTimestamp}@example.com`,
      password: "password123",
    });
    readerId = reader.user.userId;
    readerToken = reader.token;

    // Create non-access user
    const nonAccess = await authService.register({
      email: `noaccess-${testTimestamp}@example.com`,
      password: "password123",
    });
    nonAccessUserId = nonAccess.user.userId;
    nonAccessToken = nonAccess.token;

    // Create test entity
    const [entity] = await sql`
      INSERT INTO entities (entity_id, type, data)
      VALUES (nextval('entity_id_seq'), 'test_middleware', ${{ test: true }})
      RETURNING entity_id
    `;
    entityId = Number(entity.entity_id);

    // Grant access
    await authzService.grantOwnerOnCreate(entityId, ownerId);
    await authzService.grantAccess(entityId, readerId, "read", ownerId);
  });

  test("requireAccess('read') allows user with read access", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Authorization: `Bearer ${readerToken}`,
      },
    });
    const ctx = createContext(request, sql);

    // Simulate requireAuth running first
    const authHandler = requireAuth(createMockHandler("authorized"));
    await authHandler(ctx, request);

    // Now test authorization
    const handler = createMockHandler("resource-data");
    const middleware = requireAccess("read", () => entityId)(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await getResponseText(response)).toBe("resource-data");
  });

  test("requireAccess('read') allows user with owner access", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    const ctx = createContext(request, sql);

    await requireAuth(createMockHandler())(ctx, request);
    const handler = createMockHandler("owner-sees-all");
    const middleware = requireAccess("read", () => entityId)(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await getResponseText(response)).toBe("owner-sees-all");
  });

  test("requireAccess returns 403 for user without access", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Authorization: `Bearer ${nonAccessToken}`,
      },
    });
    const ctx = createContext(request, sql);

    await requireAuth(createMockHandler())(ctx, request);
    const handler = createMockHandler();
    const middleware = requireAccess("read", () => entityId)(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(403);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Access denied");
  });

  test("requireAccess returns 401 if not authenticated", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);

    const handler = createMockHandler();
    const middleware = requireAccess("read", () => entityId)(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(401);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Authentication required");
  });

  test("requireWrite allows owner but not reader", async () => {
    // Reader should be denied
    const readerReq = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${readerToken}` },
    });
    const readerCtx = createContext(readerReq, sql);
    await requireAuth(createMockHandler())(readerCtx, readerReq);

    const writeMiddleware = requireWrite(() => entityId)(createMockHandler());
    const readerResponse = await writeMiddleware(readerCtx, readerReq);

    expect(readerResponse.status).toBe(403);

    // Owner should be allowed
    const ownerReq = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ownerCtx = createContext(ownerReq, sql);
    await requireAuth(createMockHandler())(ownerCtx, ownerReq);

    const ownerResponse = await writeMiddleware(ownerCtx, ownerReq);

    expect(ownerResponse.status).toBe(200);
  });

  test("requireOwner only allows owner", async () => {
    // Reader should be denied
    const readerReq = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${readerToken}` },
    });
    const readerCtx = createContext(readerReq, sql);
    await requireAuth(createMockHandler())(readerCtx, readerReq);

    const ownerMiddleware = requireOwner(() => entityId)(createMockHandler());
    const readerResponse = await ownerMiddleware(readerCtx, readerReq);

    expect(readerResponse.status).toBe(403);

    // Owner should be allowed
    const ownerReq = new Request("http://localhost/test", {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ownerCtx = createContext(ownerReq, sql);
    await requireAuth(createMockHandler())(ownerCtx, ownerReq);

    const ownerResponse = await ownerMiddleware(ownerCtx, ownerReq);

    expect(ownerResponse.status).toBe(200);
  });

  test("entity ID extractor can use context params", async () => {
    const request = new Request("http://localhost/entities/123", {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ctx = createContext(request, sql);
    ctx.params = { id: String(entityId) }; // Simulates router extracting params

    await requireAuth(createMockHandler())(ctx, request);

    const handler = createMockHandler("dynamic-id");
    const middleware = requireRead((ctx) => Number(ctx.params.id))(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await getResponseText(response)).toBe("dynamic-id");
  });
});
