<!-- markdownlint-disable -->

# QuailComp Project-Wide Refactor Plan

## Context

This is an **educational refactoring project** with aggressive scope: rewriting every file to establish consistent patterns, decouple subsystems, and rebuild documentation from a beginner's perspective. The goal is not just to improve the codebase, but to deeply understand refactoring as a project lifecycle phase.

**Key Motivations:**
- Learn refactoring patterns and techniques through hands-on practice
- Ensure every line of code reflects your personal style and patterns
- Maximize decoupling and isolation between subsystems
- Rebuild documentation for developers new to the project
- Minimize external dependencies where feasible
- Rebuild test suite from scratch with better organization

**Approach:** Start with foundational, zero-dependency pieces and progressively build up complexity. Each layer will be completely rewritten before moving to the next.

---

## Dependency Hierarchy & Refactoring Order

The QuailComp architecture has 7 layers, from foundation to application. We'll refactor bottom-up:

```
Layer 0: Configuration & Build System
  ↓
Layer 1: Domain System (types, documentation)
  ↓
Layer 2: Core Utilities (logging, errors, metrics)
  ↓
Layer 3: Data Layer (database connection, entities, events)
  ↓
Layer 4: Business Services (auth, authorization, analytics, metadata)
  ↓
Layer 5: API Layer (server, routes, middleware, WebSocket)
  ↓
Layer 6: Applications (frontend, CLI, devtools)
```

---

## Phase-by-Phase Refactoring Strategy

### **Phase 0: Preparation & Infrastructure**
**Goal:** Establish baseline, freeze features, and set up infrastructure for the refactor.

**Tasks:**

**0.1: Project Baseline**
1. Document current test coverage and functionality
2. Create refactoring branch: `refactor/project-wide-2026`
3. Capture architectural decisions that should be preserved vs. reconsidered
4. Identify external dependencies to potentially replace

**0.2: Testing Strategy & Infrastructure** ⭐️
1. Create comprehensive testing strategy document
2. Set up test organization structure (unit, integration, e2e, factories, helpers)
3. Create test utilities and factory patterns
4. Document testing philosophy and patterns
5. Set up test templates for each layer

**0.3: Documentation Hub** ⭐️
1. Create documentation structure and templates
2. Set up refactoring journal for ongoing notes
3. Create "decision log" template for architectural choices
4. Set up documentation validation (links, examples, consistency)
5. Create quick-capture system for documenting discoveries during refactoring

**0.4: DevTools UI Foundation** ⭐️
1. Create minimal devtools UI skeleton (Vue 3 + Vite)
2. Set up plugin/panel architecture for adding visibility features incrementally
3. Create devtools server with API endpoints for each subsystem
4. Set up hot-reload development workflow
5. Create panel templates for common patterns (logs viewer, metrics dashboard, entity browser)

**Deliverables:**

**Baseline:**
- `docs/refactor-baseline.md` - Current state snapshot
- New git branch for all refactor work

**Testing Infrastructure:**
- `docs/testing-strategy.md` - Comprehensive testing approach
- `tests/README.md` - Test organization guide
- `tests/factories/README.md` - Factory pattern examples
- `tests/helpers/README.md` - Test utility documentation
- `tests/templates/` - Test file templates for each layer
  - `tests/templates/unit-test.template.ts`
  - `tests/templates/integration-test.template.ts`
  - `tests/templates/component-test.template.ts`
- `tests/.test-conventions.md` - Testing conventions and patterns

**Documentation Hub:**
- `docs/refactor-journal.md` - Running log of decisions and learnings
- `docs/decision-log.md` - Template for architectural decisions (date, context, decision, alternatives, rationale)
- `docs/.doc-templates/` - Documentation templates
  - `docs/.doc-templates/how-to.template.md`
  - `docs/.doc-templates/explanation.template.md`
  - `docs/.doc-templates/reference.template.md`
  - `docs/.doc-templates/directory-readme.template.md`
- `docs/.quick-capture.md` - Scratch pad for quick notes during refactoring
- `docs/.doc-validation.ts` - Script to validate documentation (links, examples, consistency)

**DevTools UI Foundation:**
- `devtools-refactor/` - New devtools UI (separate from old devtools during refactor)
  - `ui/` - Vue 3 application
    - `src/main.ts` - Entry point
    - `src/App.vue` - Shell with navigation
    - `src/router.ts` - Panel routing
    - `src/panels/` - Panel components directory (empty initially)
    - `src/components/` - Shared UI components
    - `src/api/` - API client for devtools server
  - `server.ts` - Devtools API server
  - `plugins/` - Plugin system for adding panels
    - `plugins/README.md` - How to add new panels
    - `plugins/.panel-template/` - Template for creating new panels
  - `README.md` - Devtools architecture and usage guide
- Panel templates ready to use:
  - `devtools-refactor/ui/src/panels/.templates/LogsPanel.template.vue`
  - `devtools-refactor/ui/src/panels/.templates/MetricsPanel.template.vue`
  - `devtools-refactor/ui/src/panels/.templates/EntityBrowser.template.vue`
  - `devtools-refactor/ui/src/panels/.templates/ConfigViewer.template.vue`

