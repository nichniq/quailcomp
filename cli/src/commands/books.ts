import type { Command, CLIContext } from "@cli/types";
import type { BookEntitySnapshot } from "@domains/types/books";
import { error, info, success, formatTable, formatJSON } from "@cli/utils/output";

const BOOK_TYPE = "book";

/**
 * List all books
 */
async function listBooks(context: CLIContext): Promise<void> {
  const { entities } = context;

  try {
    const entries = await entities.getByType<BookEntitySnapshot>(BOOK_TYPE, {
      includeDeleted: false,
    });

    if (entries.length === 0) {
      info("No books found.");
      return;
    }

    const headers = ["ID", "Title", "Author", "ISBN-13"];
    const rows = entries.map((entry) => [
      String(entry.entityId),
      entry.data.title || "(untitled)",
      entry.data.author || "",
      entry.data.isbn13 || "",
    ]);

    info(formatTable(headers, rows));
    info(`\nTotal: ${entries.length} book(s)`);
  } catch (err) {
    error(`Failed to list books: ${err}`);
    process.exit(1);
  }
}

/**
 * Show a single book by ID
 */
async function showBook(context: CLIContext): Promise<void> {
  const { entities, args } = context;
  const [idStr] = args;

  if (!idStr) {
    error("Book ID is required");
    info("Usage: quailcomp books show <id>");
    process.exit(1);
  }

  const entityId = parseInt(idStr, 10);
  if (isNaN(entityId)) {
    error("Invalid book ID");
    process.exit(1);
  }

  try {
    const entry = await entities.getById<BookEntitySnapshot>(entityId);

    if (!entry) {
      error(`Book not found: ${entityId}`);
      process.exit(1);
    }

    if (entry.deletedAt) {
      info("(This book has been deleted)\n");
    }

    info(`Book #${entry.entityId}`);
    info(formatJSON(entry.data, true));
    info(`\nCreated: ${entry.enteredAt.toISOString()}`);
    if (entry.deletedAt) {
      info(`Deleted: ${entry.deletedAt.toISOString()}`);
    }
  } catch (err) {
    error(`Failed to show book: ${err}`);
    process.exit(1);
  }
}

/**
 * Add a new book
 */
async function addBook(context: CLIContext): Promise<void> {
  const { entities, args } = context;

  // Parse arguments into book data
  const data: BookEntitySnapshot = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === "--title" && i + 1 < args.length) {
      data.title = args[i + 1];
      i += 2;
    } else if (arg === "--subtitle" && i + 1 < args.length) {
      data.subtitle = args[i + 1];
      i += 2;
    } else if (arg === "--author" && i + 1 < args.length) {
      data.author = args[i + 1];
      i += 2;
    } else if (arg === "--isbn10" && i + 1 < args.length) {
      data.isbn10 = args[i + 1];
      i += 2;
    } else if (arg === "--isbn13" && i + 1 < args.length) {
      data.isbn13 = args[i + 1];
      i += 2;
    } else if (arg === "--lccn" && i + 1 < args.length) {
      data.lccn = args[i + 1];
      i += 2;
    } else if (arg === "--note" && i + 1 < args.length) {
      data.note = args[i + 1];
      i += 2;
    } else {
      error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  if (!data.title) {
    error("Title is required");
    info("Usage: quailcomp books add --title <title> [options]");
    info("Options:");
    info("  --title <title>       Book title (required)");
    info("  --subtitle <subtitle> Book subtitle");
    info("  --author <author>     Book author");
    info("  --isbn10 <isbn10>     ISBN-10");
    info("  --isbn13 <isbn13>     ISBN-13");
    info("  --lccn <lccn>         Library of Congress Control Number");
    info("  --note <note>         Additional notes");
    process.exit(1);
  }

  try {
    const entry = await entities.create<BookEntitySnapshot>({
      type: BOOK_TYPE,
      data,
    });

    success(`Book created with ID: ${entry.entityId}`);
    info(formatJSON(entry.data, true));
  } catch (err) {
    error(`Failed to create book: ${err}`);
    process.exit(1);
  }
}

/**
 * Update an existing book
 */
