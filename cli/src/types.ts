import type { SQL } from "bun";
import type { EntitiesClient, EventsClient } from "@quailcomp/data";

/**
 * Context passed to all CLI commands
 */
export interface CLIContext {
  sql: SQL;
  entities: EntitiesClient;
  events: EventsClient;
  args: string[];
}

/**
 * Command handler function signature
 */
export type CommandHandler = (context: CLIContext) => Promise<void>;

/**
 * Command definition
 */
export interface Command {
  name: string;
  description: string;
  usage: string;
  handler: CommandHandler;
  subcommands?: Map<string, Command>;
}
