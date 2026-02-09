# Test Specifications

**Generated:** 2026-02-09
**Total Test Files:** 45

This document contains specifications extracted from all test files in the project.

---

## cli/tests

### books

**Source:** `cli/tests/books.test.ts`



#### books commands

- books command has correct structure
- books command has all expected subcommands
- show command retrieves book by ID
- add command creates new book
- update command modifies existing book
- history command shows all versions
- delete command soft deletes book

#### list command

- displays books in table format
- shows empty state when no books exist
- excludes deleted books
- handles database errors gracefully

#### error paths

- main command without subcommand shows error
- show requires book ID
- show rejects invalid ID format
- show handles non-existent book
- add requires title
- add rejects unknown options
- update requires book ID
- update rejects invalid ID format
- update handles non-existent book
- update rejects unknown options
- delete requires book ID
- delete rejects invalid ID format
- delete handles non-existent book
- delete rejects already deleted book
- history requires book ID
- history rejects invalid ID format
- history handles non-existent book


---

### metadata

**Source:** `cli/tests/metadata.test.ts`



#### metadata commands

- metadata command has correct structure
- metadata command has lookup subcommand
- lookup validates ISBN format
- lookup validates LCCN format
- lookup subcommand usage includes provider option

#### metadata handler execution

- main command without subcommand shows error and exits

#### lookup handler execution

- requires ISBN argument
- validates ISBN format - rejects invalid format
- validates ISBN format - accepts ISBN-10
- validates ISBN format - accepts ISBN-13
- validates ISBN format - accepts ISBN with hyphens
- rejects unknown provider
- requires HARDCOVER_API_KEY for hardcover provider
- handles null result from provider
- handles provider errors

#### provider selection

- defaults to
- accepts --provider google
- accepts --provider openlibrary
- accepts --provider loc
- accepts --provider worldcat
- accepts --provider hardcover with API key

#### output formatting

- displays metadata as formatted JSON
- handles metadata with null optional fields

#### edge cases

- handles ISBN with spaces
- rejects ISBN with letters
- rejects too short ISBN
- rejects too long ISBN
- handles provider timeout gracefully


---

### output

**Source:** `cli/tests/output.test.ts`



#### formatTable

- formats table with headers and rows
- handles empty rows
- pads columns correctly
- handles null and undefined values

#### formatJSON

- formats JSON with pretty printing by default
- formats JSON compactly when pretty is false
- handles nested objects
- handles arrays


---

### router

**Source:** `cli/tests/router.test.ts`



#### CLIRouter

- registers and retrieves commands
- executes registered command
- executes subcommand when available
- passes remaining args to subcommand
- shows help when no command provided
- shows help when help command provided
- shows command-specific help


---

## data/client/tests

### config

**Source:** `data/client/tests/config.test.ts`



#### Database Configuration


#### getDbConfig

- should return default configuration
- should use DB_HOST from environment
- should use DB_PORT from environment
- should use DB_NAME from environment
- should use DB_USER from environment
- should use DB_PASSWORD from environment
- should enable SSL when DB_SSL is true
- should disable SSL when DB_SSL is false
- should disable SSL when DB_SSL is not set
- should use DB_MAX_CONNECTIONS from environment
- should parse all environment variables together

#### getTestDbConfig

- should return test database configuration
- should use DB_TEST_NAME from environment
- should inherit other config from getDbConfig


---

### connection

**Source:** `data/client/tests/connection.test.ts`



#### Database Connection


#### createConnection

- should create connection with basic config
- should create connection with password
- should create connection with special characters in password
- should create connection with SSL enabled
- should create connection with custom port
- should create connection with custom max connections

#### getConnection

- should return a connection
- should return the same connection on multiple calls

#### closeConnection

- should close the default connection
- should handle closing when no connection exists


---

### entities

**Source:** `data/client/tests/entities.test.ts`



#### Setup & Connection

- should connect to the test database
- should have the entities table with correct columns
- should have the validation trigger installed

#### Create Operations

- should create a new entity with auto-generated entity_id
- should auto-increment entity_id for new entities
- should create entities with different types
- should create multiple entities in a transaction
- should handle empty createMany gracefully

#### Update Operations

- should update an entity by adding a new entry
- should not consume sequence on update
- should preserve all versions (append-only)

#### Soft Delete Operations

- should soft-delete an entity
- should exclude deleted entities from default queries
- should restore a soft-deleted entity

#### Read Operations

