import type { Command, CLIContext } from "@cli/types";
import {
  createCompositeProvider,
  createGoogleBooksProvider,
  createOpenLibraryProvider,
  createLibraryOfCongressProvider,
  createHardcoverProvider,
  createWorldCatClassifyProvider,
} from "@quailcomp/book-metadata";
import { error, info, formatJSON } from "@cli/utils/output";

/**
 * Lookup book metadata by ISBN or LCCN
 */
async function lookupMetadata(context: CLIContext): Promise<void> {
  const { args } = context;

  if (args.length === 0) {
    error("ISBN or LCCN is required");
    info("Usage: quailcomp metadata lookup <isbn|lccn> [--provider <provider>]");
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
  let identifier = args[0];
  let providerName = "all";

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--provider" && i + 1 < args.length) {
      providerName = args[i + 1];
      i++;
    }
  }

  // Determine identifier type
  const isISBN = /^(?:\d{10}|\d{13})$/.test(identifier);
  const isLCCN = /^\d{8,10}$/.test(identifier) && identifier.length >= 8;

  if (!isISBN && !isLCCN) {
    error("Invalid identifier format");
    info("Expected ISBN-10 (10 digits), ISBN-13 (13 digits), or LCCN (8-10 digits)");
    process.exit(1);
  }

  // Create provider
  let provider;
  switch (providerName) {
    case "all":
      provider = createCompositeProvider();
      break;
    case "google":
      provider = createGoogleBooksProvider();
      break;
    case "openlibrary":
      provider = createOpenLibraryProvider();
      break;
    case "loc":
      provider = createLibraryOfCongressProvider();
      break;
    case "hardcover":
      provider = createHardcoverProvider();
      break;
    case "worldcat":
      provider = createWorldCatClassifyProvider();
      break;
    default:
      error(`Unknown provider: ${providerName}`);
      process.exit(1);
  }

  try {
    info(`Looking up metadata for ${identifier} using ${providerName}...\n`);

    let result;
    if (isISBN) {
      result = await provider.getByISBN(identifier);
    } else {
      result = await provider.getByLCCN(identifier);
    }

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
  usage: "metadata lookup <isbn|lccn> [--provider <provider>]",
  handler: async (context: CLIContext) => {
    error("Please specify a subcommand");
    info("Usage: quailcomp metadata <subcommand>");
    info("\nSubcommands:");
    info("  lookup           Lookup book metadata by ISBN or LCCN");
    process.exit(1);
  },
  subcommands: new Map([
    [
      "lookup",
      {
        name: "lookup",
        description: "Lookup book metadata by ISBN or LCCN",
        usage: "metadata lookup <isbn|lccn> [--provider <provider>]",
        handler: lookupMetadata,
      },
    ],
  ]),
};
