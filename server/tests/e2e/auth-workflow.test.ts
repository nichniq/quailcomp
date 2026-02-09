/**
 * E2E Authentication Workflow Tests
 *
 * Tests complete user authentication flows from HTTP request to response:
 * - User registration
 * - User login
 * - Token validation
 * - Get current user info
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createServer, type ServerInstance } from "@/server";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";
import type { AuthResponse, User } from "@domains/types/authentication";
import type { ErrorResponse } from "@/middleware/error-types";

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

describe("E2E Authentication Workflow", () => {
  const timestamp = Date.now();

  test("complete registration flow", async () => {
    const email = `e2e-register-${timestamp}@example.com`;
    const password = "SecureP@ss123!";
    const username = `e2e_user_${timestamp}`;

    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username }),
    });

    expect(response.status).toBe(201);

    const data = (await response.json()) as AuthResponse;
    expect(data.user.email).toBe(email);
    expect(data.user.username).toBe(username);
    expect(data.user.userId).toBeGreaterThan(0);
    expect(data.token).toBeDefined();
    expect(data.expiresAt).toBeDefined();

    // Verify token is a valid JWT (3 parts separated by dots)
    expect(data.token.split(".").length).toBe(3);
  });

  test("registration with duplicate email fails", async () => {
    const email = `e2e-duplicate-${timestamp}@example.com`;
    const password = "TestP@ssw0rd123";

    // First registration
    const response1 = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(response1.status).toBe(201);

    // Duplicate registration
    const response2 = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(response2.status).toBe(400);

    const error = (await response2.json()) as ErrorResponse;
    expect(error.error).toContain("Email already registered");
  });

  test("registration with weak password fails", async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `weak-${timestamp}@example.com`,
        password: "short",
      }),
    });

    expect(response.status).toBe(400);

    const error = (await response.json()) as ErrorResponse;
    expect(error.error).toContain("at least 12 characters");
  });

  test("registration with invalid email fails", async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "TestP@ssw0rd123",
      }),
    });

    expect(response.status).toBe(400);

    const error = (await response.json()) as ErrorResponse;
    expect(error.error).toContain("Invalid email");
  });

  test("complete login flow with email", async () => {
    const email = `e2e-login-${timestamp}@example.com`;
    const password = "LoginP@ss123!";

    // Register user
    await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    // Wait a moment to ensure different token
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Login
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password }),
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as AuthResponse;
    expect(data.user.email).toBe(email);
    expect(data.token).toBeDefined();
    expect(data.expiresAt).toBeDefined();
  });

  test("complete login flow with username", async () => {
    const email = `e2e-username-login-${timestamp}@example.com`;
    const username = `e2e_login_${timestamp}`;
    const password = "UsernameP@ss123!";

    // Register user
    await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username }),
    });

    // Login with username
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: username, password }),
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as AuthResponse;
    expect(data.user.username).toBe(username);
    expect(data.token).toBeDefined();
  });

  test("login with incorrect password fails", async () => {
    const email = `e2e-wrong-pwd-${timestamp}@example.com`;
    const password = "CorrectP@ss123!";

    // Register user
    await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    // Login with wrong password
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password: "wrongPassword" }),
    });

    expect(response.status).toBe(401);

    const error = (await response.json()) as ErrorResponse;
    expect(error.error).toContain("Invalid credentials");
  });

  test("login with non-existent user fails", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: `nonexistent-${timestamp}@example.com`,
        password: "anyPassword123",
      }),
    });

    expect(response.status).toBe(401);

    const error = (await response.json()) as ErrorResponse;
    expect(error.error).toContain("Invalid credentials");
  });

  test("get current user with valid token", async () => {
    const email = `e2e-me-${timestamp}@example.com`;
    const username = `e2e_me_${timestamp}`;
    const password = "TestP@ssw0rd123";

    // Register and get token
    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username }),
    });
    const { token } = (await registerResponse.json()) as AuthResponse;

    // Get current user info
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);

    const { user } = (await response.json()) as { user: User };
    expect(user.email).toBe(email);
    expect(user.username).toBe(username);
    expect(user.userId).toBeGreaterThan(0);
  });

  test("get current user without token fails", async () => {
    const response = await fetch(`${baseUrl}/auth/me`);

    expect(response.status).toBe(401);

    const error = (await response.json()) as ErrorResponse;
    expect(error.error).toContain("Authentication required");
  });

  test("get current user with invalid token fails", async () => {
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: "Bearer invalid.token.here" },
    });

    expect(response.status).toBe(401);

    const error = (await response.json()) as ErrorResponse;
    expect(error.error).toContain("Invalid or expired token");
  });

  test("get current user with malformed Authorization header fails", async () => {
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: "NotBearer token" },
    });

    expect(response.status).toBe(401);

    const error = (await response.json()) as ErrorResponse;
    expect(error.error).toContain("Authentication required");
  });

  test("complete workflow: register -> login -> get user", async () => {
    const email = `e2e-workflow-${timestamp}@example.com`;
    const username = `e2e_workflow_${timestamp}`;
    const password = "WorkflowP@ss123!";

    // Step 1: Register
    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username }),
    });
    expect(registerResponse.status).toBe(201);
    const registerData = (await registerResponse.json()) as AuthResponse;
    const registeredUserId = registerData.user.userId;

    // Step 2: Login
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password }),
    });
    expect(loginResponse.status).toBe(200);
    const loginData = (await loginResponse.json()) as AuthResponse;
    const loginToken = loginData.token;

    // Step 3: Get current user
    const meResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginToken}` },
    });
    expect(meResponse.status).toBe(200);
    const meData = (await meResponse.json()) as { user: User };
    expect(meData.user.userId).toBe(registeredUserId);
    expect(meData.user.email).toBe(email);
    expect(meData.user.username).toBe(username);
  });
});
