import { describe, test, expect } from "bun:test";
import {
  DatabaseError,
  EntityNotFoundError,
  EventNotFoundError,
  UniqueViolationError,
  ForeignKeyViolationError,
  NotNullViolationError,
  CheckViolationError,
  parseDatabaseError,
} from "@quailcomp/data";

describe("DatabaseError classes", () => {
  test("DatabaseError has correct properties", () => {
    const error = new DatabaseError(
      "Test error",
      "QUERY_ERROR",
      "test operation",
      { key: "value" },
      new Error("Original error")
    );

    expect(error.name).toBe("DatabaseError");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("QUERY_ERROR");
    expect(error.operation).toBe("test operation");
    expect(error.details).toEqual({ key: "value" });
    expect(error.cause).toBeInstanceOf(Error);
  });

  test("EntityNotFoundError has correct properties", () => {
    const error = new EntityNotFoundError(123, "book");

    expect(error.name).toBe("EntityNotFoundError");
    expect(error.message).toBe("Entity 123 not found (type: book)");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.operation).toBe("getById");
    expect(error.entityId).toBe(123);
    expect(error.entityType).toBe("book");
    expect(error.details).toEqual({ entityId: 123, entityType: "book" });
  });

  test("EntityNotFoundError without type", () => {
    const error = new EntityNotFoundError(456);

    expect(error.message).toBe("Entity 456 not found");
    expect(error.entityId).toBe(456);
    expect(error.entityType).toBeUndefined();
  });

  test("EventNotFoundError has correct properties", () => {
    const error = new EventNotFoundError(789, "purchase");

    expect(error.name).toBe("EventNotFoundError");
    expect(error.message).toBe("Event 789 not found (type: purchase)");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.operation).toBe("getById");
    expect(error.eventId).toBe(789);
    expect(error.eventType).toBe("purchase");
    expect(error.details).toEqual({ eventId: 789, eventType: "purchase" });
  });

  test("EventNotFoundError without type", () => {
    const error = new EventNotFoundError(321);

    expect(error.message).toBe("Event 321 not found");
    expect(error.eventId).toBe(321);
    expect(error.eventType).toBeUndefined();
  });

  test("UniqueViolationError has correct properties", () => {
    const error = new UniqueViolationError(
      "Duplicate email",
      "users_email_key",
      "test@example.com"
    );

    expect(error.name).toBe("UniqueViolationError");
    expect(error.message).toBe("Duplicate email");
    expect(error.code).toBe("UNIQUE_VIOLATION");
    expect(error.operation).toBe("insert/update");
    expect(error.constraint).toBe("users_email_key");
    expect(error.value).toBe("test@example.com");
  });

  test("ForeignKeyViolationError has correct properties", () => {
    const error = new ForeignKeyViolationError(
      "Referenced record not found",
      "fk_user_id",
      "users"
    );

    expect(error.name).toBe("ForeignKeyViolationError");
    expect(error.message).toBe("Referenced record not found");
    expect(error.code).toBe("FOREIGN_KEY_VIOLATION");
    expect(error.operation).toBe("insert/update/delete");
    expect(error.constraint).toBe("fk_user_id");
    expect(error.referencedTable).toBe("users");
  });

  test("NotNullViolationError has correct properties", () => {
    const error = new NotNullViolationError("Column cannot be null", "email");

    expect(error.name).toBe("NotNullViolationError");
    expect(error.message).toBe("Column cannot be null");
    expect(error.code).toBe("NOT_NULL_VIOLATION");
    expect(error.operation).toBe("insert/update");
    expect(error.column).toBe("email");
  });

  test("CheckViolationError has correct properties", () => {
    const error = new CheckViolationError("Check constraint failed", "age_positive");

    expect(error.name).toBe("CheckViolationError");
    expect(error.message).toBe("Check constraint failed");
    expect(error.code).toBe("CHECK_VIOLATION");
    expect(error.operation).toBe("insert/update");
    expect(error.constraint).toBe("age_positive");
  });
});

