/**
 * Error Handler, CORS, and Compose Middleware Test Suite
 *
 * Tests for:
 * - Error handler middleware (HttpError handling, unknown error handling)
 * - CORS middleware (headers, preflight, origin validation)
 * - Middleware composition (compose, applyMiddleware)
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import {
  errorHandler,
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/middleware/error-handler";
import { cors, defaultCors } from "@/middleware/cors";
import { compose, applyMiddleware } from "@/middleware/compose";
import { createContext, type RequestContext } from "@/context";
import type { Handler, Middleware } from "@/middleware/types";

// Test database setup
let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
});

// Test helpers
function createMockHandler(responseText: string = "success"): Handler {
  return async (ctx: RequestContext, req: Request) => {
    return new Response(responseText);
  };
}

async function getResponseJSON(response: Response): Promise<any> {
  return response.json();
}

// =============================================================================
// Error Handler Tests
// =============================================================================

describe("HttpError classes", () => {
  test("BadRequestError has 400 status", () => {
    const error = new BadRequestError("Invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Invalid input");
    expect(error.name).toBe("BadRequestError");
  });

  test("UnauthorizedError has 401 status", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Authentication required");
    expect(error.name).toBe("UnauthorizedError");
  });

  test("ForbiddenError has 403 status", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("Access denied");
    expect(error.name).toBe("ForbiddenError");
  });

  test("NotFoundError has 404 status", () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error.name).toBe("NotFoundError");
  });

  test("ConflictError has 409 status", () => {
    const error = new ConflictError("Resource already exists");
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("Resource already exists");
    expect(error.name).toBe("ConflictError");
  });

  test("HttpError can include error code", () => {
    const error = new BadRequestError("Invalid", "VALIDATION_ERROR");
    expect(error.code).toBe("VALIDATION_ERROR");
  });
});

describe("errorHandler middleware", () => {
  test("passes through successful response", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler("all good");
    const middleware = errorHandler(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("all good");
  });

  test("catches BadRequestError and returns 400", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw new BadRequestError("Missing required field");
    };
    const middleware = errorHandler(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(400);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Missing required field");
  });

  test("catches UnauthorizedError and returns 401", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw new UnauthorizedError("Token expired");
    };
    const middleware = errorHandler(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(401);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Token expired");
  });

  test("catches NotFoundError and returns 404", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw new NotFoundError("User not found");
    };
    const middleware = errorHandler(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(404);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("User not found");
  });

  test("includes error code in response when provided", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw new BadRequestError("Validation failed", "VALIDATION_ERROR");
    };
    const middleware = errorHandler(handler);

    const response = await middleware(ctx, request);

    const body = await getResponseJSON(response);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  test("catches unknown errors and returns 500", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw new Error("Unexpected database error");
    };
    const middleware = errorHandler(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(500);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Internal server error");
  });

  test("handles non-Error throws", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler: Handler = async () => {
      throw "string error";
    };
    const middleware = errorHandler(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(500);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Internal server error");
  });
});

// =============================================================================
// CORS Middleware Tests
// =============================================================================

describe("cors middleware", () => {
  test("handles preflight OPTIONS request", async () => {
    const request = new Request("http://localhost/test", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = cors()(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  test("adds CORS headers to normal requests", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Origin: "https://example.com",
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler("data");
    const middleware = cors()(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("allows specific origin", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Origin: "https://allowed.com",
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = cors({ origin: "https://allowed.com" })(handler);

    const response = await middleware(ctx, request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://allowed.com");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  test("rejects non-allowed origin", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        Origin: "https://blocked.com",
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = cors({ origin: "https://allowed.com" })(handler);

    const response = await middleware(ctx, request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("allows multiple origins", async () => {
    const allowedOrigins = ["https://one.com", "https://two.com"];

    const request1 = new Request("http://localhost/test", {
      headers: { Origin: "https://one.com" },
    });
    const ctx1 = createContext(request1, sql);
    const middleware1 = cors({ origin: allowedOrigins })(createMockHandler());
    const response1 = await middleware1(ctx1, request1);

    expect(response1.headers.get("Access-Control-Allow-Origin")).toBe("https://one.com");

    const request2 = new Request("http://localhost/test", {
      headers: { Origin: "https://two.com" },
    });
    const ctx2 = createContext(request2, sql);
    const middleware2 = cors({ origin: allowedOrigins })(createMockHandler());
    const response2 = await middleware2(ctx2, request2);

    expect(response2.headers.get("Access-Control-Allow-Origin")).toBe("https://two.com");
  });

  test("supports origin validation function", async () => {
    const isOriginAllowed = (origin: string) => origin.endsWith(".example.com");

    const request = new Request("http://localhost/test", {
      headers: { Origin: "https://sub.example.com" },
    });
    const ctx = createContext(request, sql);
    const middleware = cors({ origin: isOriginAllowed })(createMockHandler());

    const response = await middleware(ctx, request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://sub.example.com");
  });

  test("sets credentials header when enabled", async () => {
    const request = new Request("http://localhost/test", {
      headers: { Origin: "https://example.com" },
    });
    const ctx = createContext(request, sql);
    const middleware = cors({
      origin: "https://example.com",
      credentials: true,
    })(createMockHandler());

    const response = await middleware(ctx, request);

    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  test("sets exposed headers", async () => {
    const request = new Request("http://localhost/test", {
      headers: { Origin: "https://example.com" },
    });
    const ctx = createContext(request, sql);
    const middleware = cors({
      exposedHeaders: ["X-Custom-Header", "X-Request-Id"],
    })(createMockHandler());

    const response = await middleware(ctx, request);

    expect(response.headers.get("Access-Control-Expose-Headers")).toBe(
      "X-Custom-Header, X-Request-Id"
    );
  });

  test("defaultCors allows configured origins", async () => {
    const request = new Request("http://localhost/test", {
      headers: { Origin: "http://localhost:5173" },
    });
    const ctx = createContext(request, sql);
    const middleware = defaultCors(createMockHandler());

    const response = await middleware(ctx, request);

    // In test environment, defaultCors uses "*" for all origins (not production mode)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
});

// =============================================================================
// Compose Middleware Tests
// =============================================================================

describe("compose middleware", () => {
  test("composes middleware in left-to-right execution order", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);

    const executionOrder: number[] = [];

    const middleware1: Middleware = (next) => async (ctx, req) => {
      executionOrder.push(1);
      const response = await next(ctx, req);
      executionOrder.push(4);
      return response;
    };

    const middleware2: Middleware = (next) => async (ctx, req) => {
      executionOrder.push(2);
      const response = await next(ctx, req);
      executionOrder.push(3);
      return response;
    };

    const handler = createMockHandler("result");
    const composed = compose(middleware1, middleware2)(handler);

    await composed(ctx, request);

    expect(executionOrder).toEqual([1, 2, 3, 4]);
  });

  test("middleware can short-circuit by not calling next", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);

    let handlerCalled = false;

    const shortCircuit: Middleware = (next) => async (ctx, req) => {
      return new Response("short-circuited");
    };

    const handler: Handler = async () => {
      handlerCalled = true;
      return new Response("handler-response");
    };

    const composed = compose(shortCircuit)(handler);
    const response = await composed(ctx, request);

    expect(await response.text()).toBe("short-circuited");
    expect(handlerCalled).toBe(false);
  });

  test("middleware can modify context", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);

    const addParam: Middleware = (next) => async (ctx, req) => {
      ctx.params.userId = "123";
      return next(ctx, req);
    };

    const handler: Handler = async (ctx) => {
      return new Response(ctx.params.userId);
    };

    const composed = compose(addParam)(handler);
    const response = await composed(ctx, request);

    expect(await response.text()).toBe("123");
  });

  test("compose handles errors from middleware", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);

    const throwError: Middleware = (next) => async (ctx, req) => {
      throw new BadRequestError("Middleware error");
    };

    const handler = createMockHandler();
    const composed = compose(errorHandler, throwError)(handler);

    const response = await composed(ctx, request);

    expect(response.status).toBe(400);
    const body = await getResponseJSON(response);
    expect(body.error).toBe("Middleware error");
  });

  test("applyMiddleware is equivalent to compose", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);

    const executionOrder: number[] = [];

    const middleware1: Middleware = (next) => async (ctx, req) => {
      executionOrder.push(1);
      return next(ctx, req);
    };

    const middleware2: Middleware = (next) => async (ctx, req) => {
      executionOrder.push(2);
      return next(ctx, req);
    };

    const handler = createMockHandler();
    const applied = applyMiddleware(handler, middleware1, middleware2);

    await applied(ctx, request);

    expect(executionOrder).toEqual([1, 2]);
  });

  test("empty compose returns handler unchanged", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);

    const handler = createMockHandler("unchanged");
    const composed = compose()(handler);

    const response = await composed(ctx, request);

    expect(await response.text()).toBe("unchanged");
  });
});
