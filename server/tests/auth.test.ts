/**
 * Authentication & Authorization Test Suite
 *
 * Tests for:
 * - JWT utilities (signing, verification, extraction)
 * - Password utilities (hashing, verification, validation)
 * - Auth service (registration, login, user lookup)
 * - Authorization service (access control, permissions)
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import { signToken, verifyToken, extractToken, getTokenExpiration } from "@/auth/jwt";
import { hashPassword, verifyPassword, validatePassword } from "@/auth/password";
import { AuthService } from "@/auth/service";
import { AuthorizationService } from "@/authz/service";
import type { JWTPayload } from "@domains/types/authentication";

// Test database setup
let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
});

// =============================================================================
// JWT Utilities Tests
// =============================================================================

describe("JWT utilities", () => {
  test("sign token creates valid JWT", async () => {
    const payload: Omit<JWTPayload, "iat" | "exp"> = {
      user_id: 123,
      email: "test@example.com",
      username: "testuser",
      credential_id: 456,
      auth_method: "password",
    };

    const token = await signToken(payload);

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // JWT has 3 parts
  });

  test("verify valid token returns payload", async () => {
    const payload: Omit<JWTPayload, "iat" | "exp"> = {
      user_id: 789,
      email: "verify@example.com",
      auth_method: "password",
    };

    const token = await signToken(payload);
    const verified = await verifyToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.user_id).toBe(789);
    expect(verified?.email).toBe("verify@example.com");
    expect(verified?.auth_method).toBe("password");
    expect(verified?.iat).toBeDefined();
    expect(verified?.exp).toBeDefined();
  });

  test("verify invalid token returns null", async () => {
    const invalidToken = "invalid.token.string";
    const result = await verifyToken(invalidToken);

    expect(result).toBeNull();
  });

  test("verify malformed token returns null", async () => {
    const malformedToken = "not-even-close-to-a-jwt";
    const result = await verifyToken(malformedToken);

    expect(result).toBeNull();
  });

  test("extract token from Bearer header", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";
    const request = new Request("http://localhost", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const extracted = extractToken(request);

    expect(extracted).toBe(token);
  });

  test("extract token returns null for missing header", () => {
    const request = new Request("http://localhost");
    const extracted = extractToken(request);

    expect(extracted).toBeNull();
  });

  test("extract token returns null for malformed header", () => {
    const request = new Request("http://localhost", {
      headers: {
        Authorization: "NotBearer token",
      },
    });

    const extracted = extractToken(request);

    expect(extracted).toBeNull();
  });

  test("extract token handles whitespace-only Bearer token", () => {
    const request = new Request("http://localhost", {
      headers: {
        Authorization: "Bearer",
      },
    });

    const extracted = extractToken(request);

    // "Bearer" without space doesn't match "Bearer " prefix
    expect(extracted).toBeNull();
  });

  test("get token expiration returns future date", () => {
    const expiresAt = getTokenExpiration();
    const now = new Date();

    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
  });
});

// =============================================================================
// Password Utilities Tests
// =============================================================================

describe("Password utilities", () => {
  test("hash password creates bcrypt hash", async () => {
    const password = "testPassword123";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
    expect(hash.length).toBeGreaterThan(50);
  });

  test("verify correct password returns true", async () => {
    const password = "correctPassword456";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);

    expect(isValid).toBe(true);
  });

  test("verify incorrect password returns false", async () => {
    const password = "correctPassword789";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword("wrongPassword", hash);

    expect(isValid).toBe(false);
  });

  test("validate password rejects less than 12 characters", () => {
    const error = validatePassword("Short1!");

    expect(error).not.toBeNull();
    expect(error).toContain("at least 12 characters");
  });

  test("validate password rejects without complexity", () => {
    const error = validatePassword("alllowercase123");

    expect(error).not.toBeNull();
  });

  test("validate password accepts strong passwords", () => {
    const error = validatePassword("ValidP@ssw0rd123");

    expect(error).toBeNull();
  });
});

// =============================================================================
// Auth Service Tests
// =============================================================================

describe("AuthService", () => {
  let authService: AuthService;
  const testTimestamp = Date.now();

  beforeAll(() => {
    authService = new AuthService(sql);
  });

  test("register creates new user with password credential", async () => {
    const email = `test-register-${testTimestamp}@example.com`;
    const password = "SecurePass123!";

    const result = await authService.register({
      email,
      password,
      username: `user_${testTimestamp}`,
    });

    expect(result.user.email).toBe(email);
    expect(result.user.username).toBe(`user_${testTimestamp}`);
    expect(result.user.userId).toBeGreaterThan(0);
    expect(result.token).toBeDefined();
    expect(result.expiresAt).toBeDefined();

    // Verify token is valid
    const payload = await verifyToken(result.token);
    expect(payload?.user_id).toBe(result.user.userId);
    expect(payload?.email).toBe(email);
  });

  test("register without username succeeds", async () => {
    const email = `no-username-${testTimestamp}@example.com`;
    const password = "SecurePass456!";

    const result = await authService.register({
      email,
      password,
    });

    expect(result.user.email).toBe(email);
    expect(result.user.username).toBeNull();
  });

  test("register with duplicate email fails", async () => {
    const email = `duplicate-${testTimestamp}@example.com`;
    const password = "TestP@ssw0rd123";

    await authService.register({ email, password });

    await expect(
      authService.register({ email, password })
    ).rejects.toThrow("Email already registered");
  });

  test("register with duplicate username fails", async () => {
    const username = `duplicate_user_${testTimestamp}`;
    const password = "Password789!";

    await authService.register({
      email: `first-${testTimestamp}@example.com`,
      password,
      username,
    });

    await expect(
      authService.register({
        email: `second-${testTimestamp}@example.com`,
        password,
        username,
      })
    ).rejects.toThrow("Username already taken");
  });

  test("register with invalid email fails", async () => {
    await expect(
      authService.register({
        email: "not-an-email",
        password: "TestP@ssw0rd123",
      })
    ).rejects.toThrow("Invalid email format");
  });

  test("register with weak password fails", async () => {
    await expect(
      authService.register({
        email: `weak-pwd-${testTimestamp}@example.com`,
        password: "short",
      })
    ).rejects.toThrow("at least 12 characters");
  });

  test("login with correct email and password succeeds", async () => {
    const email = `login-test-${testTimestamp}@example.com`;
    const password = "LoginPass123!";

    const registered = await authService.register({ email, password });

    // Wait a moment to ensure different iat timestamp
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = await authService.login({
      identifier: email,
      password,
    });

    expect(result.user.userId).toBe(registered.user.userId);
    expect(result.user.email).toBe(email);
    expect(result.token).toBeDefined();
    expect(result.token).not.toBe(registered.token); // New token each login
  });

  test("login with username succeeds", async () => {
    const email = `username-login-${testTimestamp}@example.com`;
    const username = `login_user_${testTimestamp}`;
    const password = "UserPass123!";

    await authService.register({ email, password, username });

    const result = await authService.login({
      identifier: username,
      password,
    });

    expect(result.user.username).toBe(username);
    expect(result.token).toBeDefined();
  });

  test("login with incorrect password fails", async () => {
    const email = `wrong-pwd-${testTimestamp}@example.com`;
    const password = "CorrectPass123!";

    await authService.register({ email, password });

    await expect(
      authService.login({
        identifier: email,
        password: "wrongPassword",
      })
    ).rejects.toThrow("Invalid credentials");
  });

  test("login with non-existent user fails", async () => {
    await expect(
      authService.login({
        identifier: `nonexistent-${testTimestamp}@example.com`,
        password: "anyPassword123",
      })
    ).rejects.toThrow("Invalid credentials");
  });

  test("getUserById returns user data", async () => {
    const email = `get-by-id-${testTimestamp}@example.com`;
    const username = `get_id_user_${testTimestamp}`;
    const registered = await authService.register({
      email,
      password: "TestP@ssw0rd123",
      username,
    });

    const user = await authService.getUserById(registered.user.userId);

    expect(user).not.toBeNull();
    expect(user?.userId).toBe(registered.user.userId);
    expect(user?.email).toBe(email);
    expect(user?.username).toBe(username);
    expect(user?.createdAt).toBeInstanceOf(Date);
    expect(user?.updatedAt).toBeInstanceOf(Date);
  });

  test("getUserById returns null for non-existent user", async () => {
    const user = await authService.getUserById(999999999);

    expect(user).toBeNull();
  });

  test("getUserByEmail returns user data", async () => {
    const email = `get-by-email-${testTimestamp}@example.com`;
    await authService.register({
      email,
      password: "TestP@ssw0rd123",
    });

    const user = await authService.getUserByEmail(email);

    expect(user).not.toBeNull();
    expect(user?.email).toBe(email);
  });

  test("getUserByEmail returns null for non-existent email", async () => {
    const user = await authService.getUserByEmail(`nonexistent-${testTimestamp}@example.com`);

    expect(user).toBeNull();
  });
});

// =============================================================================
// Authorization Service Tests
// =============================================================================

describe("AuthorizationService", () => {
  let authzService: AuthorizationService;
  let authService: AuthService;
  let testUserId1: number;
  let testUserId2: number;
  let testEntityId: number;
  const testTimestamp = Date.now();

  beforeAll(async () => {
    authzService = new AuthorizationService(sql);
    authService = new AuthService(sql);

    // Create test users
    const user1 = await authService.register({
      email: `authz-user1-${testTimestamp}@example.com`,
      password: "TestP@ssw0rd123",
      username: `authz_user1_${testTimestamp}`,
    });
    testUserId1 = user1.user.userId;

    const user2 = await authService.register({
      email: `authz-user2-${testTimestamp}@example.com`,
      password: "TestP@ssw0rd123",
      username: `authz_user2_${testTimestamp}`,
    });
    testUserId2 = user2.user.userId;

    // Create a test entity (using entities table with nextval)
    const [entity] = await sql`
      INSERT INTO entities (entity_id, type, data)
      VALUES (nextval('entity_id_seq'), 'test_authz', ${{ test: true }})
      RETURNING entity_id
    `;
    testEntityId = entity.entity_id;
  });

  test("grantOwnerOnCreate grants owner access", async () => {
    await authzService.grantOwnerOnCreate(testEntityId, testUserId1);

    const accessLevel = await authzService.getAccessLevel(testUserId1, testEntityId);

    expect(accessLevel).toBe("owner");
  });

  test("checkAccess returns true for owner with owner permission", async () => {
    const hasAccess = await authzService.checkAccess(testUserId1, testEntityId, "owner");

    expect(hasAccess).toBe(true);
  });

  test("checkAccess returns true for owner with write permission", async () => {
    const hasAccess = await authzService.checkAccess(testUserId1, testEntityId, "write");

    expect(hasAccess).toBe(true);
  });

  test("checkAccess returns true for owner with read permission", async () => {
    const hasAccess = await authzService.checkAccess(testUserId1, testEntityId, "read");

    expect(hasAccess).toBe(true);
  });

  test("checkAccess returns false for user without access", async () => {
    const hasAccess = await authzService.checkAccess(testUserId2, testEntityId, "read");

    expect(hasAccess).toBe(false);
  });

  test("grantAccess allows owner to grant read access", async () => {
    const result = await authzService.grantAccess(
      testEntityId,
      testUserId2,
      "read",
      testUserId1
    );

    expect(result.userId).toBe(testUserId2);
    expect(result.entityId).toBe(Number(testEntityId));
    expect(result.accessLevel).toBe("read");
    expect(result.grantedBy).toBe(testUserId1);
  });

  test("getAccessLevel returns granted access level", async () => {
    const accessLevel = await authzService.getAccessLevel(testUserId2, testEntityId);

    expect(accessLevel).toBe("read");
  });

  test("checkAccess returns true after granting access", async () => {
    const hasAccess = await authzService.checkAccess(testUserId2, testEntityId, "read");

    expect(hasAccess).toBe(true);
  });

  test("grantAccess fails for non-owner trying to grant to others", async () => {
    // Create another entity
    const [entity] = await sql`
      INSERT INTO entities (entity_id, type, data)
      VALUES (nextval('entity_id_seq'), 'test_authz_no_access', ${{ test: true }})
      RETURNING entity_id
    `;
    await authzService.grantOwnerOnCreate(entity.entity_id, testUserId1);
    // Grant read access to testUserId2
    await authzService.grantAccess(entity.entity_id, testUserId2, "read", testUserId1);

    // testUserId2 has read access (not owner), so they can't grant to others
    const [thirdUser] = await sql`
      INSERT INTO users (email, username)
      VALUES (${'third-user-' + testTimestamp + '@example.com'}, ${'third_user_' + testTimestamp})
      RETURNING user_id
    `;

    await expect(
      authzService.grantAccess(entity.entity_id, thirdUser.user_id, "read", testUserId2)
    ).rejects.toThrow("Only owners can grant access");
  });

  test("revokeAccess removes access", async () => {
    // Create test entity
    const [entity] = await sql`
      INSERT INTO entities (entity_id, type, data)
      VALUES (nextval('entity_id_seq'), 'test_revoke', ${{ test: true }})
      RETURNING entity_id
    `;
    await authzService.grantOwnerOnCreate(entity.entity_id, testUserId1);
    await authzService.grantAccess(entity.entity_id, testUserId2, "read", testUserId1);

    await authzService.revokeAccess(entity.entity_id, testUserId2, testUserId1);

    const hasAccess = await authzService.checkAccess(testUserId2, entity.entity_id, "read");
    expect(hasAccess).toBe(false);
  });

  test("revokeAccess fails for non-owner", async () => {
    await expect(
      authzService.revokeAccess(testEntityId, testUserId2, testUserId2)
    ).rejects.toThrow("Only owners can revoke access");
  });

  test("cannot revoke own owner access", async () => {
    await expect(
      authzService.revokeAccess(testEntityId, testUserId1, testUserId1)
    ).rejects.toThrow("Cannot revoke own owner access");
  });

  test("listAccessibleEntities returns user's entities", async () => {
    const entities = await authzService.listAccessibleEntities(testUserId1);

    expect(entities.length).toBeGreaterThan(0);
    // entityId is converted to Number by mapAccess
    expect(entities.some((e) => e.entityId === Number(testEntityId))).toBe(true);
  });

  test("listAccessibleEntities filters by access level", async () => {
    const ownedEntities = await authzService.listAccessibleEntities(testUserId1, {
      accessLevel: "owner",
    });

    expect(ownedEntities.length).toBeGreaterThan(0);
    expect(ownedEntities.every((e) => e.accessLevel === "owner")).toBe(true);
  });

  test("listEntityAccessors returns all users with access", async () => {
    const accessors = await authzService.listEntityAccessors(testEntityId, testUserId1);

    expect(accessors.length).toBeGreaterThanOrEqual(2); // Owner and user2 with read
    expect(accessors.some((a) => a.userId === testUserId1)).toBe(true);
    expect(accessors.some((a) => a.userId === testUserId2)).toBe(true);
  });

  test("listEntityAccessors fails without access", async () => {
    // Create entity user2 has no access to
    const [entity] = await sql`
      INSERT INTO entities (entity_id, type, data)
      VALUES (nextval('entity_id_seq'), 'test_private', ${{ test: true }})
      RETURNING entity_id
    `;
    await authzService.grantOwnerOnCreate(entity.entity_id, testUserId1);

    await expect(
      authzService.listEntityAccessors(entity.entity_id, testUserId2)
    ).rejects.toThrow("Access denied");
  });

  test("transferOwnership changes owner and downgrades previous owner", async () => {
    // Create test entity
    const [entity] = await sql`
      INSERT INTO entities (entity_id, type, data)
      VALUES (nextval('entity_id_seq'), 'test_transfer', ${{ test: true }})
      RETURNING entity_id
    `;
    await authzService.grantOwnerOnCreate(entity.entity_id, testUserId1);

    await authzService.transferOwnership(entity.entity_id, testUserId2, testUserId1);

    const user1Access = await authzService.getAccessLevel(testUserId1, entity.entity_id);
    const user2Access = await authzService.getAccessLevel(testUserId2, entity.entity_id);

    expect(user1Access).toBe("write");
    expect(user2Access).toBe("owner");
  });

  test("transferOwnership fails for non-owner", async () => {
    await expect(
      authzService.transferOwnership(testEntityId, testUserId1, testUserId2)
    ).rejects.toThrow("Only owners can transfer ownership");
  });
});
