/**
 * WorldCat Classify API Provider
 *
 * Fetches book metadata from the OCLC WorldCat Classify API.
 * http://classify.oclc.org/classify2/
 */

import type {
  BookMetadataService,
  BookMetadata,
  WorldCatClassifyConfig,
} from "./types";
import { ServiceUnavailableError, TimeoutError } from "./types";
import { normalizeISBN, createAbortController } from "./utils";
import { XMLParser } from "fast-xml-parser";

// =============================================================================
// WorldCat Classify XML Response Types (internal)
// =============================================================================

interface WorldCatResponse {
  classify?: {
    response?: {
      "@_code": string;
    };
    work?: {
      "@_title"?: string;
      "@_author"?: string;
      author?: WorldCatAuthor | WorldCatAuthor[];
    };
  };
}

interface WorldCatAuthor {
  "@_name"?: string;
}

// =============================================================================
// Provider Implementation
// =============================================================================

const BASE_URL = "http://classify.oclc.org/classify2/Classify";
const DEFAULT_TIMEOUT = 10000;

/**
 * Create a WorldCat Classify metadata provider.
 *
 * @param config - Optional configuration
 * @returns BookMetadataService implementation
 *
 * @example
 * const worldcat = createWorldCatClassifyProvider();
 * const book = await worldcat.lookup('9780134685991');
 */
export function createWorldCatClassifyProvider(
  config: WorldCatClassifyConfig = {}
): BookMetadataService {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return {
    provider: "worldcat-classify",

    async lookup(isbn: string): Promise<BookMetadata | null> {
      const normalizedISBN = normalizeISBN(isbn);

      const url = new URL(BASE_URL);
      url.searchParams.set("isbn", normalizedISBN);
      url.searchParams.set("summary", "true");

      const { signal, clear } = createAbortController(timeout);

      try {
        const response = await fetch(url.toString(), { signal });
        clear();

        if (!response.ok) {
          throw new ServiceUnavailableError(
            "worldcat-classify",
            new Error(`HTTP ${response.status}`)
          );
        }

        const xmlText = await response.text();

        // Parse XML response
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "@_",
        });
        const data: WorldCatResponse = parser.parse(xmlText);

        // Check response code
        const responseCode = data.classify?.response?.["@_code"];

        if (responseCode === "102") {
          // Not found
          return null;
        }

        if (responseCode !== "0" && responseCode !== "4") {
          // 0 = single work found
          // 4 = multiple works found (we use the first)
          // Other codes indicate errors
          throw new ServiceUnavailableError(
            "worldcat-classify",
            new Error(`WorldCat response code: ${responseCode}`)
          );
        }

        if (!data.classify?.work) {
          return null;
        }

        return mapWorldCatToMetadata(normalizedISBN, data.classify.work);
      } catch (error) {
        clear();

        if (error instanceof Error && error.name === "AbortError") {
          throw new TimeoutError("worldcat-classify", timeout);
        }
        if (
          error instanceof ServiceUnavailableError ||
          error instanceof TimeoutError
        ) {
          throw error;
        }
        throw new ServiceUnavailableError("worldcat-classify", error as Error);
      }
    },
  };
}

// =============================================================================
// Response Mapping
// =============================================================================

function mapWorldCatToMetadata(
  isbn: string,
  work: NonNullable<WorldCatResponse["classify"]>["work"]
): BookMetadata {
  if (!work) {
    throw new Error("No work data available");
  }

  // Extract authors
  const authors: string[] = [];

  // Try to get author from work attribute first
  if (work["@_author"]) {
    authors.push(work["@_author"]);
  }

  // If there are author elements, extract names
  if (work.author) {
    const authorElements = Array.isArray(work.author)
      ? work.author
      : [work.author];

    authorElements.forEach((author) => {
      if (author["@_name"] && !authors.includes(author["@_name"])) {
        authors.push(author["@_name"]);
      }
    });
  }

  return {
    isbn,
    title: work["@_title"] || "Unknown Title",
    authors,
    // WorldCat Classify provides very limited metadata
    // Most fields are not available from this API
    source: "worldcat-classify",
  };
}