async function updateBook(context: CLIContext): Promise<void> {
  const { entities, args } = context;
  const [idStr, ...updateArgs] = args;

  if (!idStr) {
    error("Book ID is required");
    info("Usage: quailcomp books update <id> [options]");
    process.exit(1);
  }

  const entityId = parseInt(idStr, 10);
  if (isNaN(entityId)) {
    error("Invalid book ID");
    process.exit(1);
  }

  // Get existing book
  const existing = await entities.getById<BookEntitySnapshot>(entityId);
  if (!existing) {
    error(`Book not found: ${entityId}`);
    process.exit(1);
  }

  // Parse update arguments
  const data: BookEntitySnapshot = { ...existing.data };
  let i = 0;

  while (i < updateArgs.length) {
    const arg = updateArgs[i];

    if (arg === "--title" && i + 1 < updateArgs.length) {
      data.title = updateArgs[i + 1];
      i += 2;
    } else if (arg === "--subtitle" && i + 1 < updateArgs.length) {
      data.subtitle = updateArgs[i + 1];
      i += 2;
    } else if (arg === "--author" && i + 1 < updateArgs.length) {
      data.author = updateArgs[i + 1];
      i += 2;
    } else if (arg === "--isbn10" && i + 1 < updateArgs.length) {
      data.isbn10 = updateArgs[i + 1];
      i += 2;
    } else if (arg === "--isbn13" && i + 1 < updateArgs.length) {
      data.isbn13 = updateArgs[i + 1];
      i += 2;
    } else if (arg === "--lccn" && i + 1 < updateArgs.length) {
      data.lccn = updateArgs[i + 1];
      i += 2;
    } else if (arg === "--note" && i + 1 < updateArgs.length) {
      data.note = updateArgs[i + 1];
      i += 2;
    } else {
      error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  try {
    const entry = await entities.update<BookEntitySnapshot>({
      entityId,
      type: BOOK_TYPE,
      data,
    });

    success(`Book updated: ${entry.entityId}`);
    info(formatJSON(entry.data, true));
  } catch (err) {
    error(`Failed to update book: ${err}`);
    process.exit(1);
  }
}

/**
 * Delete a book (soft delete)
 */
async function deleteBook(context: CLIContext): Promise<void> {
  const { entities, args } = context;
  const [idStr] = args;

  if (!idStr) {
    error("Book ID is required");
    info("Usage: quailcomp books delete <id>");
    process.exit(1);
  }

  const entityId = parseInt(idStr, 10);
  if (isNaN(entityId)) {
    error("Invalid book ID");
    process.exit(1);
  }

  // Get existing book
  const existing = await entities.getById<BookEntitySnapshot>(entityId);
  if (!existing) {
    error(`Book not found: ${entityId}`);
    process.exit(1);
  }

  if (existing.deletedAt) {
    error("Book is already deleted");
    process.exit(1);
  }

  try {
    await entities.delete({
      entityId,
      type: BOOK_TYPE,
      data: existing.data,
    });

    success(`Book deleted: ${entityId}`);
  } catch (err) {
    error(`Failed to delete book: ${err}`);
    process.exit(1);
  }
}

/**
 * Show book history (all versions)
 */
async function historyBook(context: CLIContext): Promise<void> {
  const { entities, args } = context;
  const [idStr] = args;

  if (!idStr) {
    error("Book ID is required");
    info("Usage: quailcomp books history <id>");
    process.exit(1);
  }

  const entityId = parseInt(idStr, 10);
  if (isNaN(entityId)) {
    error("Invalid book ID");
    process.exit(1);
  }

  try {
    const history = await entities.getHistory<BookEntitySnapshot>(entityId);

    if (history.length === 0) {
      error(`Book not found: ${entityId}`);
      process.exit(1);
    }

    info(`History for Book #${entityId} (${history.length} version(s)):\n`);

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const version = history.length - i;

      info(`Version ${version} - ${entry.enteredAt.toISOString()}`);
      if (entry.deletedAt) {
        info("  (DELETED)");
      }
      info(formatJSON(entry.data, true));
      if (i < history.length - 1) {
        info("\n---\n");
      }
    }
  } catch (err) {
    error(`Failed to get book history: ${err}`);
    process.exit(1);
  }
}

/**
 * Books command definition
 */
export const booksCommand: Command = {
  name: "books",
  description: "Manage books in your collection",
  usage: "books <subcommand> [options]",
  handler: async (context: CLIContext) => {
    error("Please specify a subcommand");
    info("Usage: quailcomp books <subcommand>");
    info("\nSubcommands:");
    info("  list             List all books");
    info("  show <id>        Show book details");
    info("  add              Add a new book");
    info("  update <id>      Update an existing book");
    info("  delete <id>      Delete a book");
    info("  history <id>     Show book version history");
    process.exit(1);
  },
  subcommands: new Map([
    [
      "list",
      {
        name: "list",
        description: "List all books",
        usage: "books list",
        handler: listBooks,
      },
    ],
    [
      "show",
      {
        name: "show",
        description: "Show book details",
        usage: "books show <id>",
        handler: showBook,
      },
    ],
    [
      "add",
      {
        name: "add",
        description: "Add a new book",
        usage: "books add --title <title> [options]",
        handler: addBook,
      },
    ],
    [
      "update",
      {
        name: "update",
        description: "Update an existing book",
        usage: "books update <id> [options]",
        handler: updateBook,
      },
    ],
    [
      "delete",
      {
        name: "delete",
        description: "Delete a book",
        usage: "books delete <id>",
        handler: deleteBook,
      },
    ],
    [
      "history",
      {
        name: "history",
        description: "Show book version history",
        usage: "books history <id>",
        handler: historyBook,
      },
    ],
  ]),
};
