# How to Start Local Servers for Development

This guide explains how to start the various development servers for local Quailcomp development.

## Prerequisites

Before starting any servers, ensure you have:

1. Completed the [development setup](setup-development.md)
2. Database is running and migrated
3. Environment variables are configured (`.env` file exists)

## Quick Start - All Servers

To start everything at once (recommended for full-stack development):

```bash
bun run devtools
```

This starts all servers in parallel:

- **Backend API** - Port 3000
- **Frontend** - Port 5173
- **DevTools Watcher** - Background process
- **DevTools API** - Port 3001
- **DevTools UI** - Port 3002

Open your browser:

- Main application: <http://localhost:5173>
- DevTools dashboard: <http://localhost:3002>

## Individual Servers

You can also start servers individually for focused development.

### Backend Server

The backend HTTP server provides the REST API.

```bash
cd server
bun run dev
```

**Port:** 3000 (configurable via `PORT` environment variable)
**Auto-reload:** Yes (via `--watch` flag)
**Logs:** Pretty-printed JSON with `pino-pretty`

**Verify it's running:**

```bash
curl http://localhost:3000/health
```

**Configuration:**

- Port: `PORT` env var (default: `3000`)
- Host: `HOST` env var (default: `0.0.0.0`)
- Log level: `LOG_LEVEL` env var (default: `info`)

See [Environment Variables Reference](../reference/environment-variables.md) for all options.

### Frontend Server

The Vue 3 frontend application with Vite dev server.

```bash
cd frontend
bun run dev
```

**Port:** 5173 (configured in [vite.config.ts](../../frontend/vite.config.ts))
**Auto-reload:** Yes (Vite HMR)
**API Proxy:** Requests to `/api` are proxied to `http://localhost:3000`

**Verify it's running:**

Open <http://localhost:5173> in your browser.

**Configuration:**

- Port: `5173` (change in `frontend/vite.config.ts`)
- Backend proxy: Points to `http://localhost:3000`

### DevTools Watcher

The file watcher monitors your codebase and runs maintenance tasks automatically.

```bash
bun run devtools:watch
```

**What it does:**

- Watches files for changes based on glob patterns
- Auto-extracts TypeScript types from domain documentation
- Validates README files exist in changed directories
- Runs TypeScript type checking on domain files
- Lints changed files with ESLint

**Output:** Console logs showing detected changes and task execution

See [DevTools README](../../devtools/README.md) for details on watch rules.

### DevTools API Server

The backend API for the DevTools dashboard.

**Development mode:**

```bash
cd devtools/ui
bun run server.ts
```

**Port:** 3001
**Mode:** API only (Vite serves UI on 3002)

**Production mode:**

```bash
bun run devtools:ui:serve
```

**Port:** 3001
**Mode:** Serves both API and static UI files

### DevTools UI

The Vue 3 web dashboard for monitoring and controlling the watch system.

```bash
bun run devtools:ui:dev
```

Or from the devtools/ui directory:

```bash
cd devtools/ui
bun run dev
```

**Port:** 3002
**Auto-reload:** Yes (Vite HMR)
**API Connection:** Connects to DevTools API on port 3001

**Features:**

- Real-time status monitoring via Server-Sent Events (SSE)
- Manual task triggering
- Execution history with logs
- Status indicators (success/error/warning/running/idle)

## Port Reference

| Server | Port | Configured In |
|--------|------|---------------|
| Backend API | 3000 | `.env` (`PORT` variable) |
| Frontend | 5173 | [frontend/vite.config.ts](../../frontend/vite.config.ts#L13) |
| DevTools API | 3001 | [devtools/ui/server.ts](../../devtools/ui/server.ts#L14) |
| DevTools UI | 3002 | [devtools/ui/vite.config.ts](../../devtools/ui/vite.config.ts#L7) |

## Common Commands from Project Root

All servers can be started from the project root using these commands:

```bash
# Start all servers (recommended)
bun run devtools

# Individual servers
bun run dev:server           # Backend only
bun run dev:frontend         # Frontend only
bun run devtools:watch       # File watcher only
bun run devtools:ui:dev      # DevTools UI only
```

## Typical Development Workflows

### Full-Stack Development

Working on both frontend and backend? Start everything:

```bash
bun run devtools
```

### Backend-Only Development

Working on API endpoints or server-side logic:

```bash
bun run dev:server
```

Test with curl or your API client of choice.

### Frontend-Only Development

Working on UI components or styling:

```bash
# Terminal 1: Backend API
bun run dev:server

# Terminal 2: Frontend
bun run dev:frontend
```

The frontend needs the backend API to be running for data.

### Documentation or Domain Modeling

Working on domain docs or architecture:

```bash
bun run devtools:watch
```

This watches domain documentation and auto-extracts TypeScript types as you write.

## Troubleshooting

### Port Already in Use

If you see "address already in use" errors:

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

Or change the port in your `.env` file or Vite config.

### Database Connection Errors

Verify your database is running:

```bash
pg_isready
```

Check your `.env` file has correct `DATABASE_URL` or individual `DB_*` variables.

See [Environment Variables Reference](../reference/environment-variables.md).

### Frontend Can't Connect to Backend

1. Verify backend is running on port 3000
2. Check proxy configuration in `frontend/vite.config.ts`
3. Look for CORS errors in browser console
4. Verify `CORS_ORIGINS` in `.env` includes `http://localhost:5173`

### DevTools UI Not Updating

1. Verify DevTools API server is running on port 3001
2. Check browser console for SSE connection errors
3. Ensure DevTools watcher is running to generate events
4. Try refreshing the browser (Cmd+R)

### Changes Not Being Detected

1. Check that files match watch patterns in `devtools/watch/rules.ts`
2. Ensure you're not in an ignored directory (`node_modules`, `.git`, `dist`, `coverage`)
3. Look for error messages in the watcher console output
4. Verify debounce timing hasn't delayed execution

## Stopping Servers

Press `Ctrl+C` in the terminal running the server.

For the `devtools` command which runs multiple servers via `concurrently`, `Ctrl+C` will stop all servers at once.

## Related

- [Development Setup](setup-development.md) - Initial environment configuration
- [Environment Variables Reference](../reference/environment-variables.md) - All configuration options
- [DevTools README](../../devtools/README.md) - DevTools architecture and features
- [Run Tests](run-tests.md) - Testing your changes
