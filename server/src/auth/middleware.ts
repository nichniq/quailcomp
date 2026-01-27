/**
 * Authentication middleware
 *
 * Provides middleware for requiring or optionally checking authentication.
 */

import type { Middleware } from "@/middleware/types";
import { extractToken, verifyToken } from "@/auth/jwt";

/**
 * Require authentication - returns 401 if not authenticated
 *
 * Use this for routes that must have a logged-in user.
 */
export const requireAuth: Middleware = (next) => async (ctx, req) => {
  const token = extractToken(req);

  if (!token) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  // Attach user to context
  ctx.user = {
    userId: payload.user_id,
    email: payload.email,
    username: payload.username ?? null,
    credentialId: payload.credential_id ?? 0,
    authMethod: payload.auth_method ?? "password",
  };

  // Add userId to logger context for tracing
  ctx.log = ctx.log.child({ userId: payload.user_id });

  return next(ctx, req);
};

/**
 * Optional authentication - continues even if not authenticated
 *
 * Use this for routes that work with or without a logged-in user,
 * but may provide additional features when authenticated.
 */
export const optionalAuth: Middleware = (next) => async (ctx, req) => {
  const token = extractToken(req);

  if (token) {
    const payload = await verifyToken(token);

    if (payload) {
      ctx.user = {
        userId: payload.user_id,
        email: payload.email,
        username: payload.username ?? null,
        credentialId: payload.credential_id ?? 0,
        authMethod: payload.auth_method ?? "password",
      };
      ctx.log = ctx.log.child({ userId: payload.user_id });
    }
  }

  return next(ctx, req);
};
