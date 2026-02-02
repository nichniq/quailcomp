/**
 * OpenAPI specification tests
 */

import { describe, expect, test } from "bun:test";
import { generateOpenAPISpec } from "@/openapi/spec";

describe("OpenAPI Specification", () => {
  test("generates valid OpenAPI 3.0 spec", () => {
    const spec = generateOpenAPISpec();

    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("Quailcomp API");
    expect(spec.info.version).toBe("1.0.0");
  });

  test("includes all main tags", () => {
    const spec = generateOpenAPISpec();

    const tagNames = spec.tags.map((tag) => tag.name);
    expect(tagNames).toContain("Health");
    expect(tagNames).toContain("Authentication");
    expect(tagNames).toContain("Books");
    expect(tagNames).toContain("Authorization");
  });

  test("includes health endpoint", () => {
    const spec = generateOpenAPISpec();

    expect(spec.paths["/health"]).toBeDefined();
    expect((spec.paths["/health"] as any).get).toBeDefined();
    expect((spec.paths["/health"] as any).get.tags).toContain("Health");
  });

  test("includes metrics endpoint", () => {
    const spec = generateOpenAPISpec();

    expect(spec.paths["/metrics"]).toBeDefined();
    expect(spec.paths["/metrics"].get).toBeDefined();
  });

  test("includes authentication endpoints", () => {
    const spec = generateOpenAPISpec();

    expect(spec.paths["/auth/register"]).toBeDefined();
    expect(spec.paths["/auth/register"].post).toBeDefined();

    expect(spec.paths["/auth/login"]).toBeDefined();
    expect(spec.paths["/auth/login"].post).toBeDefined();

    expect(spec.paths["/auth/me"]).toBeDefined();
    expect(spec.paths["/auth/me"].get).toBeDefined();
  });

  test("includes book endpoints", () => {
    const spec = generateOpenAPISpec();

    expect(spec.paths["/books"]).toBeDefined();
    expect(spec.paths["/books"].get).toBeDefined();
    expect(spec.paths["/books"].post).toBeDefined();

    expect(spec.paths["/books/{id}"]).toBeDefined();
    expect(spec.paths["/books/{id}"].get).toBeDefined();
    expect(spec.paths["/books/{id}"].put).toBeDefined();
    expect(spec.paths["/books/{id}"].delete).toBeDefined();

    expect(spec.paths["/books/metadata/lookup"]).toBeDefined();
    expect(spec.paths["/books/metadata/lookup"].post).toBeDefined();
  });

  test("includes authorization endpoints", () => {
    const spec = generateOpenAPISpec();

    expect(spec.paths["/entities/{id}/access"]).toBeDefined();
    expect(spec.paths["/entities/{id}/access"].get).toBeDefined();
    expect(spec.paths["/entities/{id}/access"].post).toBeDefined();

    expect(spec.paths["/entities/{id}/access/{userId}"]).toBeDefined();
    expect(spec.paths["/entities/{id}/access/{userId}"].delete).toBeDefined();

    expect(spec.paths["/entities/{id}/transfer"]).toBeDefined();
    expect(spec.paths["/entities/{id}/transfer"].post).toBeDefined();
  });

  test("includes bearer authentication security scheme", () => {
    const spec = generateOpenAPISpec();

    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect((spec.components.securitySchemes.bearerAuth as any).type).toBe("http");
    expect((spec.components.securitySchemes.bearerAuth as any).scheme).toBe("bearer");
  });

  test("includes all required schemas", () => {
    const spec = generateOpenAPISpec();

    const schemas = spec.components.schemas;
    expect(schemas.Error).toBeDefined();
    expect(schemas.User).toBeDefined();
    expect(schemas.RegisterRequest).toBeDefined();
    expect(schemas.LoginRequest).toBeDefined();
    expect(schemas.AuthResponse).toBeDefined();
    expect(schemas.BookSnapshot).toBeDefined();
    expect(schemas.BookEntity).toBeDefined();
    expect(schemas.AccessLevel).toBeDefined();
    expect(schemas.EntityAccess).toBeDefined();
    expect(schemas.AccessListItem).toBeDefined();
  });

  test("protected endpoints require authentication", () => {
    const spec = generateOpenAPISpec();

    // Check a few protected endpoints
    expect((spec.paths["/auth/me"] as any).get.security).toBeDefined();
    expect((spec.paths["/books"] as any).get.security).toBeDefined();
    expect((spec.paths["/books/{id}"] as any).get.security).toBeDefined();
  });

  test("public endpoints don't require authentication", () => {
    const spec = generateOpenAPISpec();

    // Health endpoint should not require auth
    expect((spec.paths["/health"] as any).get.security).toBeUndefined();

    // Login/register should not require auth
    expect((spec.paths["/auth/login"] as any).post.security).toBeUndefined();
    expect((spec.paths["/auth/register"] as any).post.security).toBeUndefined();
  });

  test("includes proper response codes", () => {
    const spec = generateOpenAPISpec();

    // Check health endpoint responses
    expect((spec.paths["/health"] as any).get.responses["200"]).toBeDefined();
    expect((spec.paths["/health"] as any).get.responses["503"]).toBeDefined();

    // Check book creation responses
    expect((spec.paths["/books"] as any).post.responses["201"]).toBeDefined();
    expect((spec.paths["/books"] as any).post.responses["400"]).toBeDefined();
    expect((spec.paths["/books"] as any).post.responses["401"]).toBeDefined();

    // Check book retrieval responses
    expect((spec.paths["/books/{id}"] as any).get.responses["200"]).toBeDefined();
    expect((spec.paths["/books/{id}"] as any).get.responses["400"]).toBeDefined();
    expect((spec.paths["/books/{id}"] as any).get.responses["403"]).toBeDefined();
    expect((spec.paths["/books/{id}"] as any).get.responses["404"]).toBeDefined();
  });
});
