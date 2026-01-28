import { describe, test, expect, mock } from "bun:test";
import { createRouter } from "@cli/router";
import type { Command, CLIContext } from "@cli/types";

// Mock context for testing
function createMockContext(args: string[]): CLIContext {
  return {
    sql: null as any,
    entities: null as any,
    events: null as any,
    args,
  };
}

describe("CLIRouter", () => {
  test("registers and retrieves commands", () => {
    const router = createRouter();
    const mockCommand: Command = {
      name: "test",
      description: "Test command",
      usage: "test [options]",
      handler: async () => {},
    };

    router.register(mockCommand);
    const commands = router.getCommands();

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("test");
  });

  test("executes registered command", async () => {
    const router = createRouter();
    const handler = mock(async () => {});
    const testCommand: Command = {
      name: "test",
      description: "Test command",
      usage: "test",
      handler,
    };

    router.register(testCommand);

    const context = createMockContext(["test"]);
    await router.execute(context);

    expect(handler).toHaveBeenCalled();
  });

  test("executes subcommand when available", async () => {
    const router = createRouter();
    const mainHandler = mock(async () => {});
    const subHandler = mock(async () => {});

    const testCommand: Command = {
      name: "test",
      description: "Test command",
      usage: "test <subcommand>",
      handler: mainHandler,
      subcommands: new Map([
        [
          "sub",
          {
            name: "sub",
            description: "Subcommand",
            usage: "test sub",
            handler: subHandler,
          },
        ],
      ]),
    };

    router.register(testCommand);

    const context = createMockContext(["test", "sub"]);
    await router.execute(context);

    expect(subHandler).toHaveBeenCalled();
    expect(mainHandler).not.toHaveBeenCalled();
  });

  test("passes remaining args to subcommand", async () => {
    const router = createRouter();
    let receivedArgs: string[] = [];
    const subHandler = mock(async (ctx: CLIContext) => {
      receivedArgs = ctx.args;
    });

    const testCommand: Command = {
      name: "test",
      description: "Test command",
      usage: "test <subcommand>",
      handler: async () => {},
      subcommands: new Map([
        [
          "sub",
          {
            name: "sub",
            description: "Subcommand",
            usage: "test sub [args]",
            handler: subHandler,
          },
        ],
      ]),
    };

    router.register(testCommand);

    const context = createMockContext(["test", "sub", "arg1", "arg2"]);
    await router.execute(context);

    expect(subHandler).toHaveBeenCalled();
    expect(receivedArgs).toEqual(["arg1", "arg2"]);
  });

  test("shows help when no command provided", async () => {
    const router = createRouter();
    const consoleSpy = mock(() => {});
    const originalLog = console.log;
    console.log = consoleSpy;

    const context = createMockContext([]);
    await router.execute(context);

    console.log = originalLog;

    expect(consoleSpy).toHaveBeenCalled();
  });

  test("shows help when help command provided", async () => {
    const router = createRouter();
    const consoleSpy = mock(() => {});
    const originalLog = console.log;
    console.log = consoleSpy;

    const context = createMockContext(["help"]);
    await router.execute(context);

    console.log = originalLog;

    expect(consoleSpy).toHaveBeenCalled();
  });

  test("shows command-specific help", async () => {
    const router = createRouter();
    const testCommand: Command = {
      name: "test",
      description: "Test command",
      usage: "test [options]",
      handler: async () => {},
    };

    router.register(testCommand);

    const consoleSpy = mock(() => {});
    const originalLog = console.log;
    console.log = consoleSpy;

    const context = createMockContext(["help", "test"]);
    await router.execute(context);

    console.log = originalLog;

    expect(consoleSpy).toHaveBeenCalled();
  });
});