- should get entity by ID (latest version)
- should return null for non-existent entity
- should get entities by type
- should check if entity exists
- should count entities by type

#### Search Operations

- should search by JSONB containment
- should search with nested JSONB

#### Edge Cases & Error Handling

- should reject invalid entity_id on update
- should handle empty data object
- should handle large data payload
- should handle special characters in data
- should handle null values in data

#### Trigger Validation

- should prevent creating new entity with explicit entity_id
- should allow update with existing entity_id

#### Index Effectiveness

- should have indexes defined for common queries
- should generate a valid query plan

#### Pagination

- should limit results
- should offset results
- should combine limit and offset
- should handle large offset
- should handle limit of 0

#### Query Options for getHistory

- should apply limit to getHistory
- should apply offset to getHistory
- should exclude deleted from getHistory when requested

#### Query Options for findByData

- should apply limit/offset to findByData

#### Count with includeDeleted

- should count deleted entities when requested

#### Error Handling for getById

- should handle database errors in getById gracefully

#### Factory Function

- should create EntitiesClient using factory

#### Transactions

- should rollback createMany on failure
- should commit createMany on success
- should handle empty createMany array


---

### errors

**Source:** `data/client/tests/errors.test.ts`



#### DatabaseError classes

- DatabaseError has correct properties
- EntityNotFoundError has correct properties
- EntityNotFoundError without type
- EventNotFoundError has correct properties
- EventNotFoundError without type
- UniqueViolationError has correct properties
- ForeignKeyViolationError has correct properties
- NotNullViolationError has correct properties
- CheckViolationError has correct properties

#### parseDatabaseError

- returns DatabaseError as-is
- parses unique violation (23505)
- parses unique violation with constraint fallback
- parses unique violation with unknown constraint
- parses foreign key violation (23503)
- parses not null violation (23502)
- parses not null violation with column fallback
- parses check violation (23514)
- parses ECONNREFUSED as connection error
- parses ENOTFOUND as connection error
- parses unknown error as generic query error
- handles error without message
- preserves Error cause when available


---

### events

**Source:** `data/client/tests/events.test.ts`



#### Setup & Connection

- should connect to the test database
- should have the events table with correct columns
- should have the validation trigger installed

#### Record Operations

- should record a new event with auto-generated event_id
- should auto-increment event_id for new events
- should record multiple events in a transaction

#### Enrich Operations

- should enrich an existing event by adding a new entry
- should preserve original entry when enriching
- should not consume sequence value when enriching

#### Void Operations

- should void an event
- should exclude voided events from default queries
- should restore a voided event

#### Read Operations

- should get the latest entry for an event
- should get full history for an event
- should get events by type
- should check if event exists
- should count events by type

#### Search Operations

- should find events by JSONB data
- should find events for a specific entity

#### Time Ordering

- should preserve occurred_at across enrichments
- should query events by occurred_at time range

#### Edge Cases & Error Handling

- should reject enrichment with non-existent event_id
- should handle empty data object
- should handle large data payload
- should handle special characters in data

#### Trigger Validation

- should reject new events with arbitrary event_id
- should allow enrichment with existing event_id

#### Advanced Time Range Queries

- should respect time range boundaries
- should return events from different types in time range
- should include voided events when requested
- should handle empty time ranges

#### Query Options

- should apply limit to getHistory
- should apply offset to getHistory
- should exclude voided from getHistory when requested
- should apply limit/offset to getByType
- should apply limit/offset to getByTimeRange
- should apply limit/offset to findByData
- should apply limit/offset to findForEntity
- should count voided events when requested

#### Factory Function

- should create EventsClient using factory

#### Concurrent Operations

- should handle parallel record operations
- should handle parallel enrichment operations
- should handle parallel recordMany operations


---

### properties

**Source:** `data/client/tests/properties.test.ts`



#### Property-Based Tests: EntitiesClient

- entity updates preserve history order
- JSONB queries find all matching entities
- soft delete preserves entity data
- entity_id uniqueness across types

#### Property-Based Tests: EventsClient

- event history is append-only and ordered
- event queries by type return correct results
- voiding events preserves data but marks as voided


---

### types

**Source:** `data/client/tests/types.test.ts`



#### Typed Repository Pattern

- should create a typed repository
- should create entities with correct types
- should update entities with type safety
- should query with type inference
- should search with type-safe queries

#### Versioned Types

- should upgrade UserDataV1 to current version
- should upgrade UserDataV2 to current version
- should handle single-word names in upgrade
- should handle multi-word last names in upgrade

