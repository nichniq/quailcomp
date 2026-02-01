/**
 * Entity access routes
 *
 * GET /entities/:id/access - List all users with access to an entity
 * POST /entities/:id/access - Grant access to an entity
 * DELETE /entities/:id/access/:userId - Revoke access from an entity
 * POST /entities/:id/transfer - Transfer ownership of an entity
 */

import type { Sql } from "@quailcomp/data";

import type { AccessLevel } from "@domains/types/authorization";
import { AuthorizationError } from "@domains/types/authorization";

import type { Router } from "@/router";
import { requireAuth } from "@/auth/middleware";
import { requireRead, requireOwner } from "@/authz/middleware";
import { AuthorizationService } from "@/authz/service";

/**
 * Helper to extract entity ID from route params
 */
const getEntityIdFromParams = (ctx: { params: { id: string } }) =>
  parseInt(ctx.params.id, 10);

/**
 * Register entity access routes
 */
export function registerEntityRoutes(router: Router, sql: Sql): void {
  const authzService = new AuthorizationService(sql);

  // GET /entities/:id/access - List all users with access
  router.get(
    "/entities/:id/access",
    async (ctx) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid entity ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      try {
        const accessors = await authzService.listEntityAccessors(
          entityId,
          ctx.user.userId
        );
        return Response.json({ accessors });
      } catch (error) {
        if (error instanceof AuthorizationError) {
          return Response.json(
            { error: error.message, code: error.code },
            { status: 403 }
          );
        }
        throw error;
      }
    },
    [requireAuth]
  );

  // POST /entities/:id/access - Grant access
  router.post(
    "/entities/:id/access",
    async (ctx, req) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid entity ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      interface GrantAccessRequest {
        userId: number;
        accessLevel: AccessLevel;
      }

      let body: GrantAccessRequest;
      try {
        body = (await req.json()) as GrantAccessRequest;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      if (!body.userId || !body.accessLevel) {
        return Response.json(
          { error: "Missing required fields: userId, accessLevel", code: "MISSING_FIELDS" },
          { status: 400 }
        );
      }

      try {
        const access = await authzService.grantAccess(
          entityId,
          body.userId,
          body.accessLevel,
          ctx.user.userId
        );
        return Response.json({ access }, { status: 201 });
      } catch (error) {
        if (error instanceof AuthorizationError) {
          return Response.json(
            { error: error.message, code: error.code },
            { status: 403 }
          );
        }
        throw error;
      }
    },
    [requireAuth]
  );

  // DELETE /entities/:id/access/:userId - Revoke access
  router.delete(
    "/entities/:id/access/:userId",
    async (ctx) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const entityId = parseInt(ctx.params.id, 10);
      const targetUserId = parseInt(ctx.params.userId, 10);

      if (isNaN(entityId) || isNaN(targetUserId)) {
        return Response.json(
          { error: "Invalid ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      try {
        await authzService.revokeAccess(entityId, targetUserId, ctx.user.userId);
        return Response.json({ success: true });
      } catch (error) {
        if (error instanceof AuthorizationError) {
          return Response.json(
            { error: error.message, code: error.code },
            { status: 403 }
          );
        }
        throw error;
      }
    },
    [requireAuth]
  );

  // POST /entities/:id/transfer - Transfer ownership
  router.post(
    "/entities/:id/transfer",
    async (ctx, req) => {
      if (!ctx.user) {
        return Response.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const entityId = parseInt(ctx.params.id, 10);

      if (isNaN(entityId)) {
        return Response.json(
          { error: "Invalid entity ID", code: "INVALID_ID" },
          { status: 400 }
        );
      }

      interface TransferRequest {
        newOwnerId: number;
      }

      let body: TransferRequest;
      try {
        body = (await req.json()) as TransferRequest;
      } catch {
        return Response.json(
          { error: "Invalid JSON body", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      if (!body.newOwnerId) {
        return Response.json(
          { error: "Missing required field: newOwnerId", code: "MISSING_FIELDS" },
          { status: 400 }
        );
      }

      try {
        await authzService.transferOwnership(
          entityId,
          body.newOwnerId,
          ctx.user.userId
        );
        return Response.json({ success: true });
      } catch (error) {
        if (error instanceof AuthorizationError) {
          return Response.json(
            { error: error.message, code: error.code },
            { status: 403 }
          );
        }
        throw error;
      }
    },
    [requireAuth]
  );
}