**Why Front-Load These?**
- **Testing Strategy:** Knowing your testing approach from day 1 means every rewritten module can immediately have proper tests. No backfilling tests later.
- **Documentation Hub:** As you discover patterns, make decisions, and learn during refactoring, you can immediately document them. The journal becomes a living artifact of your learning process.
- **DevTools UI:** As you finish each subsystem (logging, metrics, entities, etc.), immediately add visibility through a devtools panel. This provides instant feedback and makes debugging the refactor easier.

---

### **Phase 1: Configuration & Build System** (Layer 0)
**Dependencies:** None
**Estimated Complexity:** Low

**Critical Files:**
- `/package.json` - Root workspace configuration
- `/tsconfig.json` - TypeScript project references
- `/tsconfig.base.json` - Shared TypeScript settings
- Workspace `package.json` files (data/client, server, frontend, cli, services/book-metadata)
- Workspace `tsconfig.json` files

**Refactoring Goals:**
1. **Evaluate workspace structure:** Is the current monorepo organization optimal? Consider:
   - Should devtools be a workspace?
   - Is `data/client` the right name, or should it be `@quailcomp/database`?
   - Should domain scripts be a separate workspace?

2. **Minimize root dependencies:**
   - Current: `minimatch`, `xlsx`
   - Evaluate if `minimatch` can be replaced with native Bun glob patterns
   - Keep `xlsx` only if CLI export functionality requires it

3. **Consolidate TypeScript configuration:**
   - Review path aliases (`@/*`, `@domains/types/*`)
   - Ensure consistent compiler options across workspaces
   - Document why project references are structured this way

4. **Simplify build scripts:**
   - Current 30+ npm scripts - can these be reduced?
   - Consider replacing `concurrently` with a custom script
   - Standardize script naming conventions

**New Test Suite:**
- `tests/workspace-structure.test.ts` - Validate workspace dependencies
- `tests/typescript-config.test.ts` - Ensure consistent TS settings
- `tests/scripts.test.ts` - Test build/dev/test scripts work correctly

**Documentation:**
- Rewrite workspace structure explanation in `docs/getting-started.md`
- Add "Why This Structure?" section to root README
- Document TypeScript project references for beginners

**Key Question to Answer:** Do we need the workspace pattern, or would a simpler structure suffice?

---

### **Phase 2: Domain System** (Layer 1)
**Dependencies:** TypeScript configuration
**Estimated Complexity:** Medium

**Critical Files:**
- `domains/*.md` - 18 domain documentation files
- `domains/scripts/extract-types.ts` - Type extraction from markdown
- `domains/scripts/generate-index.ts` - Index generation
- `domains/types/*.ts` - Auto-generated type files (deleted and regenerated)

**Refactoring Goals:**
1. **Evaluate domain-driven design patterns:**
   - Are 18 domains the right granularity?
   - Should some be merged (e.g., entities + events)?
   - Are new domains needed (e.g., testing, deployment)?

2. **Rewrite type extraction system:**
   - Current script extracts TypeScript from markdown code blocks
   - Consider: Should this be a more robust parser?
   - Add validation that types are actually exported
   - Improve error messages for invalid domain files

3. **Enhance domain documentation:**
   - Add "When to use this domain" section to each `.md`
   - Include real code examples from the project
   - Add cross-domain relationship diagrams
   - Rewrite from beginner perspective (no assumed knowledge)

4. **Minimize dependencies:**
   - Current domain scripts have minimal deps, keep it that way
   - Consider replacing any external parsers with custom code

**Domain Files to Rewrite (in order of independence):**
1. `errors.md` - No dependencies
2. `logging.md` - Depends on errors
3. `metrics.md` - Depends on errors
4. `configuration.md` - Depends on errors
5. `database.md` - Depends on configuration, logging, errors
6. `entities.md` - Depends on database
7. `events.md` - Depends on database
8. `authentication.md` - Depends on entities
9. `authorization.md` - Depends on entities, authentication
10. `analytics.md` - Depends on events
11. `http.md` - Depends on errors, logging
12. `websocket.md` - Depends on http
13. `books.md` - Application domain
14. `people.md` - Application domain
15. `series.md` - Application domain
16. `book-metadata-services.md` - Infrastructure domain
17. `devtools.md` - Infrastructure domain

**New Test Suite:**
- `domains/tests/extraction.test.ts` - Type extraction validation
- `domains/tests/consistency.test.ts` - Cross-domain reference validation
- `domains/tests/documentation.test.ts` - Markdown quality checks

**Documentation:**
- `domains/README.md` - Rewrite with beginner-friendly explanation
- `docs/explanation/domain-driven-design.md` - NEW, explain DDD principles
- `docs/how-to/create-domain.md` - Rewrite tutorial for adding domains

**Key Question to Answer:** Is the markdown-first approach optimal, or should we generate docs from code?

---

### **Phase 3: Core Utilities** (Layer 2)
**Dependencies:** Domain types
**Estimated Complexity:** Low-Medium

**Subsystems:**
1. **Logging** - Pino structured logging
2. **Errors** - Custom error types
3. **Metrics** - In-memory metrics collection

**Critical Files:**
- TBD based on current implementation (likely in `server/src/utils/` or similar)