#### Generic Type Parameters

- should work with custom entity types
- should maintain type safety across operations
- should support getById operation
- should support delete operation

#### Versioned Types - Additional Cases

- should return v3 data unchanged


---

## devtools/tests

### misc

**Source:** `devtools/tests/misc.test.ts`



#### README Maintenance Hook

- warns when new directory created without README
- warns when files added to directory without updating README
- does not warn when README is updated along with files

#### Git Hooks

- pre-commit hook exists and is executable
- pre-commit hook matches template

#### Code Coverage Infrastructure

- coverage scripts exist
- bunfig.toml has coverage config

#### Deployment Infrastructure

- systemd service file exists and has correct structure
- logrotate configuration exists and is valid
- installation script exists and is executable
- deployment README exists and covers key topics

#### Graceful Shutdown

- test script exists and is executable
- server index.ts has signal handlers

#### Static File Serving

- test script exists and is executable
- server.ts has static file serving in production

#### ESLint Custom Rules

- no-unsafe-sql rule exists and is configured
- no-unsafe-sql rule has comprehensive tests
- no-unsafe-sql rule detects SQL injection vulnerabilities
- no-unsafe-sql rule allows proper Bun tagged templates

#### Test Spec Generator

- generator script exists and exports generateSpecs function
- generates combined spec file at project root
- cache prevents unnecessary file writes
- combined spec includes test structure details


---

## domains/scripts

### extract-types

**Source:** `domains/scripts/extract-types.test.ts`



#### extract-types script

- basic extraction: single type in one file
- multiple code blocks: combines into single namespace
- file generation: multiple domains create separate files
- export preservation: maintains all export types
- idempotency: running twice produces identical output
- edge case: file with no code blocks
- edge case: README.md is excluded
- caching: second run uses cache for unchanged files
- caching: detects file changes and re-extracts
- error handling: exits with error code when no .md files found
- filtering: only exports are included, example code excluded
- filtering: multi-line exports are preserved completely
- filtering: mixed exports and non-exports
- filtering: multi-line union types are preserved
- filtering: const dependencies of exported functions are preserved
- filtering: code block with only non-exported code produces no output
- regression: configuration-style usage examples are filtered out


---

## frontend/src/tests/stores

### auth

**Source:** `frontend/src/tests/stores/auth.test.ts`



#### Auth Store


#### initial state

- starts with null user and token
- loads token from localStorage if present

#### register

- successfully registers user
- handles registration error
- sets loading state during registration

#### login

- successfully logs in user
- handles login error

#### fetchUser

- fetches user data when token exists
- does nothing when no token exists
- logs out when fetch fails

#### logout

- clears user data and token

#### isAuthenticated computed

- returns false when no user or token
- returns false when only token exists
- returns false when only user exists
- returns true when both user and token exist


---

### books

**Source:** `frontend/src/tests/stores/books.test.ts`



#### Books Store


#### initial state

- starts with empty books array

#### fetchBooks

- successfully fetches books
- handles fetch error
- sets loading state during fetch

#### fetchBook

- successfully fetches single book
- handles fetch error

#### createBook

- successfully creates book
- handles create error

#### updateBook

- successfully updates book in list
- updates currentBook if it matches
- handles update error

#### deleteBook

- successfully deletes book from list
- clears currentBook if it matches
- handles delete error

#### bookCount computed

- returns correct count


---

## server/tests

### analytics

**Source:** `server/tests/analytics.test.ts`



#### Analytics Service


#### Event Recording

- records HTTP request event
- records HTTP error event
- records metadata lookup event
- records user session started event
- records user milestone event
- analytics failure does not throw

#### Analytics Queries

- getDailyActiveUsers counts unique users
- getHttpErrorRate calculates error percentage
- getMetadataProviderStats aggregates provider performance
- getLatencyPercentiles calculates p50, p95, p99
- getUserEngagementMetrics aggregates user activity
- getFeatureAdoption counts feature usage

#### Retention Policy

- getRetentionStats returns analytics event counts
- cleanupOldAnalytics voids events older than 90 days
- cleanupOldAnalytics preserves domain events

#### Event Enrichment

- can enrich analytics events with additional context


---

### auth

**Source:** `server/tests/auth.test.ts`



#### JWT utilities

- sign token creates valid JWT
- verify valid token returns payload
- verify invalid token returns null
- verify malformed token returns null
- extract token from Bearer header
- extract token returns null for missing header
- extract token returns null for malformed header
- extract token handles whitespace-only Bearer token
- get token expiration returns future date

