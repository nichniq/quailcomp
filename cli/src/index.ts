#!/usr/bin/env bun

import { createRouter } from "@cli/router";
import { createContext } from "@cli/context";
import { booksCommand } from "@cli/commands/books";
import { metadataCommand } from "@cli/commands/metadata";
import { error } from "@cli/utils/output";

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    // Get command line arguments (skip 'bun' and script name)
    const args = process.argv.slice(2);

    // Create CLI context with database connection
    const context = createContext(args);

    // Create and configure router
    const router = createRouter();
    router.register(booksCommand);
    router.register(metadataCommand);

    // Execute command
    await router.execute(context);
  } catch (err) {
    error(`Unexpected error: ${err}`);
    process.exit(1);
  }
}

// Run main function
main();