**Refactoring Goals:**
1. **Logging System:**
   - Evaluate Pino vs. custom logger
   - Consider: Do we need all Pino features, or can we write a simpler logger?
   - Ensure consistent log format across all subsystems
   - Add structured logging helpers (e.g., `logger.withContext()`)

2. **Error Handling:**
   - Create error hierarchy (base error, HTTP errors, database errors, etc.)
   - Standardize error serialization (for API responses)
   - Add error recovery patterns
   - Write custom error classes to minimize dependencies

3. **Metrics Collection:**
   - Current: In-memory counters/histograms
   - Evaluate: Is this sufficient, or do we need persistent metrics?
   - Consider replacing with custom implementation (no external library)
   - Add metric aggregation and reporting

4. **Extract reusable utilities:**
   - Look for repeated patterns across codebase
   - Create utilities for: validation, parsing, formatting, etc.
   - Organize into clear modules

**New Test Suite:**
- `tests/logging.test.ts` - Logger functionality
- `tests/errors.test.ts` - Error handling patterns
- `tests/metrics.test.ts` - Metrics collection and reporting
- `tests/utilities.test.ts` - Utility functions

**Documentation:**
- `docs/explanation/error-handling.md` - NEW, error patterns
- `docs/explanation/logging-strategy.md` - NEW, logging philosophy
- `docs/reference/utilities.md` - NEW, utility function reference

**DevTools Panels to Add:** 🔧
After completing each subsystem, add a devtools panel for visibility:
- **Logging complete** → Add `LogsPanel.vue` (real-time log viewer with filtering)
- **Metrics complete** → Add `MetricsPanel.vue` (live metrics dashboard with charts)
- **Errors complete** → Add error tracking to logs panel

**Key Question to Answer:** Which external libraries (Pino, Zod, etc.) can we replace with custom code?

---

### **Phase 4: Data Layer** (Layer 3)
**Dependencies:** Core utilities, domain types
**Estimated Complexity:** High

**Critical Files:**
- `data/client/src/connection.ts` - PostgreSQL connection management
- `data/client/src/entities.ts` - EntitiesClient (mutable data)
- `data/client/src/events.ts` - EventsClient (immutable events)
- `data/client/src/index.ts` - Package exports
- `data/postgres/migrations/*.sql` - Database migrations (41 files)
- `data/postgres/setup.sql` - Database initialization

**Refactoring Goals:**
1. **Evaluate event sourcing architecture:**
   - Is append-only storage the right pattern for all data?
   - Should entities and events share infrastructure or be separate?
   - Consider CQRS patterns (separate read/write models)
   - Evaluate soft deletes vs. hard deletes

2. **Rewrite database clients:**
   - Current: `EntitiesClient` and `EventsClient` with similar patterns
   - Create base client class with shared functionality
   - Improve type safety (eliminate `any` types)
   - Add query builder patterns for complex queries
   - Simplify API (reduce boilerplate in calling code)

3. **Database connection management:**
   - Current: Singleton pattern with Bun's native SQL
   - Consider: Connection pooling strategy
   - Add connection health checks
   - Improve error handling for connection failures

4. **Migration system:**
   - Current: 41+ migration files
   - Evaluate: Should migrations be TypeScript instead of SQL?
   - Add migration rollback support
   - Create migration testing utilities

5. **Database roles:**
   - Current: `quailcomp_owner` (schema) vs `quailcomp_app` (queries)
   - Document why this separation exists
   - Ensure role permissions are correctly enforced

**Database Schema Reconsideration:**
- Should we keep the `entities` and `events` tables as generic JSONB storage?
- Alternative: Typed tables per domain (e.g., `books`, `people`, `series`)
- Trade-off: Flexibility vs. type safety and performance

**New Test Suite:**
- `data/client/tests/connection.test.ts` - Connection lifecycle
- `data/client/tests/entities-client.test.ts` - Entity CRUD operations
- `data/client/tests/events-client.test.ts` - Event recording
- `data/client/tests/migrations.test.ts` - Migration execution
- `data/client/tests/transactions.test.ts` - Transaction handling
- `data/client/tests/concurrency.test.ts` - Concurrent access patterns

**Documentation:**
- `docs/explanation/event-sourcing.md` - REWRITE for beginners
- `docs/explanation/database-architecture.md` - NEW, explain schema choices
- `docs/explanation/database-roles.md` - REWRITE with concrete examples
- `docs/how-to/run-migrations.md` - UPDATE with new patterns
- `docs/how-to/write-migration.md` - NEW, migration best practices
- `data/client/README.md` - REWRITE with API examples

**DevTools Panels to Add:** 🔧
- **Database connection complete** → Add `ConnectionPoolPanel.vue` (connection health, query performance)
- **Entities/Events clients complete** → Add `EntityBrowser.vue` (browse entities, view history) and `EventStreamPanel.vue` (real-time event stream)
- **Migrations complete** → Add migrations status to configuration panel

**Key Question to Answer:** Is event sourcing the right pattern for this use case, or is it over-engineering?

---

### **Phase 5: Business Services** (Layer 4)
**Dependencies:** Data layer, core utilities
**Estimated Complexity:** Medium-High