#### Password utilities

- hash password creates bcrypt hash
- verify correct password returns true
- verify incorrect password returns false
- validate password rejects less than 12 characters
- validate password rejects without complexity
- validate password accepts strong passwords

#### AuthService

- register creates new user with password credential
- register without username succeeds
- register with duplicate email fails
- register with duplicate username fails
- register with invalid email fails
- register with weak password fails
- login with correct email and password succeeds
- login with username succeeds
- login with incorrect password fails
- login with non-existent user fails
- getUserById returns user data
- getUserById returns null for non-existent user
- getUserByEmail returns user data
- getUserByEmail returns null for non-existent email

#### AuthorizationService

- grantOwnerOnCreate grants owner access
- checkAccess returns true for owner with owner permission
- checkAccess returns true for owner with write permission
- checkAccess returns true for owner with read permission
- checkAccess returns false for user without access
- grantAccess allows owner to grant read access
- getAccessLevel returns granted access level
- checkAccess returns true after granting access
- grantAccess fails for non-owner trying to grant to others
- revokeAccess removes access
- revokeAccess fails for non-owner
- cannot revoke own owner access
- listAccessibleEntities returns user
- listAccessibleEntities filters by access level
- listEntityAccessors returns all users with access
- listEntityAccessors fails without access
- transferOwnership changes owner and downgrades previous owner
- transferOwnership fails for non-owner


---

### bulk-operations

**Source:** `server/tests/bulk-operations.test.ts`



#### Import Parsers


#### parseCSV

- parses valid CSV with headers
- handles quoted values with commas
- handles escaped quotes
- skips empty lines
- handles various header name formats
- returns empty array for empty CSV
- returns empty array for CSV with only headers

#### parseJSON

- parses valid JSON array
- extracts only valid book fields
- throws error for non-array JSON
- throws error for invalid JSON
- throws error if array contains non-objects
- handles empty array

#### parseXLSX

- throws helpful error when xlsx is not installed

#### Export Formatters


#### exportCSV

- exports books as CSV with headers
- includes all book data
- escapes commas in values
- escapes quotes in values
- handles empty values
- handles empty array

#### exportJSON

- exports books as JSON array
- includes entity_id in output
- includes all book data
- formats JSON with indentation
- handles empty array

#### exportXLSX

- creates valid XLSX buffer
- throws helpful error when xlsx is not installed


---

### error-handler

**Source:** `server/tests/error-handler.test.ts`



#### HttpError classes

- BadRequestError has 400 status
- UnauthorizedError has 401 status
- ForbiddenError has 403 status
- NotFoundError has 404 status
- ConflictError has 409 status
- HttpError can include error code

#### errorHandler middleware

- passes through successful response
- catches BadRequestError and returns 400
- catches UnauthorizedError and returns 401
- catches NotFoundError and returns 404
- includes error code in response when provided
- catches unknown errors and returns 500
- handles non-Error throws

#### cors middleware

- handles preflight OPTIONS request
- adds CORS headers to normal requests
- allows specific origin
- rejects non-allowed origin
- allows multiple origins
- supports origin validation function
- sets credentials header when enabled
- sets exposed headers
- defaultCors allows configured origins

#### compose middleware

- composes middleware in left-to-right execution order
- middleware can short-circuit by not calling next
- middleware can modify context
- compose handles errors from middleware
- applyMiddleware is equivalent to compose
- empty compose returns handler unchanged


---

### error-helpers

**Source:** `server/tests/error-helpers.test.ts`



#### Error response helpers

- badRequest throws BadRequestError
- badRequest includes code and message
- unauthorized throws UnauthorizedError
- unauthorized uses default message
- forbidden throws ForbiddenError
- notFound throws NotFoundError
- conflict throws ConflictError
- validationError throws ValidationError with fields

#### getValidEntityId

- returns valid ID
- returns valid ID for large numbers
- throws on invalid ID
- throws on empty ID
- throws on NaN
- includes entity type in error message

#### parseJsonBody

- parses valid JSON
- throws on invalid JSON
- parses empty object

#### Validator

- validates required fields
- required passes for non-empty string
- required fails for null
- required fails for undefined
- validates string min length
- minLength passes when meets requirement
- validates string max length
- maxLength passes when meets requirement
- validates array not empty
- arrayNotEmpty passes for non-empty array
- validates positive numbers
- positive passes for positive numbers
- validates number range
- range passes for valid number
- validates email format
- email passes for valid email
- collects multiple errors
- custom validation
- custom validation passes when condition is false
- fluent API chains methods
- includes field values in error details
- custom error messages