describe("parseDatabaseError", () => {
  test("returns DatabaseError as-is", () => {
    const original = new DatabaseError("Test", "QUERY_ERROR", "test");
    const parsed = parseDatabaseError(original, "operation");

    expect(parsed).toBe(original);
  });

  test("parses unique violation (23505)", () => {
    const pgError = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
      constraint_name: "users_email_key",
      detail: "Key (email)=(test@example.com) already exists.",
    };

    const error = parseDatabaseError(pgError, "insert");

    expect(error).toBeInstanceOf(UniqueViolationError);
    expect(error.code).toBe("UNIQUE_VIOLATION");
    expect(error.message).toBe("duplicate key value violates unique constraint");
    expect((error as UniqueViolationError).constraint).toBe("users_email_key");
  });

  test("parses unique violation with constraint fallback", () => {
    const pgError = {
      code: "23505",
      message: "duplicate key",
      constraint: "users_email_key",
    };

    const error = parseDatabaseError(pgError, "insert");

    expect(error).toBeInstanceOf(UniqueViolationError);
    expect((error as UniqueViolationError).constraint).toBe("users_email_key");
  });

  test("parses unique violation with unknown constraint", () => {
    const pgError = {
      code: "23505",
      message: "duplicate key",
    };

    const error = parseDatabaseError(pgError, "insert");

    expect(error).toBeInstanceOf(UniqueViolationError);
    expect((error as UniqueViolationError).constraint).toBe("unknown");
  });

  test("parses foreign key violation (23503)", () => {
    const pgError = {
      code: "23503",
      message: "foreign key constraint violated",
      constraint_name: "fk_user_id",
      detail: "Key (user_id)=(123) is not present in table users.",
    };

    const error = parseDatabaseError(pgError, "insert");

    expect(error).toBeInstanceOf(ForeignKeyViolationError);
    expect(error.code).toBe("FOREIGN_KEY_VIOLATION");
    expect((error as ForeignKeyViolationError).constraint).toBe("fk_user_id");
  });

  test("parses not null violation (23502)", () => {
    const pgError = {
      code: "23502",
      message: "null value in column violates not-null constraint",
      column_name: "email",
    };

    const error = parseDatabaseError(pgError, "insert");

    expect(error).toBeInstanceOf(NotNullViolationError);
    expect(error.code).toBe("NOT_NULL_VIOLATION");
    expect((error as NotNullViolationError).column).toBe("email");
  });

  test("parses not null violation with column fallback", () => {
    const pgError = {
      code: "23502",
      message: "null value",
      column: "email",
    };

    const error = parseDatabaseError(pgError, "insert");

    expect(error).toBeInstanceOf(NotNullViolationError);
    expect((error as NotNullViolationError).column).toBe("email");
  });

  test("parses check violation (23514)", () => {
    const pgError = {
      code: "23514",
      message: "check constraint violated",
      constraint_name: "age_positive",
    };

    const error = parseDatabaseError(pgError, "insert");

    expect(error).toBeInstanceOf(CheckViolationError);
    expect(error.code).toBe("CHECK_VIOLATION");
    expect((error as CheckViolationError).constraint).toBe("age_positive");
  });

  test("parses ECONNREFUSED as connection error", () => {
    const connError = {
      code: "ECONNREFUSED",
      message: "connect ECONNREFUSED 127.0.0.1:5432",
    };

    const error = parseDatabaseError(connError, "connect");

    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.code).toBe("CONNECTION_ERROR");
    expect(error.message).toBe("Database connection failed");
    expect(error.details).toEqual({ originalCode: "ECONNREFUSED" });
  });

  test("parses ENOTFOUND as connection error", () => {
    const connError = {
      code: "ENOTFOUND",
      message: "getaddrinfo ENOTFOUND localhost",
    };

    const error = parseDatabaseError(connError, "connect");

    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.code).toBe("CONNECTION_ERROR");
    expect(error.message).toBe("Database connection failed");
  });

  test("parses unknown error as generic query error", () => {
    const unknownError = {
      message: "Something went wrong",
    };

    const error = parseDatabaseError(unknownError, "query");

    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.code).toBe("QUERY_ERROR");
    expect(error.message).toBe("Something went wrong");
    expect(error.operation).toBe("query");
  });

  test("handles error without message", () => {
    const error = parseDatabaseError({}, "operation");

    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.code).toBe("QUERY_ERROR");
    expect(error.message).toBe("Database query failed");
  });

  test("preserves Error cause when available", () => {
    const originalError = new Error("Original error");
    const error = parseDatabaseError(originalError, "operation");

    expect(error.cause).toBe(originalError);
  });
});