**Subsystems:**
1. **Authentication Service** - User identity (passwords, passkeys, OAuth, API keys)
2. **Authorization Service** - Permission levels (owner, write, read)
3. **Analytics Service** - Event tracking with 90-day retention
4. **Book Metadata Service** - External provider aggregation

**Critical Files:**
- `server/src/services/auth/` - Authentication logic
- `server/src/services/authz/` - Authorization checks
- `server/src/services/analytics/` - Event recording
- `services/book-metadata/src/` - Metadata providers (Google, OpenLibrary, LoC, Hardcover, WorldCat)

**Refactoring Goals:**

**Authentication Service:**
1. Evaluate authentication strategies:
   - Keep JWT tokens? Consider session-based auth?
   - Passkey support - is this needed or over-engineering?
   - OAuth providers - which ones are essential?
   - API keys for programmatic access

2. Rewrite authentication logic:
   - Simplify token generation/verification
   - Consider replacing `jose` library with custom JWT implementation
   - Add refresh token support
   - Improve password hashing (current approach: Argon2? bcrypt?)

**Authorization Service:**
1. Evaluate permission model:
   - Current: owner/write/read levels
   - Is this granular enough? Too granular?
   - Consider role-based vs. attribute-based access control

2. Rewrite authorization checks:
   - Create declarative permission helpers
   - Add permission caching for performance
   - Simplify API for route handlers

**Analytics Service:**
1. Event tracking strategy:
   - Current: 90-day retention in events table
   - Evaluate: Is this the right retention policy?
   - Consider: Aggregation and reporting patterns

2. Rewrite analytics recording:
   - Standardize event schemas
   - Add event validation
   - Create analytics query helpers

**Book Metadata Service:**
1. Provider evaluation:
   - Current: 5 providers (Google, OpenLibrary, LoC, Hardcover, WorldCat)
   - Which are actually useful? Can we reduce dependencies?
   - Evaluate rate limits and reliability

2. Rewrite metadata aggregation:
   - Simplify provider interface
   - Improve fallback logic
   - Add caching layer
   - Consider replacing circuit breaker/rate limiter with custom implementation

3. Minimize dependencies:
   - Evaluate if all external API libraries are needed
   - Write custom HTTP clients where simple

**New Test Suite:**
- `server/tests/services/auth.test.ts` - Authentication flows
- `server/tests/services/authz.test.ts` - Authorization checks
- `server/tests/services/analytics.test.ts` - Event recording
- `services/book-metadata/tests/providers/*.test.ts` - Individual provider tests
- `services/book-metadata/tests/aggregation.test.ts` - Metadata merging
- `services/book-metadata/tests/circuit-breaker.test.ts` - Fault tolerance

**Documentation:**
- `docs/explanation/authentication.md` - NEW, auth strategy explained
- `docs/explanation/authorization.md` - NEW, permission model explained
- `docs/how-to/add-auth-provider.md` - NEW, OAuth setup
- `docs/how-to/manage-api-keys.md` - NEW, API key usage
- `services/book-metadata/README.md` - REWRITE with provider details

**DevTools Panels to Add:** 🔧
- **Auth service complete** → Add `AuthPanel.vue` (active sessions, token inspection, manual login)
- **Authorization complete** → Add `PermissionsPanel.vue` (permission matrix, test access checks)
- **Analytics complete** → Add `AnalyticsPanel.vue` (event stream, retention stats)
- **Book metadata complete** → Add `MetadataProvidersPanel.vue` (provider health, cache status, manual lookups)

**Key Question to Answer:** Are we building the right services, or are some unnecessary for the use case?

---

### **Phase 6: API Layer** (Layer 5)
**Dependencies:** Business services, data layer
**Estimated Complexity:** Very High

**Subsystems:**
1. **Router** - Request matching
2. **Middleware** - Cross-cutting concerns
3. **Route Handlers** - API endpoints
4. **WebSocket Server** - Real-time updates

**Critical Files:**
- `server/src/server.ts` - HTTP server, middleware composition
- `server/src/router.ts` - Request routing
- `server/src/context.ts` - Request context creation
- `server/src/middleware/*.ts` - Middleware functions
- `server/src/routes/*.ts` - Route handlers (books, people, series, entities, auth)
- `server/src/websocket.ts` - WebSocket handling

**Refactoring Goals:**

**1. Router Rewrite:**
- Evaluate current router implementation
- Consider: Do we need a routing library, or write custom?
- Add route validation (parameter types, query strings)
- Improve route matching performance

**2. Middleware Composition:**
- Current: Manual middleware chaining
- Rewrite with clear composition pattern (inspired by Koa or Express)
- Create middleware types and helpers
- Add middleware testing utilities

**3. Route Handler Consolidation (HIGHEST IMPACT):**
- **Problem:** 1,300+ lines of route code with massive duplication
  - `routes/books.ts` - 727 lines
  - `routes/series.ts` - 324 lines
  - `routes/people.ts` - 292 lines

- **Solution:** Create generic CRUD route factory
  ```typescript
  createCRUDRoutes(router, '/books', 'book', bookValidator)
  createCRUDRoutes(router, '/people', 'person', personValidator)
  createCRUDRoutes(router, '/series', 'series', seriesValidator)
  ```

