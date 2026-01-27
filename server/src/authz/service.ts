/**
 * Authorization service
 *
 * Manages resource-level permissions for entities.
 */

import type { Sql } from "@quailcomp/data";
import {
  hasAccess,
  type AccessLevel,
  type EntityAccess,
  AuthorizationError,
} from "./types";

export class AuthorizationService {
  constructor(private sql: Sql) {}

  /**
   * Check if user has required access level to an entity
   */
  async checkAccess(
    userId: number,
    entityId: number,
    requiredLevel: AccessLevel
  ): Promise<boolean> {
    const access = await this.sql`
      SELECT access_level
      FROM entity_access
      WHERE entity_id = ${entityId} AND user_id = ${userId}
    `;

    if (access.length === 0) {
      return false;
    }

    return hasAccess(access[0].access_level as AccessLevel, requiredLevel);
  }

  /**
   * Get user's access level for an entity
   *
   * Returns null if user has no access
   */
  async getAccessLevel(
    userId: number,
    entityId: number
  ): Promise<AccessLevel | null> {
    const access = await this.sql`
      SELECT access_level
      FROM entity_access
      WHERE entity_id = ${entityId} AND user_id = ${userId}
    `;

    return (access[0]?.access_level as AccessLevel) ?? null;
  }

  /**
   * Grant access to an entity
   *
   * Only owners can grant access to others.
   * Uses upsert to update existing access if present.
   */
  async grantAccess(
    entityId: number,
    userId: number,
    accessLevel: AccessLevel,
    grantedBy: number
  ): Promise<EntityAccess> {
    // Verify granter has owner access (unless granting to self)
    if (userId !== grantedBy) {
      const granterAccess = await this.getAccessLevel(grantedBy, entityId);
      if (granterAccess !== "owner") {
        throw new AuthorizationError(
          "Only owners can grant access to others",
          "NOT_OWNER"
        );
      }
    }

    const [result] = await this.sql`
      INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
      VALUES (${entityId}, ${userId}, ${accessLevel}, ${grantedBy})
      ON CONFLICT (entity_id, user_id)
      DO UPDATE SET
        access_level = ${accessLevel},
        granted_at = NOW(),
        granted_by = ${grantedBy}
      RETURNING entity_id, user_id, access_level, granted_at, granted_by
    `;

    return this.mapAccess(result);
  }

  /**
   * Revoke access from an entity
   *
   * Only owners can revoke access.
   * Cannot revoke own owner access (must transfer ownership first).
   */
  async revokeAccess(
    entityId: number,
    userId: number,
    revokedBy: number
  ): Promise<void> {
    // Verify revoker has owner access
    const revokerAccess = await this.getAccessLevel(revokedBy, entityId);
    if (revokerAccess !== "owner") {
      throw new AuthorizationError(
        "Only owners can revoke access",
        "NOT_OWNER"
      );
    }

    // Cannot revoke own owner access
    if (userId === revokedBy) {
      const targetAccess = await this.getAccessLevel(userId, entityId);
      if (targetAccess === "owner") {
        throw new AuthorizationError(
          "Cannot revoke own owner access - transfer ownership first",
          "CANNOT_REVOKE_SELF"
        );
      }
    }

    await this.sql`
      DELETE FROM entity_access
      WHERE entity_id = ${entityId} AND user_id = ${userId}
    `;
  }

  /**
   * List all entities a user has access to
   */
  async listAccessibleEntities(
    userId: number,
    options?: {
      accessLevel?: AccessLevel;
      limit?: number;
      offset?: number;
    }
  ): Promise<EntityAccess[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    let results;

    if (options?.accessLevel) {
      results = await this.sql`
        SELECT entity_id, user_id, access_level, granted_at, granted_by
        FROM entity_access
        WHERE user_id = ${userId}
          AND access_level = ${options.accessLevel}
        ORDER BY granted_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      results = await this.sql`
        SELECT entity_id, user_id, access_level, granted_at, granted_by
        FROM entity_access
        WHERE user_id = ${userId}
        ORDER BY granted_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    return results.map(this.mapAccess);
  }

  /**
   * List all users who have access to an entity
   */
  async listEntityAccessors(
    entityId: number,
    requestedBy: number
  ): Promise<EntityAccess[]> {
    // Verify requester has at least read access
    const requesterAccess = await this.getAccessLevel(requestedBy, entityId);
    if (!requesterAccess) {
      throw new AuthorizationError("Access denied", "ACCESS_DENIED");
    }

    const results = await this.sql`
      SELECT entity_id, user_id, access_level, granted_at, granted_by
      FROM entity_access
      WHERE entity_id = ${entityId}
      ORDER BY granted_at ASC
    `;

    return results.map(this.mapAccess);
  }

  /**
   * Grant owner access when an entity is created
   *
   * This should be called automatically when creating entities.
   */
  async grantOwnerOnCreate(entityId: number, userId: number): Promise<void> {
    await this.sql`
      INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
      VALUES (${entityId}, ${userId}, 'owner', ${userId})
    `;
  }

  /**
   * Transfer ownership to another user
   *
   * The new owner gets owner access, the old owner is downgraded to write.
   */
  async transferOwnership(
    entityId: number,
    newOwnerId: number,
    currentOwnerId: number
  ): Promise<void> {
    // Verify current owner
    const currentAccess = await this.getAccessLevel(currentOwnerId, entityId);
    if (currentAccess !== "owner") {
      throw new AuthorizationError(
        "Only owners can transfer ownership",
        "NOT_OWNER"
      );
    }

    await this.sql.begin(async (tx) => {
      // Grant owner to new owner
      await tx`
        INSERT INTO entity_access (entity_id, user_id, access_level, granted_by)
        VALUES (${entityId}, ${newOwnerId}, 'owner', ${currentOwnerId})
        ON CONFLICT (entity_id, user_id)
        DO UPDATE SET
          access_level = 'owner',
          granted_at = NOW(),
          granted_by = ${currentOwnerId}
      `;

      // Downgrade current owner to write
      await tx`
        UPDATE entity_access
        SET access_level = 'write', granted_at = NOW()
        WHERE entity_id = ${entityId} AND user_id = ${currentOwnerId}
      `;
    });
  }

  /**
   * Map database row to EntityAccess type
   */
  private mapAccess(row: Record<string, unknown>): EntityAccess {
    return {
      entityId: Number(row.entity_id),
      userId: row.user_id as number,
      accessLevel: row.access_level as AccessLevel,
      grantedAt: row.granted_at as Date,
      grantedBy: row.granted_by as number | null,
    };
  }
}
