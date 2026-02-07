# DevTools

> Development tooling system for file watching, task automation, and continuous maintenance.

The DevTools domain provides a Laravel Telescope-inspired system for monitoring file changes and automatically running maintenance tasks during development. It combines file watching, task execution, and a real-time web UI to keep code quality checks running continuously without manual intervention.

## Core Architecture

> A three-layer system: file watcher, task executor, and web UI.

The DevTools system consists of three main components:

1. **File Watcher** - Monitors file changes using Node's `fs.watch()` API and matches them against glob patterns
2. **Task Executor** - Runs maintenance tasks (type generation, linting, README checks) with debouncing
3. **Web UI** - Real-time dashboard showing task status, execution history, and manual triggers

This architecture enables developers to receive immediate feedback on code quality issues without waiting for git commit hooks or CI pipelines.

## Watch Rules

> Declarative configuration for what files to watch and what tasks to run.

A watch rule defines the relationship between file patterns and the tasks to execute when those files change.

```typescript
export interface WatchRule {
  name: string; // "type-generation"
  description: string; // "Extract types from domain docs"
  watch: string[]; // ["domains/**/*.md"]
  run: WatchTask; // Function or command string
  debounce?: number; // ms (default: 300)
  runOnStart?: boolean; // Run immediately (default: false)
}

export type WatchTask =
  | string // Shell command
  | ((changed: string[]) => Promise<TaskResult>); // Function
```

**Watch Rule Properties:**

- `name` - Unique identifier for the rule (used in UI and logging)
- `description` - Human-readable explanation of what the rule does
- `watch` - Array of glob patterns to match files (supports negation with `!` prefix)
- `run` - Task to execute (either a shell command string or async function)
- `debounce` - Milliseconds to wait before executing after file changes (prevents rapid re-runs)
- `runOnStart` - Whether to run the task immediately when the watcher starts

**Usage Example (JSON):**

```json
[
  {
    "name": "type-generation",
    "description": "Extract TypeScript types from domain markdown files",
    "watch": ["domains/**/*.md", "!domains/README.md"],
    "run": "<extractTypes function>",
    "debounce": 500
  },
  {
    "name": "lint-files",
    "description": "Run ESLint on changed files",
    "watch": ["**/*.ts", "**/*.tsx", "!**/node_modules/**"],
    "run": "bun run lint",
    "debounce": 500
  }
]
```

## Task Execution

> Captures stdout, stderr, duration, and success status for every task run.

Task execution provides a standardized interface for running both functions and shell commands, with comprehensive result tracking.

```typescript
export interface TaskResult {
  success: boolean;
  stdout: string;
  stderr: string;
  duration: number; // ms
  error?: Error;
}

export interface TaskExecution {
  ruleName: string;
  timestamp: number;
  duration: number;
  status: 'success' | 'error' | 'warning';
  stdout: string;
  stderr: string;
  changedFiles: string[];
}
```

**Task Result:**

- `success` - Whether the task completed without errors (exit code 0 for shell commands)
- `stdout` - Standard output captured from the task
- `stderr` - Standard error captured (warnings or error messages)
- `duration` - Execution time in milliseconds
- `error` - JavaScript Error object if task threw an exception

**Task Execution:**

- `ruleName` - Which rule triggered this execution
- `timestamp` - Unix timestamp (ms) when execution started
- `status` - Derived status: `success` (no errors), `error` (failed), `warning` (succeeded with stderr)
- `changedFiles` - Array of file paths that triggered this execution

## Task Executor

> Manages task execution lifecycle with callbacks for UI updates.

```typescript
export type TaskExecutor = {
  execute: (rule: WatchRule, changedFiles: string[]) => Promise<void>;
  getHistory: () => TaskExecution[];
  clearHistory: () => void;
};

export interface TaskExecutorCallbacks {
  onExecutionStart: (ruleName: string) => void;
  onExecutionEnd: (execution: TaskExecution) => void;
}
```

**Functions:**

- `execute()` - Runs a task for the given rule and changed files
- `getHistory()` - Returns array of recent task executions (circular buffer, max 100)
- `clearHistory()` - Empties the execution history

**Callbacks:**

- `onExecutionStart` - Called before task begins (for UI status updates)
- `onExecutionEnd` - Called after task completes (with full execution details)

## Watcher State

> In-memory state tracking all active rules and execution history.

The watcher maintains a central state object that's exposed to the UI server for real-time monitoring.

```typescript
export interface WatcherState {
  rules: WatchRule[]; // All registered watch rules
  executions: TaskExecution[]; // Last 100 executions (circular buffer)
  currentlyRunning: Set<string>; // Rule names currently executing
}

export const MAX_EXECUTIONS = 100;
```

**State Properties:**

- `rules` - Complete list of watch rules loaded from configuration
- `executions` - Circular buffer of recent task executions (newest last)
- `currentlyRunning` - Set of rule names that are currently executing tasks

**Circular Buffer:**

The executions array maintains a maximum of 100 entries. When a new execution is added and the array exceeds 100, the oldest execution is removed. This prevents unbounded memory growth while preserving recent history for debugging.

## File Matching

> Glob patterns support wildcards, directory matching, and negation.

File matching uses the `minimatch` library to match file paths against glob patterns.

**Pattern Examples:**

- `**/*.ts` - All TypeScript files in any directory
- `domains/**/*.md` - Markdown files in domains directory and subdirectories
- `!domains/README.md` - Exclude specific file (negation)
- `src/**/*.test.ts` - Test files in src directory
- `*.json` - JSON files in project root only

**Matching Rules:**

- Patterns are evaluated against normalized paths (without leading `./`)
- Multiple patterns in a rule are OR'd (match any pattern)
- Negation patterns (starting with `!`) exclude files that would otherwise match
- Paths containing `node_modules`, `.git`, `dist`, or `coverage` are automatically ignored