- **Pattern to extract:**
  - List: GET /resource → auth → get accessible entities → return
  - Get: GET /resource/:id → auth → get entity → check access → return
  - Create: POST /resource → auth → validate → create → grant access → return
  - Update: PATCH /resource/:id → auth → get existing → validate → update → return
  - Delete: DELETE /resource/:id → auth → get existing → soft delete → return
  - History: GET /resource/:id/history → auth → get history → return

- **Eliminate inconsistencies:**
  - Standardize error handling (no inline Response.json, use helpers)
  - Consistent ID parsing (use middleware or helper)
  - Unified validation pattern (fluent validator everywhere)
  - Authorization filtering (extract to helper function)

**4. WebSocket Refactor:**
- Current: WebSocket upgrade in server.ts, broadcasting in routes
- Improve message typing (discriminated unions)
- Add connection management
- Create subscription patterns for specific entities

**5. Minimize HTTP dependencies:**
- Bun's native HTTP server is good - keep it
- Evaluate if we need Sentry error tracking (consider custom solution)

**New Test Suite:**
- `server/tests/router.test.ts` - Route matching
- `server/tests/middleware/*.test.ts` - Individual middleware tests
- `server/tests/middleware-composition.test.ts` - Middleware ordering
- `server/tests/crud-factory.test.ts` - Generic CRUD routes
- `server/tests/routes/*.test.ts` - Endpoint integration tests (rewritten)
- `server/tests/websocket.test.ts` - WebSocket communication
- `server/tests/error-handling.test.ts` - Error middleware behavior

**Documentation:**
- `docs/explanation/api-architecture.md` - NEW, how the API is structured
- `docs/explanation/middleware-system.md` - NEW, middleware pattern explained
- `docs/reference/api-endpoints.md` - REWRITE with all endpoints documented
- `docs/reference/websocket-api.md` - NEW, WebSocket protocol
- `docs/how-to/add-api-endpoint.md` - NEW, step-by-step guide
- `docs/how-to/write-middleware.md` - NEW, middleware development
- `server/README.md` - REWRITE with current architecture

**DevTools Panels to Add:** 🔧
- **Router complete** → Add `RoutesPanel.vue` (route registry, test route matching)
- **Middleware complete** → Add `MiddlewarePanel.vue` (middleware stack visualization, per-request timing)
- **API routes complete** → Add `APIExplorerPanel.vue` (test endpoints, view request/response)
- **WebSocket complete** → Add `WebSocketPanel.vue` (active connections, message inspector, send test messages)

**Key Question to Answer:** Should we use a framework (even lightweight like Hono), or stick with custom HTTP handling?

---

### **Phase 7: Applications** (Layer 6)
**Dependencies:** API layer, all lower layers
**Estimated Complexity:** Very High

**Subsystems:**
1. **Frontend** (Vue 3 SPA)
2. **CLI** (Bun executable)
3. **DevTools** (Development infrastructure)

---

#### **7A: Frontend Refactor**

**Critical Files:**
- `frontend/src/main.ts` - Entry point
- `frontend/src/api/*.ts` - HTTP client
- `frontend/src/stores/*.ts` - Pinia stores
- `frontend/src/router/*.ts` - Vue Router
- `frontend/src/components/**/*.vue` - Vue components
- `frontend/src/views/**/*.vue` - Page components

**Refactoring Goals:**

**1. Evaluate Frontend Stack:**
- Vue 3 + Pinia + Vue Router - is this the right stack?
- Consider: Do we need a framework, or would vanilla TS suffice?
- If keeping Vue: Are we using Composition API effectively?

**2. API Client Rewrite:**
- Current: HTTP client with auth token injection
- Simplify error handling
- Add request/response interceptors
- Type-safe API calls with generated types from backend

**3. State Management:**
- Current: Pinia stores for auth and books
- Evaluate: Is Pinia needed, or would Vue Composition API suffice?
- Consider: Should state be normalized (relational structure)?
- Add optimistic updates for better UX

**4. Component Architecture:**
- Largest component: `BookMetadataResult.vue` (232 lines)
- Break down large components into smaller, reusable pieces
- Create component library with clear boundaries
- Standardize component patterns (props, events, slots)

**5. Routing:**
- Current: Vue Router setup
- Ensure routes match backend API structure
- Add route guards for authentication
- Improve loading states and error handling

**New Test Suite:**
- `frontend/tests/api/*.test.ts` - API client tests
- `frontend/tests/stores/*.test.ts` - Store tests
- `frontend/tests/components/**/*.test.ts` - Component tests
- `frontend/tests/views/**/*.test.ts` - Page tests
- `frontend/tests/e2e/*.test.ts` - End-to-end flows

**Documentation:**
- `frontend/README.md` - REWRITE with architecture overview
- `docs/explanation/frontend-architecture.md` - NEW, SPA structure
- `docs/how-to/add-frontend-feature.md` - NEW, feature development guide
- `docs/how-to/test-frontend.md` - NEW, component testing guide

---

#### **7B: CLI Refactor**

**Critical Files:**
- `cli/src/index.ts` - Entry point and command router
- `cli/src/commands/*.ts` - Command implementations
- `cli/src/output/*.ts` - Output formatters

**Refactoring Goals:**

