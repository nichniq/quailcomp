/**
 * Authorization middleware
 *
 * Provides middleware factories for checking entity access.
 */

import type { RequestContext } from "../context";
import type { Middleware } from "../middleware/types";
import { AuthorizationService } from "./service";
import type { AccessLevel } from "../../../domains/authorization";

/**
 * Function that extracts entity ID from request context
 */
type EntityIdExtractor = (
  ctx: RequestContext,
  req: Request
) => number | Promise<number>;

/**
 * Create authorization middleware that requires a specific access level
 *
 * @param requiredLevel - Minimum access level required (owner, write, or read)
 * @param getEntityId - Function to extract entity ID from the request
 *
 * @example
 * router.get('/api/entities/:id', handler, [
 *   requireAuth,
 *   requireAccess('read', (ctx) => Number(ctx.params.id))
 * ]);
 */
export function requireAccess(
  requiredLevel: AccessLevel,
  getEntityId: EntityIdExtractor
): Middleware {
  return (next) => async (ctx, req) => {
    // Must be authenticated first
    if (!ctx.user) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const entityId = await getEntityId(ctx, req);
    const authzService = new AuthorizationService(ctx.sql);

    const hasAccess = await authzService.checkAccess(
      ctx.user.userId,
      entityId,
      requiredLevel
    );

    if (!hasAccess) {
      ctx.log.warn("Access denied", {
        entityId,
        requiredLevel,
        userId: ctx.user.userId,
      });

      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    return next(ctx, req);
  };
}

/**
 * Require read access (view only)
 *
 * @example
 * router.get('/api/entities/:id', handler, [requireAuth, requireRead(ctx => Number(ctx.params.id))]);
 */
export function requireRead(getEntityId: EntityIdExtractor): Middleware {
  return requireAccess("read", getEntityId);
}

/**
 * Require write access (modify)
 *
 * @example
 * router.put('/api/entities/:id', handler, [requireAuth, requireWrite(ctx => Number(ctx.params.id))]);
 */
export function requireWrite(getEntityId: EntityIdExtractor): Middleware {
  return requireAccess("write", getEntityId);
}

/**
 * Require owner access (full control)
 *
 * @example
 * router.delete('/api/entities/:id', handler, [requireAuth, requireOwner(ctx => Number(ctx.params.id))]);
 */
export function requireOwner(getEntityId: EntityIdExtractor): Middleware {
  return requireAccess("owner", getEntityId);
}
