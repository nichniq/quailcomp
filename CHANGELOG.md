# Changelog

All notable changes to the Quailcomp project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## Phase 5 - Advanced Features

### Session 1: People Domain (2026-02)

**Added**

- People domain for tracking authors, gift-givers, and borrowers
- Domain documentation in [domains/people.md](domains/people.md)
- REST API endpoints for People management:
  - `GET /people` - List all accessible people
  - `GET /people/:id` - Get single person details
  - `POST /people` - Create new person
  - `PUT /people/:id` - Update person information
  - `DELETE /people/:id` - Soft delete person
  - `GET /people/:id/books` - List books associated with person
- Database migration `004_people_domain.sql` with GIN indexes for name search
- Comprehensive test coverage in [server/tests/people.test.ts](server/tests/people.test.ts)
- Auto-generated TypeScript types in [domains/types/people.ts](domains/types/people.ts)

### Session 2: Series Domain (2026-02)

**Added**

- Series domain for tracking book series and collections
- Domain documentation in [domains/series.md](domains/series.md)
- REST API endpoints for Series management:
  - `GET /series` - List all accessible series
  - `GET /series/:id` - Get single series details
  - `POST /series` - Create new series
  - `PUT /series/:id` - Update series information
  - `DELETE /series/:id` - Soft delete series
  - `GET /series/:id/books` - List books in series with volume ordering
- Database migration `005_series_domain.sql` with series tracking indexes
- Comprehensive test coverage in [server/tests/series.test.ts](server/tests/series.test.ts)
- Auto-generated TypeScript types in [domains/types/series.ts](domains/types/series.ts)
- Volume numbering and ordering support for series books

### Session 6: Bulk Operations (2026-02)

**Added**

- Bulk import functionality for books in multiple formats:
  - CSV import with parser in [server/src/utils/import-parsers.ts](server/src/utils/import-parsers.ts)
  - JSON import support
  - XLSX (Excel) import support using `xlsx` library
- Bulk export functionality in multiple formats:
  - JSON export (default format)
  - CSV export with proper escaping
  - XLSX export with formatting
- Batch update endpoint for updating multiple books in single request:
  - `POST /books/import` - Import books from file
  - `GET /books/export` - Export books to specified format
  - `PUT /books/batch` - Update multiple books at once
- Export formatters in [server/src/utils/export-formatters.ts](server/src/utils/export-formatters.ts)
- Comprehensive test coverage in [server/tests/bulk-operations.test.ts](server/tests/bulk-operations.test.ts)
- Authorization enforcement on bulk operations (only accessible entities)

### Session 7: WebSocket Real-time Updates (2026-02)

**Added**

- WebSocket server for real-time entity updates
- WebSocket endpoint at `/ws` with JWT authentication
- Real-time event broadcasting system:
  - `entity.created` - Notifies when entities are created
  - `entity.updated` - Notifies when entities are updated
  - `entity.deleted` - Notifies when entities are deleted
- Subscription management:
  - Subscribe to specific entity IDs
  - Unsubscribe from entities
  - Authorization checks on subscriptions
- WebSocket server implementation in [server/src/websocket/server.ts](server/src/websocket/server.ts)
- Integration with route handlers for automatic broadcasting
- Comprehensive test coverage in [server/tests/websocket.test.ts](server/tests/websocket.test.ts)
- WebSocket documentation in [server/src/websocket/README.md](server/src/websocket/README.md)

**Security**

- JWT token authentication required for WebSocket connections
- Authorization enforced per subscription (users only receive updates for accessible entities)
- Automatic client disconnection on authentication failure

### Intentionally Deferred

The following Phase 5 components were intentionally deferred or skipped based on current requirements:

- **Session 3: Locations Domain** - Physical bookstore/location tracking not needed for current use case
- **Session 4: Metadata Enhancements (Caching)** - Using in-memory caching patterns; external cache (Redis) deferred
- **Session 5: Advanced Search** - Full-text search with PostgreSQL tsvector deferred to future phase
- **Step 7.4: Collaborative Editing** - Real-time collaborative editing deferred; basic WebSocket broadcasting sufficient for current needs

## Phase 4 - Testing & Observability (2026-01)

**Added**

- Comprehensive test suite with property-based testing
- End-to-end workflow tests
- GitHub Actions CI/CD pipeline
- Test coverage reporting
- OpenAPI/Swagger documentation
- Structured logging system

## Phase 3 - Authorization (2026-01)

**Added**

- Fine-grained authorization system
- Entity-level access control
- Read/write/owner permission levels
- Access control lists (ACLs)

## Phase 2 - Authentication (2026-01)

**Added**

- JWT-based authentication
- User registration and login
- Token refresh mechanism
- Password hashing with bcrypt

## Phase 1 - Core System (2025-12)

**Added**

- Event-sourced entities system
- PostgreSQL database with migrations
- Books domain implementation
- RESTful API with Bun
- Domain-driven design structure
- Type extraction from domain documentation
