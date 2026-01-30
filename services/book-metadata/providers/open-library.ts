/**
 * OpenLibrary API Provider
 *
 * Fetches book metadata from the OpenLibrary API.
 * https://openlibrary.org/dev/docs/api/books
 */

import type { BookMetadataService, BookMetadata, OpenLibraryConfig } from "@/types";
import { ServiceUnavailableError, TimeoutError } from "@/types";
import { normalizeISBN, createAbortController } from "@/utils";

// =============================================================================
// OpenLibrary API Response Types (internal)
// =============================================================================

interface OpenLibraryEdition {
  title: string;
  subtitle?: string;
  authors?: Array<{ key: string }>;
  publishers?: string[];
  publish_date?: string;
  description?: string | { value: string };
  number_of_pages?: number;
  languages?: Array<{ key: string }>;
  subjects?: string[];
  covers?: number[];
  isbn_10?: string[];
  isbn_13?: string[];
  lccn?: string[];
}

interface OpenLibraryAuthor {
  name: string;
}

// =============================================================================
// Provider Implementation
// =============================================================================

const DEFAULT_TIMEOUT = 10000;

/**
 * Create an OpenLibrary metadata provider.
 *
 * @param config - Optional configuration
 * @returns BookMetadataService implementation
 *
 * @example
 * const openLibrary = createOpenLibraryProvider();
 * const book = await openLibrary.lookup('9780134685991');
 */
export function createOpenLibraryProvider(
  config: OpenLibraryConfig = {}
): BookMetadataService {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return {
    provider: "open-library",

    async lookup(isbn: string): Promise<BookMetadata | null> {
      const normalizedISBN = normalizeISBN(isbn);
      const url = `https://openlibrary.org/isbn/${normalizedISBN}.json`;

      const { signal, clear } = createAbortController(timeout);

      try {
        const response = await fetch(url, { signal });
        clear();

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new ServiceUnavailableError(
            "open-library",
            new Error(`HTTP ${response.status}`)
          );
        }

        const data: OpenLibraryEdition = await response.json();

        // Fetch author names if we have author references
        const authorNames = await fetchAuthorNames(data.authors ?? [], timeout);

        return mapOpenLibraryToMetadata(normalizedISBN, data, authorNames);
      } catch (error) {
        clear();

        if (error instanceof Error && error.name === "AbortError") {
          throw new TimeoutError("open-library", timeout);
        }
        if (
          error instanceof ServiceUnavailableError ||
          error instanceof TimeoutError
        ) {
          throw error;
        }
        throw new ServiceUnavailableError("open-library", error as Error);
      }
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch author names from OpenLibrary author endpoints.
 * Authors in edition responses are references like "/authors/OL123A".
 */
async function fetchAuthorNames(
  authorRefs: Array<{ key: string }>,
  timeout: number
): Promise<string[]> {
  if (authorRefs.length === 0) {
    return [];
  }

  // Limit to first 5 authors to avoid too many requests
  const refs = authorRefs.slice(0, 5);
  const names: string[] = [];

  for (const ref of refs) {
    try {
      const { signal, clear } = createAbortController(timeout);
      const response = await fetch(`https://openlibrary.org${ref.key}.json`, {
        signal,
      });
      clear();

      if (response.ok) {
        const author: OpenLibraryAuthor = await response.json();
        if (author.name) {
          names.push(author.name);
        }
      }
    } catch {
      // Skip failed author lookups - partial data is better than none
    }
  }

  return names;
}

// =============================================================================
// Response Mapping
// =============================================================================

function mapOpenLibraryToMetadata(
  isbn: string,
  data: OpenLibraryEdition,
  authorNames: string[]
): BookMetadata {
  // Handle description being either string or object with value
  const description =
    typeof data.description === "string"
      ? data.description
      : data.description?.value;

  // Extract language code from key (e.g., "/languages/eng" -> "eng")
  const language = data.languages?.[0]?.key?.split("/").pop();

  // Build cover URL from cover ID
  const thumbnailUrl = data.covers?.[0]
    ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`
    : undefined;

  return {
    isbn,
    isbn10: data.isbn_10?.[0],
    isbn13: data.isbn_13?.[0],
    lccn: data.lccn?.[0],
    title: data.title,
    subtitle: data.subtitle,
    authors: authorNames,
    publisher: data.publishers?.[0],
    publishedDate: data.publish_date,
    description,
    pageCount: data.number_of_pages,
    language,
    subjects: data.subjects,
    thumbnailUrl,
    source: "open-library",
  };
}
