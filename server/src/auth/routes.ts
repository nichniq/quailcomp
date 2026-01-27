/**
 * Authentication routes
 *
 * POST /auth/register - Create new user with password
 * POST /auth/login - Authenticate and get JWT
 * GET /auth/me - Get current user info
 */

import type { Sql } from "@quailcomp/data";
import type { Router } from "../router";
import { requireAuth } from "./middleware";
import { AuthService } from "./service";
import { AuthError, type LoginRequest, type RegisterRequest } from "./types";

/**
 * Register authentication routes
 */
export function registerAuthRoutes(router: Router, sql: Sql): void {
  const authService = new AuthService(sql);

  // POST /auth/register - Create new user with password
  router.post("/auth/register", async (ctx, req) => {
    let body: RegisterRequest;

    try {
      body = (await req.json()) as RegisterRequest;
    } catch {
      return Response.json(
        { error: "Invalid JSON body", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.email || !body.password) {
      return Response.json(
        { error: "Email and password are required", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    try {
      const result = await authService.register(body);
      ctx.log.info("User registered", { userId: result.user.userId });
      return Response.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof AuthError) {
        return Response.json(
          { error: error.message, code: error.code },
          { status: 400 }
        );
      }
      throw error;
    }
  });

  // POST /auth/login - Authenticate and get JWT
  router.post("/auth/login", async (ctx, req) => {
    let body: LoginRequest;

    try {
      body = (await req.json()) as LoginRequest;
    } catch {
      return Response.json(
        { error: "Invalid JSON body", code: "INVALID_BODY" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.identifier || !body.password) {
      return Response.json(
        {
          error: "Identifier and password are required",
          code: "MISSING_FIELDS",
        },
        { status: 400 }
      );
    }

    try {
      const result = await authService.login(body);
      ctx.log.info("User logged in", { userId: result.user.userId });
      return Response.json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        ctx.log.warn("Login failed", {
          identifier: body.identifier,
          code: error.code,
        });
        return Response.json(
          { error: error.message, code: error.code },
          { status: 401 }
        );
      }
      throw error;
    }
  });

  // GET /auth/me - Get current user info
  router.get(
    "/auth/me",
    async (ctx) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Not authenticated" },
          { status: 401 }
        );
      }

      const user = await authService.getUserById(ctx.user.userId);

      if (!user) {
        return Response.json(
          { error: "User not found", code: "USER_NOT_FOUND" },
          { status: 404 }
        );
      }

      return Response.json({
        user: {
          userId: user.userId,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
        },
      });
    },
    [requireAuth]
  );
}