**1. Command Architecture:**
- Current: Command router with subcommands
- Evaluate: Do we need a CLI framework, or custom?
- Standardize command patterns (args, flags, output)

**2. Direct Database Access:**
- CLI bypasses API and uses EntitiesClient directly
- Ensure CLI respects same business logic as API
- Consider: Should CLI use API instead?

**3. Output Formatting:**
- Current: Table and JSON formatters
- Add more formats (CSV, plain text)
- Improve table rendering
- Add color/styling options

**New Test Suite:**
- `cli/tests/commands/*.test.ts` - Command execution tests
- `cli/tests/formatters.test.ts` - Output formatting tests
- `cli/tests/integration.test.ts` - End-to-end CLI flows

**Documentation:**
- `cli/README.md` - REWRITE with command reference
- `docs/how-to/use-cli.md` - NEW, CLI usage guide
- `docs/how-to/add-cli-command.md` - NEW, extending the CLI

---

#### **7C: DevTools Refactor**

**Critical Files:**
- `devtools/watch/index.ts` - File watcher orchestrator
- `devtools/watch/rules.ts` - Watch patterns
- `devtools/watch/runner.ts` - Task executor
- `devtools/watch/tasks/*.ts` - Individual tasks
- `devtools/ui/` - Vue 3 dashboard

**Refactoring Goals:**

**1. File Watcher:**
- Current: Glob pattern matching with debouncing
- Evaluate: Performance and accuracy
- Consider: Use Bun's native file watching API
- Improve task dependency management

**2. Task Runner:**
- Current: Manual task execution
- Create task dependency graph
- Add parallel task execution
- Improve error recovery

**3. DevTools UI:**
- Current: Vue 3 dashboard with SSE for updates
- Simplify UI components
- Add more monitoring features
- Improve real-time update performance

**New Test Suite:**
- `devtools/tests/watcher.test.ts` - File watching tests
- `devtools/tests/runner.test.ts` - Task execution tests
- `devtools/tests/tasks/*.test.ts` - Individual task tests
- `devtools/tests/misc.test.ts` - Infrastructure tests (expand significantly)

**Documentation:**
- `devtools/README.md` - REWRITE with architecture overview
- `docs/explanation/devtools-system.md` - NEW, how devtools work
- `docs/how-to/add-devtools-task.md` - NEW, creating tasks
- `devtools/ui/README.md` - UPDATE with new features

---

### **Phase 8: Documentation Overhaul**
**Goal:** Rewrite all documentation from a beginner's perspective

**Tasks:**
1. **Create new documentation structure:**
   - `docs/getting-started.md` - NEW, comprehensive onboarding
   - `docs/architecture-overview.md` - NEW, high-level visual guide
   - `docs/glossary.md` - NEW, common terms and concepts
   - `docs/contributing.md` - UPDATE with new patterns

2. **Rewrite existing docs:**
   - Every `how-to/*.md` file reviewed and rewritten
   - Every `explanation/*.md` file reviewed and rewritten
   - Every `reference/*.md` file updated with new APIs
   - All directory READMEs rewritten

3. **Add visual documentation:**
   - Architecture diagrams (system overview, data flow)
   - Domain relationship diagrams
   - Sequence diagrams for key flows (auth, CRUD, WebSocket)
   - Database schema diagram

4. **Create beginner-friendly tutorials:**
   - "Your First 30 Minutes" walkthrough
   - "Add Your First Feature" tutorial
   - "Debug a Failing Test" guide
   - "Deploy to Production" guide

5. **Documentation testing:**
   - Ensure all code examples work
   - Add "copy-paste and run" sections
   - Validate all links
   - Check for consistency in terminology

**Key Principles:**
- Assume no prior knowledge of event sourcing, DDD, or monorepos
- Explain "why" not just "what"
- Provide concrete examples from the actual codebase
- Include troubleshooting sections
- Link related concepts clearly

---

## Cross-Cutting Concerns

### **Type Safety Initiative**
- **Goal:** Eliminate all `any` types, `@ts-ignore`, and `@ts-nocheck`
- **Current:** 245+ violations across source files
- **Strategy:** Fix bottom-up during each phase
- **Target:** 100% type safety by Phase 8

### **Dependency Minimization**
**Current External Dependencies:**
- Root: `minimatch`, `xlsx`
- Server: `@quailcomp/*`, `@sentry/bun`, `jose`, `pino`, `pino-pretty`, `zod`
- Frontend: Vue 3, Pinia, Vue Router, Vite, Vitest
- CLI: Likely minimal
- DevTools: `concurrently` + Vue stack

**Candidates for Replacement:**
1. `jose` (JWT) - Write custom JWT implementation
2. `pino` (logging) - Write custom logger
3. `zod` (validation) - Write custom validator
4. `minimatch` (globbing) - Use Bun's native APIs
5. `concurrently` (process management) - Write custom script
6. Pinia (state management) - Use Vue Composition API
7. Circuit breaker/rate limiter - Write custom implementations

