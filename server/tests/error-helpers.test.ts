/**
 * Tests for error helper functions
 */

import { describe, test, expect } from "bun:test";
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  getValidEntityId,
  parseJsonBody,
} from "@/utils/error-responses";
import { validate } from "@/utils/validation";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from "@/middleware/error-handler";

describe("Error response helpers", () => {
  test("badRequest throws BadRequestError", () => {
    expect(() => badRequest("Test error", "TEST_CODE")).toThrow(
      BadRequestError
    );
  });

  test("badRequest includes code and message", () => {
    try {
      badRequest("Test error", "TEST_CODE");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).message).toBe("Test error");
      expect((error as BadRequestError).code).toBe("TEST_CODE");
      expect((error as BadRequestError).statusCode).toBe(400);
    }
  });

  test("unauthorized throws UnauthorizedError", () => {
    expect(() => unauthorized()).toThrow(UnauthorizedError);
  });

  test("unauthorized uses default message", () => {
    try {
      unauthorized();
    } catch (error) {
      expect((error as UnauthorizedError).message).toBe(
        "Authentication required"
      );
      expect((error as UnauthorizedError).statusCode).toBe(401);
    }
  });

  test("forbidden throws ForbiddenError", () => {
    expect(() => forbidden()).toThrow(ForbiddenError);
  });

  test("notFound throws NotFoundError", () => {
    expect(() => notFound("Resource not found", "NOT_FOUND")).toThrow(
      NotFoundError
    );
  });

  test("conflict throws ConflictError", () => {
    expect(() => conflict("Duplicate resource", "DUPLICATE")).toThrow(
      ConflictError
    );
  });

  test("validationError throws ValidationError with fields", () => {
    const fields = [
      { field: "name", message: "name is required", value: "" },
      { field: "email", message: "email is invalid", value: "bad-email" },
    ];

    try {
      validationError("Validation failed", fields);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).code).toBe("VALIDATION_ERROR");
      expect((error as ValidationError).fields).toEqual(fields);
    }
  });
});

describe("getValidEntityId", () => {
  test("returns valid ID", () => {
    const id = getValidEntityId({ id: "123" });
    expect(id).toBe(123);
  });

  test("returns valid ID for large numbers", () => {
    const id = getValidEntityId({ id: "999999" });
    expect(id).toBe(999999);
  });

  test("throws on invalid ID", () => {
    expect(() => getValidEntityId({ id: "abc" })).toThrow(BadRequestError);
  });

  test("throws on empty ID", () => {
    expect(() => getValidEntityId({ id: "" })).toThrow(BadRequestError);
  });

  test("throws on NaN", () => {
    expect(() => getValidEntityId({ id: "NaN" })).toThrow(BadRequestError);
  });

  test("includes entity type in error message", () => {
    try {
      getValidEntityId({ id: "abc" }, "book");
    } catch (error) {
      expect((error as BadRequestError).message).toContain("book");
    }
  });
});

describe("parseJsonBody", () => {
  test("parses valid JSON", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Test", value: 123 }),
      headers: { "Content-Type": "application/json" },
    });

    const body = await parseJsonBody<{ name: string; value: number }>(req);
    expect(body.name).toBe("Test");
    expect(body.value).toBe(123);
  });

  test("throws on invalid JSON", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "invalid json",
      headers: { "Content-Type": "text/plain" },
    });

    try {
      await parseJsonBody(req);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).code).toBe("INVALID_BODY");
    }
  });

  test("parses empty object", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });

    const body = await parseJsonBody(req);
    expect(body).toEqual({});
  });
});

describe("Validator", () => {
  test("validates required fields", () => {
    expect(() => {
      validate().required("name", "").validate();
    }).toThrow(ValidationError);
  });

  test("required passes for non-empty string", () => {
    expect(() => {
      validate().required("name", "Test").validate();
    }).not.toThrow();
  });

  test("required fails for null", () => {
    expect(() => {
      validate().required("name", null).validate();
    }).toThrow(ValidationError);
  });

  test("required fails for undefined", () => {
    expect(() => {
      validate().required("name", undefined).validate();
    }).toThrow(ValidationError);
  });

  test("validates string min length", () => {
    expect(() => {
      validate().minLength("password", "abc", 8).validate();
    }).toThrow(ValidationError);
  });

  test("minLength passes when meets requirement", () => {
    expect(() => {
      validate().minLength("password", "12345678", 8).validate();
    }).not.toThrow();
  });

  test("validates string max length", () => {
    expect(() => {
      validate().maxLength("username", "verylongusername", 10).validate();
    }).toThrow(ValidationError);
  });

  test("maxLength passes when meets requirement", () => {
    expect(() => {
      validate().maxLength("username", "short", 10).validate();
    }).not.toThrow();
  });

  test("validates array not empty", () => {
    expect(() => {
      validate().arrayNotEmpty("items", []).validate();
    }).toThrow(ValidationError);
  });

  test("arrayNotEmpty passes for non-empty array", () => {
    expect(() => {
      validate().arrayNotEmpty("items", [1, 2, 3]).validate();
    }).not.toThrow();
  });

  test("validates positive numbers", () => {
    expect(() => {
      validate().positive("count", -5).validate();
    }).toThrow(ValidationError);
  });

  test("positive passes for positive numbers", () => {
    expect(() => {
      validate().positive("count", 10).validate();
    }).not.toThrow();
  });

  test("validates number range", () => {
    expect(() => {
      validate().range("age", 150, 0, 120).validate();
    }).toThrow(ValidationError);
  });

  test("range passes for valid number", () => {
    expect(() => {
      validate().range("age", 25, 0, 120).validate();
    }).not.toThrow();
  });

  test("validates email format", () => {
    expect(() => {
      validate().email("email", "invalid-email").validate();
    }).toThrow(ValidationError);
  });

  test("email passes for valid email", () => {
    expect(() => {
      validate().email("email", "test@example.com").validate();
    }).not.toThrow();
  });

  test("collects multiple errors", () => {
    const validator = validate()
      .required("name", "")
      .required("email", null)
      .minLength("password", "abc", 8);

    expect(validator.getErrors()).toHaveLength(3);
    expect(validator.hasErrors()).toBe(true);
  });

  test("custom validation", () => {
    expect(() => {
      validate()
        .custom("age", 15 < 18, "Must be 18 or older")
        .validate();
    }).toThrow(ValidationError);
  });

  test("custom validation passes when condition is false", () => {
    expect(() => {
      validate()
        .custom("age", 20 < 18, "Must be 18 or older")
        .validate();
    }).not.toThrow();
  });

  test("fluent API chains methods", () => {
    expect(() => {
      validate()
        .required("name", "Test")
        .minLength("name", "Test", 3)
        .maxLength("name", "Test", 10)
        .validate();
    }).not.toThrow();
  });

  test("includes field values in error details", () => {
    try {
      validate().required("email", "").validate();
    } catch (error) {
      const validationError = error as ValidationError;
      expect(validationError.fields[0].field).toBe("email");
      expect(validationError.fields[0].value).toBe("");
    }
  });

  test("custom error messages", () => {
    try {
      validate()
        .required("name", "", "Please provide your name")
        .validate();
    } catch (error) {
      const validationError = error as ValidationError;
      expect(validationError.fields[0].message).toBe("Please provide your name");
    }
  });
});
