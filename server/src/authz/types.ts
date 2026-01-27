/**
 * Authorization types
 *
 * Resource-level permissions for entities.
 */

export type AccessLevel = "owner" | "write" | "read";

export interface EntityAccess {
  entityId: number;
  userId: number;
  accessLevel: AccessLevel;
  grantedAt: Date;
  grantedBy: number | null;
}

/**
 * Permission hierarchy: owner > write > read
 * Higher number = more permissions
 */
const ACCESS_HIERARCHY: Record<AccessLevel, number> = {
  owner: 3,
  write: 2,
  read: 1,
};

/**
 * Check if user's access level meets or exceeds the required level
 */
export function hasAccess(
  userLevel: AccessLevel,
  requiredLevel: AccessLevel
): boolean {
  return ACCESS_HIERARCHY[userLevel] >= ACCESS_HIERARCHY[requiredLevel];
}

/**
 * Authorization error codes
 */
export type AuthzErrorCode =
  | "ACCESS_DENIED"
  | "NOT_OWNER"
  | "CANNOT_REVOKE_SELF"
  | "ENTITY_NOT_FOUND";

/**
 * Authorization error
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: AuthzErrorCode
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}