**Keep (for now):**
- Vue 3 (mature framework, good ecosystem)
- Vite/Vitest (excellent DX)
- PostgreSQL driver (Bun's native SQL is fine)

### **Testing Philosophy**
**Old Test Suite:** 214 test files, ~10,000+ lines of test code

**New Test Suite:** Build from scratch with these principles (documented in Phase 0):

**Core Principles:**
1. **One test file per module** - Not one giant file per feature
2. **Test factories for common patterns** - Reusable builders for users, entities, events
3. **Property-based testing** - Use fast-check for data validation and edge cases
4. **Test types by purpose:**
   - Unit tests for business logic (pure functions, isolated modules)
   - Integration tests for critical paths (multiple components working together)
   - Component tests for UI (Vue components with happy-dom/jsdom)
   - E2E tests for critical user flows (full application scenarios)
5. **Tests as documentation** - Test code should explain behavior clearly
6. **Fail fast, fail clear** - Tests should pinpoint exact failures
7. **Independence** - Tests should not depend on execution order
8. **Realistic data** - Use factories to create believable test data

**Test Organization:**
```
tests/
  unit/           - Pure functions, no dependencies
  integration/    - Multiple components working together
  e2e/            - Full user flows
  factories/      - Test data builders (UserFactory, EntityFactory, EventFactory)
  helpers/        - Test utilities (database setup, HTTP mocks, assertions)
  fixtures/       - Static test data (JSON files, SQL seeds)
  templates/      - Test file templates for each layer
```

**Testing Strategy (Defined in Phase 0):**
- Each layer gets a testing strategy document as it's refactored
- Test templates ensure consistency
- Factory patterns established before data layer refactor
- Documentation written alongside tests

---

## Execution Strategy

### **Daily Workflow:**
1. Pick one subsystem or file from current layer
2. Read existing implementation thoroughly
3. Rewrite in your style with maximum decoupling
4. **Write tests immediately** (using templates from Phase 0)
5. **Document as you go:**
   - Update refactoring journal with decisions made
   - Add to decision log for architectural choices
   - Update or create directory READMEs
   - Use quick-capture for temporary notes
6. Validate tests pass and types check
7. Commit with descriptive message

**Testing During Refactor:**
- Use test templates from `tests/templates/` for consistency
- Follow testing strategy from `docs/testing-strategy.md`
- Use factories from `tests/factories/` for test data
- Each module rewrite = new test suite written

**Documentation During Refactor:**
- **Decision Log** (`docs/decision-log.md`) - Record every architectural choice with context
- **Refactoring Journal** (`docs/refactor-journal.md`) - Daily notes on what you learned
- **Quick Capture** (`docs/.quick-capture.md`) - Scratch pad for mid-refactor thoughts
- **READMEs** - Update directory READMEs as you change code structure
- When you discover a pattern worth documenting, add it to the appropriate doc immediately

### **Commit Strategy:**
- Commit after each logical unit (one file rewritten, one test suite added)
- Use descriptive commit messages: `refactor(data): rewrite EntitiesClient with improved type safety`
- Don't commit broken code (each commit should pass tests)

### **Validation Checkpoints:**
After each phase:
1. All tests pass
2. TypeScript compiles with no errors
3. Documentation updated
4. No regressions in functionality
5. Dependencies minimized where possible

### **Risk Management:**
- Keep original code in git history
- Test extensively after each phase
- Don't move to next phase until current is solid
- Have rollback plan if major issues discovered

---

## Success Metrics

**Technical:**
- [ ] Zero `any` types in source code
- [ ] 100% type safety with strict TypeScript
- [ ] Test coverage > 80% across all modules
- [ ] Dependency count reduced by at least 30%
- [ ] Code duplication reduced by at least 50% (especially in routes)
- [ ] Build time < 5 seconds
- [ ] Test suite runs in < 30 seconds

**Educational:**
- [ ] Refactoring journal with lessons learned
- [ ] At least 5 architectural decisions documented
- [ ] Patterns identified and extracted
- [ ] Understanding of coupling/cohesion deepened

**Maintainability:**
- [ ] Every directory has current README
- [ ] All code written in consistent style
- [ ] Documentation serves beginners effectively
- [ ] Subsystems are maximally decoupled

**Visibility:**
- [ ] DevTools UI has panel for every major subsystem
- [ ] Can inspect logs, metrics, entities, events, auth, API calls in real-time
- [ ] Manual testing of features possible through devtools UI

**Functional:**
- [ ] All original features still work
- [ ] No performance regressions
- [ ] Deployment process unchanged (or improved)

---

## Open Questions to Resolve During Refactoring

1. **Event Sourcing:** Is append-only storage with JSONB the right pattern, or should we use typed tables?
2. **Workspace Structure:** Is the current monorepo organization optimal?
3. **Authentication:** JWT vs. session-based? Keep passkey support?
4. **Frontend Framework:** Keep Vue 3, or consider vanilla TypeScript?
5. **State Management:** Keep Pinia, or use Composition API?
6. **CLI Architecture:** Direct database access vs. API calls?
7. **Testing Strategy:** Property-based vs. example-based tests?
8. **Documentation Format:** Keep markdown, or consider other formats?

---

## Estimated Timeline

**Note:** This is a learning project, so timeline is flexible.

- **Phase 0 (Preparation + Infrastructure):** 3-5 days
  - 1 day: Baseline and branch setup
  - 1-2 days: Testing strategy and infrastructure
  - 1 day: Documentation hub setup
  - 1 day: DevTools UI foundation
- Phase 1 (Configuration): 2-3 days
- Phase 2 (Domains): 1-2 weeks
- Phase 3 (Utilities): 3-5 days
- Phase 4 (Data Layer): 2-3 weeks
- Phase 5 (Services): 2-3 weeks
- Phase 6 (API Layer): 3-4 weeks
- Phase 7 (Applications): 4-6 weeks
  - 7A (Frontend): 2-3 weeks
  - 7B (CLI): 3-5 days
  - 7C (DevTools): 1-2 weeks
- Phase 8 (Documentation): 1-2 weeks

**Total Estimated Duration:** 3-5 months of focused work

**Phase 0 is Critical:** Spending extra time upfront on testing and documentation infrastructure will save significant time in later phases. You'll have templates, patterns, and processes ready to use immediately.

---

## Next Steps

1. Review and approve this plan
2. Create refactoring branch: `refactor/project-wide-2026`
3. **Complete Phase 0 infrastructure setup:**
   - Create testing strategy and templates
   - Set up documentation hub
   - Set up devtools UI foundation
   - Establish baseline
4. Begin Phase 1 (configuration refactor)

---

## Phase 0 Infrastructure Quick Reference

Once Phase 0 is complete, you'll have this infrastructure ready:

### Testing Infrastructure
```
tests/
├── README.md                           # Test organization guide
├── templates/
│   ├── unit-test.template.ts          # Template for unit tests
│   ├── integration-test.template.ts   # Template for integration tests
│   └── component-test.template.ts     # Template for Vue component tests
├── factories/
│   └── README.md                       # Factory pattern examples
├── helpers/
│   └── README.md                       # Test utility documentation
└── .test-conventions.md                # Testing conventions

docs/testing-strategy.md                # Comprehensive testing approach
```

### Documentation Hub
```
docs/
├── refactor-baseline.md                # Current state snapshot
├── refactor-journal.md                 # Daily learning log
├── decision-log.md                     # Architectural decisions
├── .quick-capture.md                   # Scratch pad for quick notes
├── .doc-validation.ts                  # Documentation validation script
└── .doc-templates/
    ├── how-to.template.md              # Template for how-to guides
    ├── explanation.template.md         # Template for explanation docs
    ├── reference.template.md           # Template for reference docs
    └── directory-readme.template.md    # Template for directory READMEs
```

### DevTools UI Foundation
```
devtools-refactor/
├── README.md                           # Architecture and usage guide
├── server.ts                           # DevTools API server
├── ui/                                 # Vue 3 application
│   ├── src/
│   │   ├── main.ts                     # Entry point
│   │   ├── App.vue                     # Shell with navigation
│   │   ├── router.ts                   # Panel routing
│   │   ├── api/                        # DevTools API client
│   │   ├── components/                 # Shared UI components
│   │   └── panels/                     # Panel components
│   │       └── .templates/             # Panel templates
│   │           ├── LogsPanel.template.vue
│   │           ├── MetricsPanel.template.vue
│   │           ├── EntityBrowser.template.vue
│   │           └── ConfigViewer.template.vue
│   ├── package.json
│   └── vite.config.ts
└── plugins/
    ├── README.md                       # How to add panels
    └── .panel-template/                # Template for new panels
```

**DevTools Development Workflow:**
```bash
# Start devtools UI in dev mode (from Phase 0 onwards)
cd devtools-refactor/ui && bun run dev

# Access at http://localhost:5174 (or configured port)
# Hot-reload enabled for instant feedback
```

### How to Use During Refactoring

**When you start a new module:**
1. Copy appropriate test template from `tests/templates/`
2. Use factories from `tests/factories/` for test data
3. Follow patterns in `docs/testing-strategy.md`

**When you make an architectural decision:**
1. Add entry to `docs/decision-log.md` with context and rationale
2. Note any alternatives you considered

**When you learn something:**
1. Add to `docs/refactor-journal.md` immediately
2. Use `docs/.quick-capture.md` for temporary notes
3. Consolidate quick captures into proper docs later

**When you change directory structure:**
1. Update or create directory README using `docs/.doc-templates/directory-readme.template.md`

**When you complete a subsystem:**
1. Add a devtools panel for visibility
2. Copy appropriate panel template from `devtools-refactor/ui/src/panels/.templates/`
3. Add API endpoint to `devtools-refactor/server.ts` for data access
4. Register panel in `devtools-refactor/ui/src/router.ts`
5. Test the panel while developing the next subsystem

**Example - After completing logging system:**
```bash
# 1. Copy template
cp devtools-refactor/ui/src/panels/.templates/LogsPanel.template.vue \
   devtools-refactor/ui/src/panels/LogsPanel.vue

# 2. Add API endpoint in devtools-refactor/server.ts
# GET /api/logs - returns recent logs

# 3. Register in router
# { path: '/logs', component: LogsPanel }

# 4. Access panel at http://localhost:5174/logs
# 5. See real-time logs as you develop next features
```

This infrastructure ensures you capture learnings, maintain consistency, and have immediate visibility into each subsystem as you build it.

---

This is an ambitious, educational refactoring project that will result in a deeply understood, maximally decoupled, and well-documented codebase. The key is steady progress, frequent commits, and continuous learning.
