# Book Metadata Services

> Integrates with external book metadata providers to fetch and normalize book information by ISBN.

This domain provides a unified interface for fetching book metadata from multiple external
providers including Google Books, Open Library, Library of Congress, Hardcover, and WorldCat.
Each provider returns normalized `BookMetadata` that can be used to populate book records in
the application.

**Key Principle**: Services are domain-agnostic. They return provider-neutral metadata that
the application layer maps to domain types. This separation allows adding new providers without
changing domain logic.

## Metadata Providers

> Five external metadata providers are supported, each with different capabilities and requirements.

```typescript
export type BookMetadataProvider =
  | "google-books"
  | "open-library"
  | "library-of-congress"
  | "hardcover"
  | "worldcat-classify";
```

**Provider Characteristics**:

| Provider | API Key Required | Rate Limits | Coverage |
|----------|------------------|-------------|----------|
| google-books | Optional | Yes | Excellent |
| open-library | No | Yes | Good |
| library-of-congress | No | Yes | Excellent (US) |
| hardcover | Yes | Yes | Good |
| worldcat-classify | No | Yes | Excellent |

**Provider Selection Strategy**:

Services can be used individually or combined via the composite service pattern, which tries
providers in order until one succeeds. This provides resilience against provider failures and
rate limiting.

## Book Metadata

> Normalized metadata structure returned by all providers.

```typescript
export interface BookMetadata {
  /** The ISBN used for lookup (normalized, hyphens removed) */
  isbn: string;
  /** ISBN-10 identifier if available */
  isbn10?: string;
  /** ISBN-13 identifier if available */
  isbn13?: string;
  /** Library of Congress Control Number */
  lccn?: string;
  /** Book title */
  title: string;
  /** Book subtitle */
  subtitle?: string;
  /** List of author names */
  authors: string[];
  /** Publisher name */
  publisher?: string;
  /** Publication date (ISO format or year string) */
  publishedDate?: string;
  /** Book description/summary */
  description?: string;
  /** Number of pages */
  pageCount?: number;
  /** Language code (e.g., "en", "es") */
  language?: string;
  /** Subject/category tags */
  subjects?: string[];
  /** Thumbnail image URL */
  thumbnailUrl?: string;
  /** Provider that returned this result */
  source: BookMetadataProvider;
}
```

**Normalization**:

Each provider returns data in a different format. Service implementations normalize:

- **ISBN**: Always stored without hyphens (e.g., "9780262033848")
- **Authors**: Always an array (even for single author)
- **Dates**: ISO format preferred, but year strings accepted
- **Optional Fields**: Missing data is undefined (not null or empty string)

**Domain Separation**:

`BookMetadata` is intentionally separate from the `PhysicalBook` domain type. The application
backend decides which fields to map and how to handle conflicts when data exists in multiple
providers.

## Service Interface

> All providers implement a common interface for consistency.

```typescript
export interface BookMetadataService {
  /** Look up book metadata by ISBN */
  lookup(isbn: string): Promise<BookMetadata | null>;
  /** The provider name for this service instance */
  readonly provider: BookMetadataProvider;
}
```

**Contract**:

- **lookup()**: Returns `BookMetadata` if found, `null` if not found in provider
- **Throws**: `BookMetadataServiceError` if service is unavailable (network, rate limits, etc.)
- **ISBN Format**: Accepts both ISBN-10 and ISBN-13, with or without hyphens

Each provider service implementation (GoogleBooksService, OpenLibraryService, etc.) implements this interface.

## Error Handling

> Service errors are typed to enable appropriate retry and fallback strategies.

```typescript
export class BookMetadataServiceError extends Error {
  constructor(
    message: string,
    public readonly provider: BookMetadataProvider | "composite",
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "BookMetadataServiceError";
  }
}
```

**Error Types**:

The domain defines three specific error subclasses: `ServiceUnavailableError`, `TimeoutError`, and `InvalidISBNError`. These extend `BookMetadataServiceError` and are defined in the source code.

**Error Handling Strategy**:

- **ServiceUnavailableError**: Retry with exponential backoff or try next provider
- **TimeoutError**: Retry with longer timeout or try next provider
- **InvalidISBNError**: Don't retry, ISBN format is invalid (user error)

Check error types with `instanceof` to determine the appropriate retry strategy.

## Circuit Breaker Pattern

> Prevents cascading failures by failing fast when a provider is consistently down.

```typescript
export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";
```

**Circuit States**:

- **CLOSED**: Normal operation, requests pass through to provider
- **OPEN**: Provider is failing, requests fail immediately without calling provider
- **HALF_OPEN**: Testing recovery, allows limited requests through

```typescript
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold?: number;
  /** Time in milliseconds before trying again after opening */
  recoveryTimeout?: number;
  /** Number of consecutive successes in HALF_OPEN before closing */
  successThreshold?: number;
}
```

**State Transitions**:

