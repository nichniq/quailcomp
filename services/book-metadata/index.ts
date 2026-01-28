/**
 * @quailcomp/book-metadata
 *
 * A service for fetching book metadata from multiple providers
 * with automatic fallback.
 *
 * @example
 * import { createBookMetadataService } from '@quailcomp/book-metadata';
 *
 * const service = createBookMetadataService({
 *   googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY,
 *   timeout: 5000,
 * });
 *
 * const book = await service.lookup('978-0134685991');
 * if (book) {
 *   console.log(book.title);  // "Effective Java"
 *   console.log(book.authors); // ["Joshua Bloch"]
 * }
 */

// =============================================================================
// Types
// =============================================================================

export type {
  BookMetadata,
  BookMetadataProvider,
  BookMetadataService,
  GoogleBooksConfig,
  OpenLibraryConfig,
  LibraryOfCongressConfig,
  CompositeConfig,
  BaseProviderConfig,
} from "./types";

// =============================================================================
// Errors
// =============================================================================

export {
  BookMetadataServiceError,
  ServiceUnavailableError,
  TimeoutError,
  InvalidISBNError,
} from "./types";

// =============================================================================
// Provider Factories
// =============================================================================

export { createGoogleBooksProvider } from "./google-books";
export { createOpenLibraryProvider } from "./open-library";
export { createLibraryOfCongressProvider } from "./library-of-congress";
export { createCompositeProvider, createBookMetadataService } from "./composite";

// =============================================================================
// Testing Utilities
// =============================================================================

export {
  createMockProvider,
  createFailingMockProvider,
  createEmptyMockProvider,
} from "./mock";

// =============================================================================
// Utilities
// =============================================================================

export { normalizeISBN, isbn10ToIsbn13, isbn13ToIsbn10 } from "./utils";
