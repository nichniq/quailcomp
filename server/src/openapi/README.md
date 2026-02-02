# OpenAPI Specification

This directory contains the OpenAPI 3.0 specification generator for the Quailcomp API.

## Files

- [spec.ts](spec.ts) - OpenAPI 3.0 specification generator

## Overview

The OpenAPI specification provides machine-readable documentation of all API endpoints, request/response schemas, and authentication requirements. This specification powers the interactive Swagger UI interface.

## Usage

The specification is served through two endpoints:

- `GET /api/openapi.json` - JSON specification (consumed by Swagger UI)
- `GET /api/docs` - Interactive Swagger UI interface

## Structure

The specification includes:

- **Info** - API title, description, and version
- **Tags** - Endpoint categories (Health, Authentication, Books, Authorization)
- **Paths** - All API endpoints with operations, parameters, and responses
- **Components** - Reusable schemas and security schemes
  - **Schemas** - Data models (User, Book, Error, etc.)
  - **Security Schemes** - JWT bearer authentication

## Adding New Endpoints

When adding new API endpoints, update the specification:

1. Add a new tag if introducing a new resource category
2. Define the path and operation in the `paths` object
3. Add request/response schemas to `components.schemas`
4. Specify security requirements if authentication is needed

Example:

```typescript
paths: {
  "/my-resource": {
    get: {
      tags: ["MyResource"],
      summary: "List resources",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "List of resources",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: { $ref: "#/components/schemas/MyResource" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Testing

Tests are located in [tests/openapi.test.ts](../../tests/openapi.test.ts).

Run tests with:

```bash
bun test tests/openapi.test.ts
```

## References

- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