---

### logging

**Source:** `server/tests/logging.test.ts`



#### createLogger

- creates logger with default info level
- logs debug messages when level is debug
- does not log debug when level is info
- logs info messages
- logs warn messages to console.warn
- logs error messages to console.error
- includes context in all log entries
- child logger inherits parent context
- child logger inherits parent log level
- outputs valid JSON
- handles special characters in message
- merges data with context

#### requestLogger middleware

- logs request start
- logs request completion with timing
- logs POST request method
- logs user agent when present
- omits user agent when not present
- logs different status codes
- logs request failure on error
- re-throws errors after logging
- omits query string when not present
- includes requestId from context
- handles non-Error throws


---

### metrics

**Source:** `server/tests/metrics.test.ts`



#### MetricsCollector

- inc() creates new counter
- inc() increments existing counter
- inc() can increment by custom value
- inc() handles labels
- inc() groups by same labels
- observe() records histogram observation
- observe() calculates average correctly
- observe() updates histogram buckets
- observe() handles same labels
- observe() separates different labels
- snapshot() includes timestamp
- snapshot() returns empty arrays when no metrics
- reset() clears all metrics
- labels are sorted for consistent keys

#### requestMetrics middleware

- increments request counter
- records request with method and path labels
- records response counter with status
- records request duration histogram
- normalizes numeric IDs in path
- normalizes UUID in path
- groups requests to same normalized path
- counts errors separately
- re-throws errors after recording
- tracks different status codes separately
- measures actual request duration


---

### middleware

**Source:** `server/tests/middleware.test.ts`



#### requireAuth middleware

- allows request with valid Bearer token
- returns 401 for missing Authorization header
- returns 401 for invalid token
- attaches user to context on success

#### optionalAuth middleware

- continues without authentication when no token provided
- attaches user when valid token provided
- continues without user when invalid token provided

#### requireAccess middleware

