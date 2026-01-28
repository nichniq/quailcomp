/**
 * Book Metadata Service Types
 *
 * Defines the common interface and types for fetching book metadata
 * from multiple providers.
 */

// =============================================================================
// Core Types
// =============================================================================

/** Supported metadata providers */
export type BookMetadataProvider =
  | "google-books"
  | "open-library"
  | "library-of-congress";

/**
 * Normalized book metadata returned by all providers.
 *
 * This type is intentionally separate from the domain's PhysicalBook type.
 * Services are domain-agnostic; the backend will map this to domain types.
 */
export interface BookMetadata {
  /** The ISBN used for lookup (normalized) */
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

  /** Language code (e.g., "en") */
  language?: string;

  /** Subject/category tags */
  subjects?: string[];

  /** Thumbnail image URL */
  thumbnailUrl?: string;

  /** Provider that returned this result */
  source: BookMetadataProvider;
}

/**
 * Book metadata service interface.
 *
 * All provider implementations must conform to this interface.
 */
export interface BookMetadataService {
  /**
   * Look up book metadata by ISBN.
   *
   * @param isbn - ISBN-10 or ISBN-13 (hyphens are stripped automatically)
   * @returns BookMetadata if found, null if not found
   * @throws BookMetadataServiceError if the service is unavailable
   */
  lookup(isbn: string): Promise<BookMetadata | null>;

  /** The provider name for this service instance */
  readonly provider: BookMetadataProvider;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error for all book metadata service errors
 */
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

/**
 * Service is temporarily unavailable (network issues, rate limiting, etc.)
 */
export class ServiceUnavailableError extends BookMetadataServiceError {
  constructor(provider: BookMetadataProvider | "composite", cause?: Error) {
    super(`Book metadata service unavailable: ${provider}`, provider, cause);
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Request timed out
 */
export class TimeoutError extends BookMetadataServiceError {
  constructor(
    provider: BookMetadataProvider | "composite",
    public readonly timeoutMs: number
  ) {
    super(`Request timed out after ${timeoutMs}ms: ${provider}`, provider);
    this.name = "TimeoutError";
  }
}

/**
 * Invalid ISBN format provided
 */
export class InvalidISBNError extends BookMetadataServiceError {
  constructor(public readonly isbn: string) {
    super(`Invalid ISBN format: ${isbn}`, "composite");
    this.name = "InvalidISBNError";
  }
}

// =============================================================================
// Configuration Types
// =============================================================================

/** Base configuration shared by all providers */
export interface BaseProviderConfig {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/** Google Books specific configuration */
export interface GoogleBooksConfig extends BaseProviderConfig {
  /** Optional API key for higher rate limits */
  apiKey?: string;
}

/** OpenLibrary configuration (no API key needed) */
export type OpenLibraryConfig = BaseProviderConfig;

/** Library of Congress configuration */
export type LibraryOfCongressConfig = BaseProviderConfig;

/** Composite service configuration */
export interface CompositeConfig {
  /** Providers to try in order */
  providers: BookMetadataService[];
}
