# Quailcomp DevTools

A Laravel Telescope-inspired development tooling system for continuous monitoring and automation of maintenance tasks.

## Overview

The DevTools system provides:

1. **File Watchers** - Continuously monitor files and run maintenance tasks automatically
2. **Web UI** - Real-time dashboard for monitoring watcher status, logs, and manual triggers
3. **Task Automation** - Centralized place for all dev tooling (type generation, linting, README checks, etc.)

## Architecture

```
/devtools/
  /watch/           # File watching and task execution
    index.ts        # Main orchestrator
    rules.ts        # Watch rule definitions
    runner.ts       # Task execution engine
    types.ts        # Type definitions
    /tasks/         # Individual task implementations
  /ui/              # Web-based monitoring dashboard
    /src/           # Vue 3 application
    server.ts       # API + static file server
  /tests/           # Tests for devtools infrastructure
```

### Watch System

The watch system monitors file changes and executes tasks based on defined rules.

**Key Components:**

- **Orchestrator** (`watch/index.ts`) - Monitors files using Node's `fs.watch()` API
- **Rules** (`watch/rules.ts`) - Defines what files to watch and what tasks to run
- **Runner** (`watch/runner.ts`) - Executes tasks (functions or shell commands)
- **Tasks** (`watch/tasks/`) - Individual maintenance task implementations

**Features:**

- Glob pattern matching for file watching
- Per-rule debouncing to avoid excessive runs
- Circular buffer of last 100 executions
- Real-time state updates via event emitter
- Graceful shutdown handling

### UI System

A Vue 3 web application for monitoring and controlling the watch system.

**Tech Stack:**

- Vue 3 (Composition API)
- Vite (development server + build tool)
- TypeScript
- Server-Sent Events (SSE) for real-time updates

**Features:**

- Real-time status monitoring of all watch rules
- Manual task triggering
- Execution history with logs
- Relative timestamps ("2s ago")
- Status indicators (success, error, warning, running, idle)

**Ports:**

- Development: Vite dev server on 3002, API server on 3001
- Production: Single server on 3001 serving both API and static files

## Usage

### Quick Start

Run everything (watch + UI + main app):

```bash
bun run devtools
```

This starts:

- File watcher on project root
- DevTools API server on port 3001
- DevTools UI (Vite) on port 3002
- Main application backend on port 3000
- Main application frontend on port 5173

Open <http://localhost:3002> to view the DevTools dashboard.

### Individual Components

Run just the file watcher:

```bash
bun run devtools:watch
```

Run just the UI (development mode):

```bash
bun run devtools:ui:dev
```

Build and serve UI in production mode:

```bash
bun run devtools:ui:serve
```

## Current Watch Rules

### 1. Type Generation

- **Watches:** `domains/**/*.md` (excluding `README.md`)
- **Task:** Extract TypeScript code blocks from domain docs
- **Debounce:** 500ms
- **Output:** `domains/types/*.ts` files
- **Filtering:** Only extracts `export` statements and `import` statements; skips example code and function declarations without implementations
- **Optimization:** Only writes files when content changes to prevent infinite watch loops

### 2. README Validation

- **Watches:** All `.ts`, `.tsx`, `.vue`, `.md` files
- **Task:** Check that changed directories have README files
- **Debounce:** 1000ms
- **Output:** Warnings for missing or outdated READMEs

### 3. TypeScript Type Checking

- **Watches:** `domains/**/*.ts`
- **Task:** Run `tsc --noEmit` in domains directory
- **Debounce:** 1000ms
- **Output:** Type checking results

### 4. Linting

- **Watches:** All `.ts`, `.tsx`, `.js`, `.jsx`, `.vue` files
- **Task:** Run ESLint on changed files
- **Debounce:** 500ms
- **Output:** Linting errors and warnings

## Adding New Watch Rules

Edit `devtools/watch/rules.ts`:

```typescript
import { myNewTask } from './tasks/my-new-task'

export const rules: WatchRule[] = [
  // ... existing rules
  {
    name: 'my-new-rule',
    description: 'Description of what this rule does',
    watch: ['src/**/*.ts', '!**/*.test.ts'], // Glob patterns
    run: myNewTask, // Function or shell command string
    debounce: 300, // Optional, default 300ms
    runOnStart: false, // Optional, default false
  },
]
```

Create your task function in `devtools/watch/tasks/`:

```typescript
import type { TaskResult } from '../types'

export async function myNewTask(changed: string[]): Promise<TaskResult> {
  const startTime = Date.now()

  try {
    // Your task logic here
    return {
      success: true,
      stdout: 'Task completed successfully',
      stderr: '',
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: `Error: ${error}`,
      duration: Date.now() - startTime,
      error: error as Error,
    }
  }
}
```

## API Endpoints

### GET /api/watcher/status

Returns current state of all watch rules and executions.

**Response:**

```json
{
  "rules": [...],
  "executions": [...],
  "currentlyRunning": ["rule-name"]
}
```

### GET /api/watcher/history

Returns last 50 task executions.

### POST /api/watcher/trigger/:ruleName

Manually trigger a watch rule.

### GET /api/watcher/events

Server-Sent Events stream for real-time updates.

## Relationship to Git Hooks

The pre-commit hook (`.githooks/pre-commit`) remains unchanged and serves as a **safety net**.

- **During Development:** Watchers provide continuous feedback
- **Before Commit:** Hook ensures all validations pass
- **Optional:** Developers can choose to run watchers or not

This provides a gradual migration path. In the future, the hook can be simplified to just recommend running devtools.

## Future Enhancements

Planned features (not yet implemented):

- **Request/Response Logging** - Telescope-style HTTP request monitoring
- **Database Query Monitoring** - Track query performance and N+1 issues
- **Performance Metrics** - P95/P99 response times, endpoint analytics
- **API Key Management** - Generate and manage API keys via UI
- **Git Workflow Visualization** - Branch status, PR checks, commit history
- **Scheduled Tasks** - Cron-like scheduled maintenance tasks
- **Task Dependencies** - Chain tasks together with dependencies
- **Notification System** - Desktop/email notifications for failures
- **Search & Filtering** - Search through execution history
- **Export Logs** - Download execution logs as JSON/CSV

## Testing

Tests for devtools infrastructure are in `devtools/tests/misc.test.ts`.

Run tests:

```bash
bun test devtools/tests/misc.test.ts
```

## Troubleshooting

### Watcher not detecting changes

- Check that file patterns in `rules.ts` match your files
- Ensure you're not in an ignored directory (`node_modules`, `.git`, `dist`, `coverage`)
- Check console output for errors

### UI not connecting to API

- Verify API server is running on port 3001
- Check browser console for CORS errors
- In dev mode, ensure Vite proxy is configured correctly

### Tasks failing

- Check task output in UI or console logs
- Verify task has correct permissions
- Ensure dependencies are installed

### Infinite loop / Tasks running repeatedly

This issue has been fixed as of the latest version. The type generation task now:

- Only writes files when content actually changes
- Skips cache writes when cache is unchanged
- Filters out example code that doesn't need to be in generated files

If you still see repeated executions, check that:

- You're not manually modifying generated files in `domains/types/`
- Your markdown files don't have syntax errors causing re-extraction
- Task debounce settings are appropriate (default: 300-1000ms)

## Contributing

When adding new watch rules or tasks:

1. Add the rule to `devtools/watch/rules.ts`
2. Implement the task in `devtools/watch/tasks/`
3. Test the task standalone: `bun run devtools/watch/tasks/your-task.ts`
4. Test with watcher: modify a matching file and check execution
5. Update this README with the new rule documentation