- requireAccess(
- requireAccess(
- requireAccess returns 403 for user without access
- requireAccess returns 401 if not authenticated
- requireWrite allows owner but not reader
- requireOwner only allows owner
- entity ID extractor can use context params


---

### observability

**Source:** `server/tests/observability.test.ts`



#### Observability

- GET /metrics returns Prometheus text format
- GET /metrics/json returns JSON format
- X-Request-Id header is echoed in response
- X-Request-Id is generated when not provided
- Prometheus metrics track HTTP requests


---

### openapi

**Source:** `server/tests/openapi.test.ts`



#### OpenAPI Specification

- generates valid OpenAPI 3.0 spec
- includes all main tags
- includes health endpoint
- includes metrics endpoint
- includes authentication endpoints
- includes book endpoints
- includes authorization endpoints
- includes bearer authentication security scheme
- includes all required schemas
- protected endpoints require authentication
- public endpoints don
- includes proper response codes


---

### people

**Source:** `server/tests/people.test.ts`



#### People Routes


#### GET /people

- returns empty array when no people exist
- returns only accessible people for user
- filters out deleted people
- requires authentication

#### GET /people/:id

- returns person by ID
- returns 404 for non-existent person
- returns 403 for inaccessible person
- requires read access

#### POST /people

- creates person with valid data
- auto-grants owner access to creator
- validates required fields - name
- validates required fields - relationships
- returns 400 for invalid JSON
- requires authentication

#### PUT /people/:id

- updates person with partial data
- preserves unmodified fields
- returns 404 for non-existent person
- requires write access

#### DELETE /people/:id

- soft deletes person
- preserves data in history
- requires owner access

#### GET /people/:id/books

- returns books given by person
- returns empty array when no books
- requires read access to person


---

### routes

**Source:** `server/tests/routes.test.ts`



#### healthHandler

- returns healthy status when database connected
- returns unhealthy status when database disconnected

#### metricsHandler

- returns metrics snapshot

#### Books routes


#### GET /books

- lists all books
- requires authentication

#### POST /books

- creates a new book
- returns 400 for invalid JSON
- requires authentication

#### GET /books/:id

- returns a book by ID
- returns 400 for invalid ID
- returns 404 for non-existent book
- requires authentication

#### PUT /books/:id

- updates an existing book
- returns 400 for invalid ID
- returns 404 for non-existent book
- returns 400 for invalid JSON
- requires authentication

#### DELETE /books/:id

- soft deletes a book
- returns 400 for invalid ID
- returns 404 for non-existent book
- requires authentication

#### POST /books/metadata/lookup

- validates ISBN format
- returns 400 for missing fields
- returns 400 for invalid JSON
- requires authentication


---

### security

**Source:** `server/tests/security.test.ts`



#### securityHeaders middleware

- adds security headers to response
- adds Content-Security-Policy header
- does not modify response body
- preserves existing response headers

#### validatePasswordStrength

- rejects password shorter than minimum length
- rejects password without lowercase letter
- rejects password without uppercase letter
- rejects password without number
- rejects password without special character
- rejects common passwords
- accepts strong password
- calculates entropy for passwords
- rates password strength correctly
- returns multiple errors for multiple violations

#### validatePassword

- returns null for valid password
- returns first error message for invalid password

#### httpsRedirect middleware

- does not redirect in development
- passes through HTTPS requests in development
- respects X-Forwarded-Proto header

#### Security integration

- security headers work with other middleware
- password validation integrates with password requirements


---

### series

**Source:** `server/tests/series.test.ts`



#### Series Routes


#### GET /series

- returns empty array when no series exist
- returns only accessible series for user
- filters out deleted series
- requires authentication

#### GET /series/:id

- returns series by ID
- returns 404 for non-existent series
- returns 403 for inaccessible series
- requires read access

#### POST /series

- creates series with valid data
- creates series without total_volumes
- auto-grants owner access to creator
- validates required fields - name
- validates total_volumes must be positive integer
- requires authentication

#### PUT /series/:id

- updates series with partial data
- preserves unmodified fields
- returns 404 for non-existent series
- requires write access

#### DELETE /series/:id

- soft deletes series
- preserves data in history
- requires owner access

#### GET /series/:id/books

- returns books in series ordered by volume number
- returns empty array when no books in series
- handles books without volume numbers
- requires read access to series


---

### websocket

**Source:** `server/tests/websocket.test.ts`



#### WebSocket


#### Connection and Authentication

- establishes WebSocket connection
- requires authentication
- authenticates with valid token
- rejects invalid token

#### Subscription Management

- subscribes to entity with access
- rejects subscription to entity without access
- unsubscribes from entity

#### Real-time Updates

- receives update when subscribed entity is modified
- receives create notification when subscribed entity is created
- receives delete notification when subscribed entity is deleted
- does not receive updates for unsubscribed entities

#### Ping/Pong

- responds to ping with pong


---

## server/tests/e2e

### auth-workflow

**Source:** `server/tests/e2e/auth-workflow.test.ts`



#### E2E Authentication Workflow

- complete registration flow
- registration with duplicate email fails
- registration with weak password fails
- registration with invalid email fails
- complete login flow with email
- complete login flow with username
- login with incorrect password fails
- login with non-existent user fails
- get current user with valid token
- get current user without token fails
- get current user with invalid token fails
- get current user with malformed Authorization header fails
- complete workflow: register -> login -> get user


---

### authz-workflow

**Source:** `server/tests/e2e/authz-workflow.test.ts`



#### E2E Authorization Workflow

- owner automatically granted on book creation
- user without access cannot read book
- user without write access cannot update book
- user without owner access cannot delete book
- owner can grant read access
- owner can grant write access
- non-owner cannot grant access
- owner can revoke access
- non-owner cannot revoke access
- owner can transfer ownership
- non-owner cannot transfer ownership
- list accessors shows all users with access
- user without access cannot list accessors
- user can only see their own books in list


---

### book-workflow

**Source:** `server/tests/e2e/book-workflow.test.ts`



#### E2E Book Workflow

- create book with minimal data
- create book with full data
- create book without authentication fails
- get book by ID
- get non-existent book returns 404
- update book
- update preserves unmodified fields
- delete book (soft delete)
- list books returns user
- list books without authentication fails
- complete CRUD workflow
- metadata lookup with ISBN
- metadata lookup without ISBN fails
- metadata lookup with invalid ISBN
- book history tracking via event sourcing


---

## server/tests/integration

### cross-domain

**Source:** `server/tests/integration/cross-domain.test.ts`



#### Cross-Domain Integration Tests


#### People + Books Integration

- create person and associate with book as gift-giver
- person can be associated with multiple books

#### Series + Books Integration

- create series and add multiple books with volume numbers
- series can handle books without volume numbers

#### Export with Related Entities

- export includes person and series references

#### Complex Multi-Domain Scenarios

- full workflow: person gives series books


---

## services/book-metadata/tests

### circuit-breaker

**Source:** `services/book-metadata/tests/circuit-breaker.test.ts`



#### CircuitBreaker


#### CLOSED State

- starts in CLOSED state
- allows requests to pass through
- tracks failures but stays closed below threshold
- opens circuit when failure threshold is reached
- resets failure count on success

#### OPEN State

- immediately fails requests with CircuitOpenError
- does not execute function when circuit is open
- transitions to HALF_OPEN after recovery timeout
- stays open before recovery timeout elapses

#### HALF_OPEN State

- allows test requests to pass through
- closes circuit after success threshold is reached
- reopens circuit immediately on failure
- tracks success count correctly

#### State Transitions

- CLOSED -> OPEN -> HALF_OPEN -> CLOSED
- CLOSED -> OPEN -> HALF_OPEN -> OPEN (on failure)

#### Configuration

- uses default values when not configured
- respects custom failure threshold
- respects custom recovery timeout
- respects custom success threshold

#### reset()

- resets to CLOSED state
- clears failure count
- clears success count

#### Error Propagation

- propagates original error from function
- throws CircuitOpenError when circuit is open


---

### composite

**Source:** `services/book-metadata/tests/composite.test.ts`



#### createCompositeProvider

- should throw if no providers given
- should return result from first successful provider
- should fallback to second provider when first fails
- should fallback to second provider when first returns null
- should return null when all providers return null
- should throw when all providers fail with errors
- should not throw when some providers fail but one succeeds
- should return null when some providers fail and rest return null
- should report first provider as its provider
- should stop trying providers after first success
- should try all providers when all return null
- should respect priority order
- should handle errors from middle providers
- should aggregate errors from all failed providers


---

### mock

**Source:** `services/book-metadata/tests/mock.test.ts`



#### createMockProvider

- should return predefined response for known ISBN
- should return null for unknown ISBN
- should normalize ISBN before lookup
- should throw for ISBNs in errorISBNs set
- should simulate latency
- should use custom provider name

#### createFailingMockProvider

- should always throw ServiceUnavailableError
- should use specified provider name

#### createEmptyMockProvider

- should always return null
- should use specified provider name


---

### providers-resilience

**Source:** `services/book-metadata/tests/providers-resilience.test.ts`



#### Rate-Limited Provider

- allows requests within rate limit
- delays requests when rate limit is exceeded
- preserves provider name
- propagates errors from underlying provider

#### Resilient Provider

- allows requests when circuit is closed
- opens circuit after failure threshold
- attempts recovery after timeout
- preserves provider name
- converts CircuitOpenError to ServiceUnavailableError

#### Combined Wrappers

- rate limiting and circuit breaker work together
- circuit breaker protects rate limiter from excessive waits
- circuit breaker inside rate limiter fails fast


---

### rate-limiter

**Source:** `services/book-metadata/tests/rate-limiter.test.ts`



#### RateLimiter


#### Token Acquisition

- allows immediate acquisition when tokens are available
- allows burst of requests up to maxTokens
- waits when tokens are exhausted
- handles concurrent acquisitions correctly

#### Token Refilling

- refills tokens over time
- does not exceed maxTokens when refilling
- calculates refill rate correctly

#### canAcquire()

- returns true when tokens are available
- returns false when tokens are exhausted
- does not consume tokens

#### reset()

- resets tokens to maxTokens
- resets refill timing

#### getTokenCount()

- returns current token count
- returns fractional tokens during refill
- updates with refill over time

#### Configuration

- handles high rate limits
- handles low rate limits
- handles fractional refill rates

#### Concurrent Token Requests

- maintains fair ordering for concurrent requests

#### Refill Timing Precision

- refills accurately after partial consumption
- accumulates refill across multiple periods


---

### utils

**Source:** `services/book-metadata/tests/utils.test.ts`



#### normalizeISBN

- should remove hyphens from ISBN-13
- should remove hyphens from ISBN-10
- should remove spaces
- should handle ISBN-10 ending with X
- should uppercase ISBN-10 ending with lowercase x
- should accept valid ISBN-13 without hyphens
- should throw InvalidISBNError for wrong length
- should throw InvalidISBNError for letters in ISBN-13
- should throw InvalidISBNError for letters in middle of ISBN-10
- should throw InvalidISBNError for empty string

#### isbn10ToIsbn13

- should convert ISBN-10 to ISBN-13
- should handle ISBN-10 with hyphens
- should handle ISBN-10 ending with X
- should throw for ISBN-13 input

#### isbn13ToIsbn10

- should convert ISBN-13 to ISBN-10
- should handle ISBN-13 with hyphens
- should return null for 979 prefix (cannot convert)
- should return null for ISBN-10 input
- should produce ISBN-10 ending with X when needed


---

## services/book-metadata/tests/providers

### google-books

**Source:** `services/book-metadata/tests/providers/google-books.test.ts`



#### Google Books Provider


#### Happy Path

- returns metadata for valid ISBN
- normalizes ISBN before lookup
- includes API key when provided
- works without API key

#### Response Mapping

- handles missing subtitle
- handles missing authors array
- handles missing imageLinks
- extracts ISBN-10 and ISBN-13 from identifiers
- handles missing industryIdentifiers
- handles all optional fields being null or undefined

#### Error Handling

- returns null when no items found
- returns null when items array is missing
- throws ServiceUnavailableError on HTTP 404
- throws ServiceUnavailableError on HTTP 500
- throws TimeoutError when request times out
- throws ServiceUnavailableError on network error
- throws ServiceUnavailableError on malformed JSON

#### Edge Cases

- handles response with empty items array
- respects custom timeout configuration
- uses default timeout when not specified
- provider property is set correctly


---

### hardcover

**Source:** `services/book-metadata/tests/providers/hardcover.test.ts`



#### Hardcover Provider


#### Happy Path

- returns metadata for valid ISBN with API key
- uses POST method with GraphQL query
- deduplicates authors from both sources
- converts release_year to string

#### Response Mapping

- handles missing contributions array
- handles missing authors array
- handles all optional fields missing

#### Error Handling

- returns null when no books found
- returns null when data.books is missing
- throws on GraphQL errors
- throws ServiceUnavailableError on HTTP 401
- throws ServiceUnavailableError on HTTP 500
- throws TimeoutError when request times out
- throws ServiceUnavailableError on network error

#### Edge Cases

- skips authors without names
- respects custom timeout configuration
- provider property is set correctly


---

### library-of-congress

**Source:** `services/book-metadata/tests/providers/library-of-congress.test.ts`



#### Library of Congress Provider


#### Happy Path

- returns metadata for valid ISBN
- returns first result when multiple results

#### Response Mapping

- handles missing contributor array
- handles missing optional fields
- extracts first element from array fields
- handles multiple contributors
- returns null when title is missing

#### Error Handling

- returns null when no results
- returns null when results array missing
- throws ServiceUnavailableError on HTTP 404
- throws ServiceUnavailableError on HTTP 500
- throws TimeoutError when request times out
- throws ServiceUnavailableError on network error
- throws ServiceUnavailableError on malformed JSON

#### Edge Cases

- respects custom timeout configuration
- provider property is set correctly
- normalizes ISBN before lookup


---

### open-library

**Source:** `services/book-metadata/tests/providers/open-library.test.ts`



#### OpenLibrary Provider


#### Happy Path

- returns metadata for valid ISBN
- fetches author names from separate endpoints
- limits author fetches to 5 maximum

#### Response Mapping

- handles description as string
- handles description as object with value
- extracts language code from key format
- builds cover URL from cover ID
- handles missing cover array
- handles empty cover array
- handles edition with no authors
- handles missing publishers array
- handles missing ISBN arrays

#### Error Handling

- returns null on 404
- throws on HTTP 500
- throws on timeout
- handles failed author lookups gracefully
- continues when some author fetches fail
- throws on network error
- throws on malformed JSON

#### Edge Cases

- handles author without name field
- respects custom timeout configuration
- provider property is set correctly


---

### worldcat-classify

**Source:** `services/book-metadata/tests/providers/worldcat-classify.test.ts`



#### WorldCat Classify Provider


#### Happy Path

- returns metadata for single work (response code 0)
- returns metadata for multiple works (response code 4)
- extracts authors from author elements
- combines work author attribute and author elements

#### Response Mapping

- handles missing author attribute
- handles single author element
- deduplicates author names
- uses

#### Error Handling

- returns null on not found (response code 102)
- throws on error response code
- returns null when work element missing
- throws ServiceUnavailableError on HTTP 500
- throws TimeoutError when request times out
- throws ServiceUnavailableError on network error
- throws ServiceUnavailableError on invalid XML

#### Edge Cases

- respects custom timeout configuration
- provider property is set correctly
- normalizes ISBN before lookup


---

