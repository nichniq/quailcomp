/**
 * Database error types with context
 *
 * These errors wrap database errors with additional context to make
 * debugging easier and provide better error messages.
 */

/**
 * Database error codes
 */
export type DatabaseErrorCode =
  | "UNIQUE_VIOLATION"
  | "FOREIGN_KEY_VIOLATION"
  | "NOT_NULL_VIOLATION"
  | "CHECK_VIOLATION"
  | "CONNECTION_ERROR"
  | "QUERY_ERROR"
  | "NOT_FOUND"
  | "UNKNOWN_ERROR";

/**
 * Base database error with context
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: DatabaseErrorCode,
    public operation: string,
    public details?: Record<string, unknown>,
    public cause?: Error
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Entity not found error
 */
export class EntityNotFoundError extends DatabaseError {
  constructor(public entityId: number, public entityType?: string) {
    super(
      `Entity ${entityId} not found${entityType ? ` (type: ${entityType})` : ""}`,
      "NOT_FOUND",
      "getById",
      { entityId, entityType }
    );
    this.name = "EntityNotFoundError";
  }
}

/**
 * Event not found error
 */
export class EventNotFoundError extends DatabaseError {
  constructor(public eventId: number, public eventType?: string) {
    super(
      `Event ${eventId} not found${eventType ? ` (type: ${eventType})` : ""}`,
      "NOT_FOUND",
      "getById",
      { eventId, eventType }
    );
    this.name = "EventNotFoundError";
  }
}

/**
 * Unique constraint violation (e.g., duplicate email)
 */
export class UniqueViolationError extends DatabaseError {
  constructor(
    message: string,
    public constraint: string,
    public value?: unknown
  ) {
    super(message, "UNIQUE_VIOLATION", "insert/update", { constraint, value });
    this.name = "UniqueViolationError";
  }
}

/**
 * Foreign key constraint violation
 */
export class ForeignKeyViolationError extends DatabaseError {
  constructor(
    message: string,
    public constraint: string,
    public referencedTable?: string
  ) {
    super(message, "FOREIGN_KEY_VIOLATION", "insert/update/delete", {
      constraint,
      referencedTable,
    });
    this.name = "ForeignKeyViolationError";
  }
}

/**
 * Not null constraint violation
 */
export class NotNullViolationError extends DatabaseError {
  constructor(message: string, public column?: string) {
    super(message, "NOT_NULL_VIOLATION", "insert/update", { column });
    this.name = "NotNullViolationError";
  }
}

/**
 * Check constraint violation
 */
export class CheckViolationError extends DatabaseError {
  constructor(message: string, public constraint?: string) {
    super(message, "CHECK_VIOLATION", "insert/update", { constraint });
    this.name = "CheckViolationError";
  }
}

/**
 * Parse PostgreSQL error and convert to typed error
 *
 * @param error - The error to parse (typically from pg/bun)
 * @param operation - The operation that was being performed
 * @returns A typed DatabaseError
 */
export function parseDatabaseError(
  error: unknown,
  operation: string
): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const err = error as Record<string, unknown>;

  // PostgreSQL error codes
  // https://www.postgresql.org/docs/current/errcodes-appendix.html

  if (err.code === "23505") {
    // unique_violation
    return new UniqueViolationError(
      err.message || "Unique constraint violation",
      err.constraint_name || err.constraint || "unknown",
      err.detail
    );
  }

  if (err.code === "23503") {
    // foreign_key_violation
    return new ForeignKeyViolationError(
      err.message || "Foreign key constraint violation",
      err.constraint_name || err.constraint || "unknown",
      err.detail
    );
  }

  if (err.code === "23502") {
    // not_null_violation
    return new NotNullViolationError(
      err.message || "Not null constraint violation",
      err.column_name || err.column
    );
  }

  if (err.code === "23514") {
    // check_violation
    return new CheckViolationError(
      err.message || "Check constraint violation",
      err.constraint_name || err.constraint
    );
  }

  // Connection errors
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return new DatabaseError(
      "Database connection failed",
      "CONNECTION_ERROR",
      operation,
      { originalCode: err.code },
      err
    );
  }

  // Generic query error
  return new DatabaseError(
    err.message || "Database query failed",
    "QUERY_ERROR",
    operation,
    { originalError: err },
    err
  );
}