## Integration Points

> DevTools integrates with git hooks, domain type extraction, and development workflows.

**Git Hooks** ([`.githooks/pre-commit`](../.githooks/pre-commit)):

- Pre-commit hook serves as a safety net when developers don't run watchers
- Hook runs the same validation tasks (type extraction, type checking, linting)
- Watchers provide continuous feedback during development
- Hook ensures validation happens at commit time regardless of watcher usage

**Domain Type Extraction** ([`domains/`](../domains/)):

- Watch rule monitors `domains/**/*.md` for changes
- Automatically extracts TypeScript code blocks to `domains/types/*.ts`
- Enables type-safe domain documentation with zero manual maintenance
- See [Write Domain Documentation](../docs/how-to/write-domain-docs.md)

**Development UI** ([`devtools/ui/`](../devtools/ui/)):

- Vue 3 web application served on port 3002 (dev) or 3001 (prod)
- Real-time status updates via Server-Sent Events (SSE)
- Manual task triggering for on-demand validation
- Execution history with searchable logs

**Test Infrastructure** ([`devtools/tests/misc.test.ts`](../devtools/tests/misc.test.ts)):

- Automated tests for devtools infrastructure
- Validates watch rules, task execution, and file matching
- Ensures devtools reliability for development workflows

## Current Watch Rules

> Four active rules cover type generation, README validation, type checking, and linting.

### 1. Type Generation

- **Name:** `type-generation`
- **Watches:** `domains/**/*.md` (excluding `README.md`)
- **Task:** Extract TypeScript types from domain documentation
- **Debounce:** 500ms
- **Output:** Generated files in `domains/types/`

### 2. README Validation

- **Name:** `readme-validation`
- **Watches:** All `.ts`, `.tsx`, `.vue`, `.md` files
- **Task:** Check that directories with changes have README files
- **Debounce:** 1000ms
- **Output:** Warnings for missing or outdated READMEs

### 3. TypeScript Type Checking

- **Name:** `typecheck-domains`
- **Watches:** `domains/**/*.ts`
- **Task:** Run `tsc --noEmit` in domains directory
- **Debounce:** 1000ms
- **Output:** Type checking errors and warnings

### 4. Linting

- **Name:** `lint-files`
- **Watches:** All `.ts`, `.tsx`, `.js`, `.jsx`, `.vue` files
- **Task:** Run ESLint on changed files
- **Debounce:** 500ms
- **Output:** Linting errors, warnings, and auto-fixes

## Invariants

> Constraints that ensure reliable task execution and state management.

1. **Unique Rule Names:** Each watch rule must have a unique `name` field (used as identifier)
2. **Circular Buffer Size:** Executions array never exceeds `MAX_EXECUTIONS` (100 entries)
3. **Task Atomicity:** Each task execution is atomic (no concurrent runs of the same rule)
4. **Debouncing:** File changes within the debounce window trigger only one execution
5. **Clean Shutdown:** All debounce timers are cleared on watcher shutdown
6. **State Consistency:** `currentlyRunning` set is updated before and after each execution

## Use Cases

> Common scenarios where DevTools automation saves manual effort.

### During Active Development

As you write code, the watcher provides immediate feedback:

- Save a domain markdown file → types extracted and type-checked automatically
- Modify TypeScript files → ESLint runs and reports issues
- Create new directories → warned if missing README
- No need to manually run `bun test`, `bun run lint`, or commit hooks

### Before Committing

The pre-commit hook ensures all validations pass:

- Type extraction runs if domain docs changed
- Type checking validates all generated types
- Linting checks all staged files
- README maintenance checker warns about missing docs

### Manual Triggering

Use the web UI to run tasks on demand:

- Force type regeneration without file changes
- Run full lint check across entire codebase
- Validate all READMEs before documentation review
- Debug task execution with detailed logs

### Continuous Monitoring

The web UI provides oversight during long coding sessions:

- See which tasks ran recently and their status
- Review task output without scrolling terminal history
- Monitor task duration to identify performance issues
- Track success rates to identify flaky tasks

## Performance Considerations

> Debouncing and selective execution minimize overhead while maintaining responsiveness.

**Debouncing Strategy:**

- Default 300ms debounce prevents excessive re-runs during rapid file changes
- Type generation uses 500ms to handle multiple markdown saves
- README validation uses 1000ms to avoid checking every file save

**Selective Execution:**

- Only rules matching changed file patterns are triggered
- Tasks receive list of changed files (can process selectively)
- Concurrent rule executions are allowed (different rules can run in parallel)
- Same rule cannot run concurrently (queued automatically)

**Memory Management:**

- Circular buffer limits execution history to 100 entries (~50KB)
- Debounce timers cleared on shutdown (no memory leaks)
- State change listeners can unsubscribe (prevents memory leaks)

**Target Performance:**

- File change detection: <10ms
- Glob pattern matching: <5ms per rule
- Task startup overhead: <50ms
- Total overhead per file change: <100ms (excluding task execution time)

## Related Documentation

- [DevTools README](../devtools/README.md) - Full DevTools system documentation
- [How to Write Domain Docs](../docs/how-to/write-domain-docs.md) - Domain documentation guide
- [Run Migrations](../docs/how-to/run-migrations.md) - Database migration workflow
- [Commit Protocol](../docs/how-to/commit-changes.md) - How to commit changes

## Future Enhancements

**Planned Features:**

- HTTP request/response logging (Telescope-style)
- Database query monitoring with N+1 detection
- Performance metrics dashboard (P95/P99 latencies)
- Scheduled tasks (cron-like)
- Task dependencies and chaining
- Notification system (desktop/email alerts)
- Search and filtering in execution history
- Export logs as JSON/CSV
