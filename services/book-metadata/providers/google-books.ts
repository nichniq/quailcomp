/**
 * Google Books API Provider
 *
 * Fetches book metadata from the Google Books API.
 * https://developers.google.com/books/docs/v1/reference/volumes
 */

import type { BookMetadataService, BookMetadata, GoogleBooksConfig } from "@/types";
import { ServiceUnavailableError, TimeoutError } from "@/types";
import { normalizeISBN, createAbortController } from "@/utils";

// =============================================================================
// Google Books API Response Types (internal)
// =============================================================================

interface GoogleBooksVolumeInfo {
  title: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: Array<{
    type: "ISBN_10" | "ISBN_13" | string;
    identifier: string;
  }>;
  pageCount?: number;
  language?: string;
  categories?: string[];
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
}

interface GoogleBooksResponse {
  totalItems: number;
  items?: Array<{
    volumeInfo: GoogleBooksVolumeInfo;
  }>;
}

// =============================================================================
// Provider Implementation
// =============================================================================

const BASE_URL = "https://www.googleapis.com/books/v1/volumes";
const DEFAULT_TIMEOUT = 10000;

/**
 * Create a Google Books metadata provider.
 *
 * @param config - Optional configuration
 * @returns BookMetadataService implementation
 *
 * @example
 * const googleBooks = createGoogleBooksProvider({ apiKey: 'your-key' });
 * const book = await googleBooks.lookup('9780134685991');
 */
export function createGoogleBooksProvider(
  config: GoogleBooksConfig = {}
): BookMetadataService {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return {
    provider: "google-books",

    async lookup(isbn: string): Promise<BookMetadata | null> {
      const normalizedISBN = normalizeISBN(isbn);

      const url = new URL(BASE_URL);
      url.searchParams.set("q", `isbn:${normalizedISBN}`);
      if (config.apiKey) {
        url.searchParams.set("key", config.apiKey);
      }

      const { signal, clear } = createAbortController(timeout);

      try {
        const response = await fetch(url.toString(), { signal });
        clear();

        if (!response.ok) {
          throw new ServiceUnavailableError(
            "google-books",
            new Error(`HTTP ${response.status}`)
          );
        }

        const data = (await response.json()) as GoogleBooksResponse;

        if (!data.items || data.items.length === 0) {
          return null;
        }

        const volumeInfo = data.items[0].volumeInfo;
        return mapGoogleBooksToMetadata(normalizedISBN, volumeInfo);
      } catch (error) {
        clear();

        if (error instanceof Error && error.name === "AbortError") {
          throw new TimeoutError("google-books", timeout);
        }
        if (
          error instanceof ServiceUnavailableError ||
          error instanceof TimeoutError
        ) {
          throw error;
        }
        throw new ServiceUnavailableError("google-books", error as Error);
      }
    },
  };
}

// =============================================================================
// Response Mapping
// =============================================================================

function mapGoogleBooksToMetadata(
  isbn: string,
  info: GoogleBooksVolumeInfo
): BookMetadata {
  const identifiers = info.industryIdentifiers ?? [];
  const isbn10 = identifiers.find((i) => i.type === "ISBN_10")?.identifier;
  const isbn13 = identifiers.find((i) => i.type === "ISBN_13")?.identifier;

  return {
    isbn,
    isbn10,
    isbn13,
    title: info.title,
    subtitle: info.subtitle,
    authors: info.authors ?? [],
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    description: info.description,
    pageCount: info.pageCount,
    language: info.language,
    subjects: info.categories,
    thumbnailUrl: info.imageLinks?.thumbnail,
    source: "google-books",
  };
}
