import type { Command, CLIContext } from "@cli/types";
import {
  createBookMetadataService,
  createGoogleBooksProvider,
  createOpenLibraryProvider,
  createLibraryOfCongressProvider,
  createHardcoverProvider,
  createWorldCatClassifyProvider,
} from "@quailcomp/book-metadata";
import { error, info, formatJSON } from "@cli/utils/output";

/**
 * Lookup book metadata by ISBN
 */
async function lookupMetadata(context: CLIContext): Promise<void> {
  const { args } = context;

  if (args.length === 0) {
    error("ISBN is required");
    info("Usage: quailcomp metadata lookup <isbn> [--provider <provider>]");
    info("\nProviders:");
    info("  all (default)     Try all providers (composite)");
    info("  google            Google Books");
    info("  openlibrary       Open Library");
    info("  loc               Library of Congress");
    info("  hardcover         Hardcover");
    info("  worldcat          WorldCat Classify");
    process.exit(1);
  }

  // Parse arguments
  let isbn = args[0];
  let providerName = "all";

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--provider" && i + 1 < args.length) {
      providerName = args[i + 1];
      i++;
    }
  }

  // Validate ISBN format (10 or 13 digits, allowing hyphens)
  const normalizedISBN = isbn.replace(/[-\s]/g, "");
  if (!/^(?:\d{10}|\d{13})$/.test(normalizedISBN)) {
    error("Invalid ISBN format");
    info("Expected ISBN-10 (10 digits) or ISBN-13 (13 digits)");
    info("Hyphens and spaces are allowed (e.g., 978-0-13-468599-1)");
    process.exit(1);
  }

  // Create provider
  let provider;
  switch (providerName) {
    case "all":
      provider = createBookMetadataService();
      break;
    case "google":
      provider = createGoogleBooksProvider({});
      break;
    case "openlibrary":
      provider = createOpenLibraryProvider({});
      break;
    case "loc":
      provider = createLibraryOfCongressProvider({});
      break;
    case "hardcover": {
      const apiKey = process.env.HARDCOVER_API_KEY;
      if (!apiKey) {
        error("HARDCOVER_API_KEY environment variable is required for Hardcover provider");
        process.exit(1);
      }
      provider = createHardcoverProvider({ apiKey });
      break;
    }
    case "worldcat":
      provider = createWorldCatClassifyProvider({});
      break;
    default:
      error(`Unknown provider: ${providerName}`);
      process.exit(1);
  }

  try {
    info(`Looking up metadata for ${isbn} using ${providerName}...\n`);

    const result = await provider.lookup(isbn);

    if (!result) {
      info("No metadata found.");
      return;
    }

    info("Metadata found:\n");
    info(formatJSON(result, true));
  } catch (err) {
    error(`Failed to lookup metadata: ${err}`);
    process.exit(1);
  }
}

/**
 * Metadata command definition
 */
export const metadataCommand: Command = {
  name: "metadata",
  description: "Lookup book metadata from external sources",
  usage: "metadata lookup <isbn> [--provider <provider>]",
  handler: async (context: CLIContext) => {
    error("Please specify a subcommand");
    info("Usage: quailcomp metadata <subcommand>");
    info("\nSubcommands:");
    info("  lookup           Lookup book metadata by ISBN");
    process.exit(1);
  },
  subcommands: new Map([
    [
      "lookup",
      {
        name: "lookup",
        description: "Lookup book metadata by ISBN",
        usage: "metadata lookup <isbn> [--provider <provider>]",
        handler: lookupMetadata,
      },
    ],
  ]),
};
