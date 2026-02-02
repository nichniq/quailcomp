/**
 * OpenAPI 3.0 Specification for Quailcomp API
 *
 * This module generates the OpenAPI specification that documents all API endpoints.
 * The spec is used by Swagger UI at /api/docs
 */

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  tags: Array<{
    name: string;
    description: string;
  }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

/**
 * Generate the complete OpenAPI specification
 */
export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: "3.0.3",
    info: {
      title: "Quailcomp API",
      description: "Personal book cataloging system with event sourcing and authorization",
      version: "1.0.0",
    },
    servers: [
      {
        url: "/",
        description: "Current server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Health check and metrics endpoints",
      },
      {
        name: "Authentication",
        description: "User registration and login",
      },
      {
        name: "Books",
        description: "Book catalog management",
      },
      {
        name: "Authorization",
        description: "Entity access control",
      },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          description: "Check if the API and database are healthy",
          operationId: "healthCheck",
          responses: {
            "200": {
              description: "Service is healthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "healthy" },
                      database: { type: "string", example: "connected" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            "503": {
              description: "Service is unhealthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "unhealthy" },
                      database: { type: "string", example: "disconnected" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/metrics": {
        get: {
          tags: ["Health"],
          summary: "Prometheus metrics",
          description: "Get Prometheus-formatted metrics",
          operationId: "getMetrics",
          responses: {
            "200": {
              description: "Metrics in Prometheus text format",
              content: {
                "text/plain": {
                  schema: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
      "/metrics/json": {
        get: {
          tags: ["Health"],
          summary: "JSON metrics snapshot",
          description: "Get current metrics in JSON format",
          operationId: "getMetricsJson",
          responses: {
            "200": {
              description: "Current metrics snapshot",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/register": {
        post: {
          tags: ["Authentication"],
          summary: "Register new user",
          description: "Create a new user account with email and password",
          operationId: "register",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/RegisterRequest",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "User created successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AuthResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid request or user already exists",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Login",
          description: "Authenticate with email/username and password",
          operationId: "login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginRequest",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AuthResponse",
                  },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Authentication"],
          summary: "Get current user",
          description: "Get the currently authenticated user's profile",
          operationId: "getCurrentUser",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Current user profile",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: {
                        $ref: "#/components/schemas/User",
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Not authenticated",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/books": {
        get: {
          tags: ["Books"],
          summary: "List books",
          description: "Get all books the user has access to",
          operationId: "listBooks",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "List of books",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      books: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/BookEntity",
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Authentication required",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Books"],
          summary: "Create book",
          description: "Create a new book. The creator is automatically granted owner access.",
          operationId: "createBook",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/BookSnapshot",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Book created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      book: {
                        $ref: "#/components/schemas/BookEntity",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "401": {
              description: "Authentication required",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/books/{id}": {
        get: {
          tags: ["Books"],
          summary: "Get book",
          description: "Get a single book by ID. Requires read access.",
          operationId: "getBook",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Book entity ID",
              schema: {
                type: "integer",
              },
            },
          ],
          responses: {
            "200": {
              description: "Book details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      book: {
                        $ref: "#/components/schemas/BookEntity",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid book ID",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Access denied",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "404": {
              description: "Book not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        put: {
          tags: ["Books"],
          summary: "Update book",
          description: "Update an existing book. Requires write access.",
          operationId: "updateBook",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Book entity ID",
              schema: {
                type: "integer",
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/BookSnapshot",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Book updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      book: {
                        $ref: "#/components/schemas/BookEntity",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Access denied",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "404": {
              description: "Book not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Books"],
          summary: "Delete book",
          description: "Soft delete a book. Requires owner access.",
          operationId: "deleteBook",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Book entity ID",
              schema: {
                type: "integer",
              },
            },
          ],
          responses: {
            "200": {
              description: "Book deleted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      book: {
                        $ref: "#/components/schemas/BookEntity",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid book ID",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Access denied",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "404": {
              description: "Book not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/books/metadata/lookup": {
        post: {
          tags: ["Books"],
          summary: "Look up book metadata",
          description: "Look up book metadata from external providers by ISBN or LCCN",
          operationId: "lookupMetadata",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["identifier", "identifierType"],
                  properties: {
                    identifier: {
                      type: "string",
                      description: "ISBN or LCCN",
                      example: "9780316769488",
                    },
                    identifierType: {
                      type: "string",
                      enum: ["isbn", "lccn"],
                      description: "Type of identifier",
                      example: "isbn",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Metadata lookup results from all providers",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            provider: {
                              type: "string",
                              example: "google-books",
                            },
                            data: {
                              type: "object",
                              nullable: true,
                              description: "Book metadata if found",
                            },
                            error: {
                              type: "string",
                              nullable: true,
                              description: "Error message if lookup failed",
                            },
                            responseTime: {
                              type: "number",
                              description: "Response time in milliseconds",
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/entities/{id}/access": {
        get: {
          tags: ["Authorization"],
          summary: "List entity accessors",
          description: "List all users with access to an entity",
          operationId: "listEntityAccessors",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Entity ID",
              schema: {
                type: "integer",
              },
            },
          ],
          responses: {
            "200": {
              description: "List of users with access",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      accessors: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/AccessListItem",
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid entity ID",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Access denied",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Authorization"],
          summary: "Grant access",
          description: "Grant access to an entity. Requires owner access.",
          operationId: "grantAccess",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Entity ID",
              schema: {
                type: "integer",
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["userId", "accessLevel"],
                  properties: {
                    userId: {
                      type: "integer",
                      description: "User to grant access to",
                    },
                    accessLevel: {
                      $ref: "#/components/schemas/AccessLevel",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Access granted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      access: {
                        $ref: "#/components/schemas/EntityAccess",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Access denied",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/entities/{id}/access/{userId}": {
        delete: {
          tags: ["Authorization"],
          summary: "Revoke access",
          description: "Revoke a user's access to an entity. Requires owner access.",
          operationId: "revokeAccess",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Entity ID",
              schema: {
                type: "integer",
              },
            },
            {
              name: "userId",
              in: "path",
              required: true,
              description: "User ID to revoke access from",
              schema: {
                type: "integer",
              },
            },
          ],
          responses: {
            "200": {
              description: "Access revoked",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: {
                        type: "boolean",
                        example: true,
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid ID",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Access denied",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
      "/entities/{id}/transfer": {
        post: {
          tags: ["Authorization"],
          summary: "Transfer ownership",
          description: "Transfer ownership of an entity to another user. Requires owner access.",
          operationId: "transferOwnership",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Entity ID",
              schema: {
                type: "integer",
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["newOwnerId"],
                  properties: {
                    newOwnerId: {
                      type: "integer",
                      description: "New owner's user ID",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Ownership transferred",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: {
                        type: "boolean",
                        example: true,
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            "403": {
              description: "Access denied",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from /auth/login or /auth/register",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Human-readable error message",
            },
            code: {
              type: "string",
              description: "Machine-readable error code",
            },
          },
          required: ["error"],
        },
        User: {
          type: "object",
          properties: {
            userId: {
              type: "integer",
              description: "User ID",
            },
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
            },
            username: {
              type: "string",
              nullable: true,
              description: "User's username",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
            },
          },
          required: ["userId", "email"],
        },
        RegisterRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
              example: "user@example.com",
            },
            username: {
              type: "string",
              description: "Optional username",
              example: "bookworm",
            },
            password: {
              type: "string",
              format: "password",
              description: "User's password",
              example: "SecurePass123!",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["identifier", "password"],
          properties: {
            identifier: {
              type: "string",
              description: "Email or username",
              example: "user@example.com",
            },
            password: {
              type: "string",
              format: "password",
              description: "User's password",
              example: "SecurePass123!",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                userId: {
                  type: "integer",
                },
                email: {
                  type: "string",
                  format: "email",
                },
                username: {
                  type: "string",
                  nullable: true,
                },
              },
            },
            token: {
              type: "string",
              description: "JWT token for authentication",
            },
            expiresAt: {
              type: "string",
              format: "date-time",
              description: "Token expiration timestamp",
            },
          },
          required: ["user", "token", "expiresAt"],
        },
        BookSnapshot: {
          type: "object",
          description: "Book data without metadata fields",
          properties: {
            title: {
              type: "string",
              example: "The Catcher in the Rye",
            },
            subtitle: {
              type: "string",
              example: "A Novel",
            },
            author: {
              type: "string",
              example: "J.D. Salinger",
            },
            series_id: {
              type: "string",
              description: "Reference to a series entity",
            },
            isbn10: {
              type: "string",
              example: "0316769487",
            },
            isbn13: {
              type: "string",
              example: "9780316769488",
            },
            lccn: {
              type: "string",
              description: "Library of Congress Control Number",
            },
            note: {
              type: "string",
              description: "Personal notes about the book",
            },
          },
        },
        BookEntity: {
          type: "object",
          description: "Book entity with metadata",
          properties: {
            entityId: {
              type: "integer",
              description: "Unique entity ID",
            },
            type: {
              type: "string",
              example: "book",
            },
            data: {
              $ref: "#/components/schemas/BookSnapshot",
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
            deletedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
          },
          required: ["entityId", "type", "data", "createdAt", "updatedAt"],
        },
        AccessLevel: {
          type: "string",
          enum: ["owner", "write", "read"],
          description: "Access level: owner (full control), write (can edit), read (view only)",
        },
        EntityAccess: {
          type: "object",
          properties: {
            entityId: {
              type: "integer",
            },
            userId: {
              type: "integer",
            },
            accessLevel: {
              $ref: "#/components/schemas/AccessLevel",
            },
            grantedAt: {
              type: "string",
              format: "date-time",
            },
            grantedBy: {
              type: "integer",
              nullable: true,
              description: "User ID who granted this access",
            },
          },
          required: ["entityId", "userId", "accessLevel", "grantedAt"],
        },
        AccessListItem: {
          type: "object",
          properties: {
            userId: {
              type: "integer",
            },
            email: {
              type: "string",
              format: "email",
            },
            username: {
              type: "string",
              nullable: true,
            },
            accessLevel: {
              $ref: "#/components/schemas/AccessLevel",
            },
            grantedAt: {
              type: "string",
              format: "date-time",
            },
            grantedBy: {
              type: "integer",
              nullable: true,
            },
          },
          required: ["userId", "email", "accessLevel", "grantedAt"],
        },
      },
    },
  };
}