```
CLOSED --[failures >= threshold]--> OPEN
OPEN --[timeout elapsed]--> HALF_OPEN
HALF_OPEN --[success >= threshold]--> CLOSED
HALF_OPEN --[any failure]--> OPEN
```

The `CircuitBreaker` class wraps provider calls and automatically tracks failures. When the failure threshold is reached, it throws `CircuitOpenError` instead of attempting the request.

**Benefits**:

- **Fail Fast**: Don't waste time on known-failing providers
- **Auto-Recovery**: Automatically tests if provider has recovered
- **Resource Protection**: Prevents overwhelming failing services

## Rate Limiting

> Token bucket algorithm limits request rate to respect provider quotas.

```typescript
export interface RateLimitConfig {
  /** Maximum number of tokens (burst capacity) */
  maxRequests: number;
  /** Tokens per second */
  perSeconds: number;
}
```

**How It Works**:

1. Bucket starts with `maxRequests` tokens
2. Each request consumes one token
3. Tokens refill at rate of `perSeconds` per second
4. Requests wait if no tokens available

For example, `{ maxRequests: 10, perSeconds: 1 }` allows a burst of 10 requests but maintains a steady-state rate of 1 request per second.

**Benefits**:

- **Burst Handling**: Allow short bursts without blocking
- **Steady State**: Maintain average rate over time
- **Provider Compliance**: Respect provider rate limits automatically

## Provider Configuration

> Each provider can be configured with timeouts, rate limits, and circuit breakers.

**Base Configuration** (all providers):

```typescript
export interface BaseProviderConfig {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Rate limiting configuration (optional) */
  rateLimit?: RateLimitConfig;
  /** Circuit breaker configuration (optional) */
  circuitBreaker?: CircuitBreakerConfig;
}
```

**Provider-Specific Configuration**:

```typescript
export interface GoogleBooksConfig extends BaseProviderConfig {
  /** Optional API key for higher rate limits */
  apiKey?: string;
}

export interface HardcoverConfig extends BaseProviderConfig {
  /** API key from hardcover.app/account/api (required) */
  apiKey: string;
}

export type OpenLibraryConfig = BaseProviderConfig;
export type LibraryOfCongressConfig = BaseProviderConfig;
export type WorldCatClassifyConfig = BaseProviderConfig;
```

Configuration objects can include timeout, rate limiting, and circuit breaker settings tailored to each provider's characteristics.

## Composite Service

> Tries multiple providers in order until one succeeds, providing resilience.

```typescript
export interface CompositeConfig {
  /** Providers to try in order */
  providers: BookMetadataService[];
}
```

**Strategy**:

1. Try first provider
2. If it returns `null` (not found), try next provider
3. If it throws error, try next provider
4. Return first successful result
5. If all fail, throw composite error

The composite service tries providers in order until one returns metadata or all providers are exhausted.

**Benefits**:

- **Resilience**: Single provider failure doesn't prevent metadata lookup
- **Coverage**: Different providers have different book databases
- **Performance**: Fast provider first, slower as fallback

## Integration Points

- [Configuration Domain](./configuration.md) - API keys and timeouts from environment variables
- [Errors Domain](./errors.md) - Service errors extend standard error patterns
- [Books Domain](./books.md) - BookMetadata maps to PhysicalBook domain type

## Invariants

> Rules that must always hold true for book metadata services.

1. **Normalization**: All providers return the same `BookMetadata` structure
2. **ISBN Format**: ISBNs are always normalized (no hyphens) in returned metadata
3. **Null vs Error**: Return `null` for "not found", throw error for "service unavailable"
4. **No Mutation**: Service implementations are thread-safe and don't mutate config
5. **Idempotency**: Multiple lookups of the same ISBN return consistent results (unless provider data changes)

## Use Cases

**Populate New Book Entry**:

When a user enters an ISBN, fetch metadata to pre-fill form fields with title, authors, publisher, and other details.

**Enrich Existing Data**:

For books with minimal data, look up metadata to add missing descriptions, subjects, or thumbnail images.

**Bulk Import**:

Import multiple books by ISBN with rate limiting and circuit breaking to respect provider quotas and handle failures gracefully.

## Implementation Notes

**Service Discovery**:

The codebase uses a factory pattern to instantiate services based on configuration. Each
provider has its own service class that implements the `BookMetadataService` interface.

**Caching Strategy**:

Metadata services don't implement caching internally. The application layer should implement
caching if needed, typically:

- Cache successful lookups for 24-48 hours
- Don't cache "not found" responses (provider might add data later)
- Invalidate cache when user manually updates metadata

**Testing**:

Mock implementations are useful for testing without making real API calls. A mock service
can return predefined metadata or simulate failures for testing error handling.

**Provider Reliability**:

Different providers have different uptime and performance characteristics:

- **Google Books**: Generally fast and reliable
- **Open Library**: Good coverage but occasionally slow
- **Library of Congress**: Excellent for US publications
- **Hardcover**: Newer, growing database
- **WorldCat**: Excellent academic and library coverage
