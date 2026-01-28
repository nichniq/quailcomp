import type { Command, CLIContext } from "@cli/types";
import { error, info } from "@cli/utils/output";

/**
 * CLI Router - handles command routing and execution
 */
export class CLIRouter {
  private commands = new Map<string, Command>();

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.name, command);
  }

  /**
   * Get all registered commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Execute a command based on CLI arguments
   */
  async execute(context: CLIContext): Promise<void> {
    const [commandName, ...args] = context.args;

    // Show help if no command provided
    if (!commandName || commandName === "help" || commandName === "--help" || commandName === "-h") {
      this.showHelp(args[0]);
      return;
    }

    // Find and execute command
    const command = this.commands.get(commandName);
    if (!command) {
      error(`Unknown command: ${commandName}`);
      info("\nRun 'quailcomp help' to see available commands.");
      process.exit(1);
    }

    // Handle subcommands
    if (command.subcommands && args.length > 0) {
      const [subcommandName, ...subargs] = args;
      const subcommand = command.subcommands.get(subcommandName);

      if (subcommand) {
        await subcommand.handler({ ...context, args: subargs });
        return;
      }
    }

    // Execute main command
    await command.handler({ ...context, args });
  }

  /**
   * Show help message
   */
  private showHelp(commandName?: string): void {
    if (commandName) {
      const command = this.commands.get(commandName);
      if (!command) {
        error(`Unknown command: ${commandName}`);
        return;
      }

      info(`Usage: quailcomp ${command.usage}`);
      info(`\n${command.description}`);

      if (command.subcommands && command.subcommands.size > 0) {
        info("\nSubcommands:");
        for (const [name, subcmd] of command.subcommands) {
          info(`  ${name.padEnd(15)} ${subcmd.description}`);
        }
      }
    } else {
      info("Quailcomp CLI - Personal Data Management System");
      info("\nUsage: quailcomp <command> [options]");
      info("\nCommands:");

      for (const command of this.commands.values()) {
        info(`  ${command.name.padEnd(15)} ${command.description}`);
      }

      info("\nRun 'quailcomp help <command>' for more information about a command.");
    }
  }
}

/**
 * Create and configure the CLI router
 */
export function createRouter(): CLIRouter {
  return new CLIRouter();
}
