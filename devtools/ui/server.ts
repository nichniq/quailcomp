#!/usr/bin/env bun

/**
 * DevTools UI Server
 *
 * Serves both the API endpoints and static files for the DevTools UI.
 * In development: Only serves API (Vite runs UI on 3002)
 * In production: Serves both API and static files from dist/
 */

import { join, extname } from 'path'
import { readdir, readFile, stat } from 'fs/promises'
import { watcherState, onStateChange, triggerRule } from '../watch/index'
import { parseLcov, generateHtml } from './lcov-to-html'
import { logger } from '../logger'
import type { LogEntry } from '../logger'
import { listKeys, createKey, updateKey, revokeKey } from '../api-keys'

// Server event tracking
interface ServerEvent {
  id: string
  timestamp: number
  type: 'connection' | 'disconnection' | 'message' | 'error'
  endpoint: string
  clientCount?: number
  payload?: unknown
  message?: string
}

let eventIdCounter = 0
const eventBuffer: ServerEvent[] = []
const MAX_EVENT_BUFFER = 500

function trackEvent(event: Omit<ServerEvent, 'id' | 'timestamp'>): void {
  const fullEvent: ServerEvent = {
    ...event,
    id: `evt-${++eventIdCounter}`,
    timestamp: Date.now(),
  }

  eventBuffer.push(fullEvent)
  if (eventBuffer.length > MAX_EVENT_BUFFER) {
    eventBuffer.shift()
  }

  // Broadcast to debug clients
  const message = `event: event\ndata: ${JSON.stringify(fullEvent)}\n\n`
  for (const controller of debugClients) {
    try {
      controller.enqueue(message)
    } catch {
      debugClients.delete(controller)
    }
  }
}

const PORT = 3001
const isDev = process.env.NODE_ENV !== 'production'
const distDir = join(import.meta.dir, 'dist')
const projectRoot = join(import.meta.dir, '../..')
const STORAGE_DIR = join(projectRoot, '.devtools')

// SSE clients
const sseClients = new Set<ReadableStreamDefaultController>()
const logClients = new Set<ReadableStreamDefaultController>()
const debugClients = new Set<ReadableStreamDefaultController>()

// Broadcast state changes to all SSE clients
onStateChange((state) => {
  const message = JSON.stringify({
    rules: state.rules,
    executions: state.executions,
    currentlyRunning: Array.from(state.currentlyRunning),
  })

  for (const controller of sseClients) {
    try {
      controller.enqueue(`data: ${message}\n\n`)
    } catch (error) {
      // Client disconnected, remove from set
      sseClients.delete(controller)
    }
  }
})

// Broadcast logs to all log clients
logger.subscribe((entry: LogEntry) => {
  const message = `event: log\ndata: ${JSON.stringify(entry)}\n\n`

  for (const controller of logClients) {
    try {
      controller.enqueue(message)
    } catch (error) {
      // Client disconnected, remove from set
      logClients.delete(controller)
    }
  }
})

// MIME types for static files
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown',
}

/**
 * Recursively find all .spec.md files
 */
async function findSpecFiles(dir: string, depth = 0): Promise<string[]> {
  if (depth > 10) return []

  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // Skip ignored directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'coverage') {
          continue
        }
        const subFiles = await findSpecFiles(fullPath, depth + 1)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.spec.md')) {
        files.push(fullPath)
      }
    }

    return files
  } catch {
    return []
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS headers for development
    const corsHeaders = isDev
      ? {
        'Access-Control-Allow-Origin': 'http://localhost:3002',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
      : {}

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      // GET /api/watcher/status
      if (url.pathname === '/api/watcher/status' && req.method === 'GET') {
        return Response.json(
          {
            rules: watcherState.rules,
            executions: watcherState.executions,
            currentlyRunning: Array.from(watcherState.currentlyRunning),
          },
          { headers: corsHeaders }
        )
      }

      // GET /api/watcher/history
      if (url.pathname === '/api/watcher/history' && req.method === 'GET') {
        return Response.json(
          {
            executions: watcherState.executions.slice(-50),
          },
          { headers: corsHeaders }
        )
      }

      // POST /api/watcher/trigger/:ruleName
      if (url.pathname.startsWith('/api/watcher/trigger/') && req.method === 'POST') {
        const ruleName = url.pathname.split('/').pop()
        if (!ruleName) {
          return Response.json({ error: 'Rule name required' }, { status: 400, headers: corsHeaders })
        }

        try {
          await triggerRule(ruleName)
          return Response.json({ success: true }, { headers: corsHeaders })
        } catch (error) {
          return Response.json(
            { error: String(error) },
            { status: 404, headers: corsHeaders }
          )
        }
      }

      // GET /api/watcher/events (SSE)
      if (url.pathname === '/api/watcher/events' && req.method === 'GET') {
        const stream = new ReadableStream({
          start(controller) {
            // Add client to set
            sseClients.add(controller)

            // Track connection
            trackEvent({
              type: 'connection',
              endpoint: '/api/watcher/events',
              clientCount: sseClients.size,
              message: 'Client connected to watcher events',
            })

            // Send initial state
            controller.enqueue(
              `data: ${JSON.stringify({
                rules: watcherState.rules,
                executions: watcherState.executions,
                currentlyRunning: Array.from(watcherState.currentlyRunning),
              })}\n\n`
            )

            // Send keepalive every 30 seconds
            const keepalive = setInterval(() => {
              try {
                controller.enqueue(': keepalive\n\n')
              } catch {
                clearInterval(keepalive)
                sseClients.delete(controller)
              }
            }, 30000)
          },
          cancel(controller) {
            sseClients.delete(controller)

            // Track disconnection
            trackEvent({
              type: 'disconnection',
              endpoint: '/api/watcher/events',
              clientCount: sseClients.size,
              message: 'Client disconnected from watcher events',
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...corsHeaders,
          },
        })
      }

      // GET /api/specs/combined - Get the combined test specification file
      if (url.pathname === '/api/specs/combined' && req.method === 'GET') {
        try {
          const specPath = join(projectRoot, 'TEST_SPECIFICATIONS.md')
          const content = await readFile(specPath, 'utf-8')
          const stats = await stat(specPath)

          return new Response(content, {
            headers: {
              'Content-Type': 'text/markdown',
              'X-Last-Modified': stats.mtimeMs.toString(),
              ...corsHeaders,
            },
          })
        } catch (error) {
          return Response.json({ error: 'Specification file not found' }, { status: 404, headers: corsHeaders })
        }
      }

      // GET /api/specs/results - Get test results
      if (url.pathname === '/api/specs/results' && req.method === 'GET') {
        try {
          const resultsPath = join(STORAGE_DIR, 'test-results.json')
          const content = await readFile(resultsPath, 'utf-8')
          const results = JSON.parse(content)

          return Response.json(results, { headers: corsHeaders })
        } catch (error) {
          // Test results not available yet
          return Response.json(
            { error: 'Test results not available. Run tests to generate results.' },
            { status: 404, headers: corsHeaders }
          )
        }
      }

      // GET /api/coverage - Get the HTML coverage report
      if (url.pathname === '/api/coverage' && req.method === 'GET') {
        try {
          const lcovPath = join(projectRoot, 'coverage/lcov.info')
          const lcovContent = await readFile(lcovPath, 'utf-8')
          const stats = await stat(lcovPath)

          // Parse LCOV and generate HTML
          const files = parseLcov(lcovContent)
          const html = generateHtml(files)

          return new Response(html, {
            headers: {
              'Content-Type': 'text/html',
              'X-Last-Modified': stats.mtimeMs.toString(),
              ...corsHeaders,
            },
          })
        } catch (error) {
          return Response.json(
            { error: 'Coverage report not found. Run "bun test --coverage" to generate it.' },
            { status: 404, headers: corsHeaders }
          )
        }
      }

      // POST /api/coverage/generate - Generate coverage report
      if (url.pathname === '/api/coverage/generate' && req.method === 'POST') {
        try {
          // Run tests with coverage
          const proc = Bun.spawn(['bun', 'test', '--coverage'], {
            cwd: projectRoot,
            stdout: 'inherit', // Inherit stdout/stderr so we can see test output
            stderr: 'inherit',
          })

          // Wait for process to complete
          const exitCode = await proc.exited

          // Coverage is generated even if tests fail, so always return success
          // Just include a note if tests failed
          if (exitCode === 0) {
            return Response.json({ success: true, message: 'Coverage report generated - all tests passed' }, { headers: corsHeaders })
          } else {
            return Response.json(
              { success: true, message: `Coverage generated but ${exitCode} tests failed`, testsFailedCount: exitCode },
              { headers: corsHeaders }
            )
          }
        } catch (error) {
          return Response.json(
            { success: false, error: String(error) },
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // GET /api/logs/stream (SSE)
      if (url.pathname === '/api/logs/stream' && req.method === 'GET') {
        const stream = new ReadableStream({
          start(controller) {
            // Add client to set
            logClients.add(controller)

            // Track connection
            trackEvent({
              type: 'connection',
              endpoint: '/api/logs/stream',
              clientCount: logClients.size,
              message: 'Client connected to log stream',
            })

            // Send buffered logs first
            const buffer = logger.getBuffer()
            controller.enqueue(
              `event: buffer\ndata: ${JSON.stringify(buffer)}\n\n`
            )

            // Send keepalive every 30 seconds
            const keepalive = setInterval(() => {
              try {
                controller.enqueue(': keepalive\n\n')
              } catch {
                clearInterval(keepalive)
                logClients.delete(controller)
              }
            }, 30000)
          },
          cancel(controller) {
            logClients.delete(controller)

            // Track disconnection
            trackEvent({
              type: 'disconnection',
              endpoint: '/api/logs/stream',
              clientCount: logClients.size,
              message: 'Client disconnected from log stream',
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...corsHeaders,
          },
        })
      }

      // GET /api/debug/events (SSE)
      if (url.pathname === '/api/debug/events' && req.method === 'GET') {
        const stream = new ReadableStream({
          start(controller) {
            // Add client to set
            debugClients.add(controller)

            // Track connection
            trackEvent({
              type: 'connection',
              endpoint: '/api/debug/events',
              clientCount: debugClients.size,
              message: 'Client connected to debug events',
            })

            // Send buffered events first
            controller.enqueue(
              `event: buffer\ndata: ${JSON.stringify(eventBuffer)}\n\n`
            )

            // Send keepalive every 30 seconds
            const keepalive = setInterval(() => {
              try {
                controller.enqueue(': keepalive\n\n')
              } catch {
                clearInterval(keepalive)
                debugClients.delete(controller)
              }
            }, 30000)
          },
          cancel(controller) {
            debugClients.delete(controller)

            // Track disconnection
            trackEvent({
              type: 'disconnection',
              endpoint: '/api/debug/events',
              clientCount: debugClients.size,
              message: 'Client disconnected from debug events',
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...corsHeaders,
          },
        })
      }

      // GET /api/keys - List all API keys
      if (url.pathname === '/api/keys' && req.method === 'GET') {
        try {
          const keys = await listKeys()
          return Response.json(keys, { headers: corsHeaders })
        } catch (error) {
          return Response.json(
            { error: String(error) },
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // POST /api/keys - Create a new API key
      if (url.pathname === '/api/keys' && req.method === 'POST') {
        try {
          const body = await req.json()
          const { name, permissions } = body

          if (!name || typeof name !== 'string') {
            return Response.json(
              { error: 'Name is required' },
              { status: 400, headers: corsHeaders }
            )
          }

          const key = await createKey(name, permissions || [])
          logger.info('api-keys', `API key created: ${name}`)

          return Response.json(key, { headers: corsHeaders })
        } catch (error) {
          return Response.json(
            { error: String(error) },
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // PUT /api/keys/:id - Update an API key
      if (url.pathname.startsWith('/api/keys/') && req.method === 'PUT') {
        const id = url.pathname.split('/').pop()
        if (!id) {
          return Response.json({ error: 'Key ID required' }, { status: 400, headers: corsHeaders })
        }

        try {
          const body = await req.json()
          const { name, permissions } = body

          await updateKey(id, { name, permissions })
          logger.info('api-keys', `API key updated: ${id}`)

          return Response.json({ success: true }, { headers: corsHeaders })
        } catch (error) {
          return Response.json(
            { error: String(error) },
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // DELETE /api/keys/:id - Revoke an API key
      if (url.pathname.startsWith('/api/keys/') && req.method === 'DELETE') {
        const id = url.pathname.split('/').pop()
        if (!id) {
          return Response.json({ error: 'Key ID required' }, { status: 400, headers: corsHeaders })
        }

        try {
          await revokeKey(id)
          logger.info('api-keys', `API key revoked: ${id}`)

          return Response.json({ success: true }, { headers: corsHeaders })
        } catch (error) {
          return Response.json(
            { error: String(error) },
            { status: 500, headers: corsHeaders }
          )
        }
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
    }

    // In development, API only (Vite serves UI)
    if (isDev) {
      return new Response('DevTools API server running. Open http://localhost:3002 for UI.', {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // In production, serve static files from dist/
    try {
      let filePath = url.pathname === '/' ? '/index.html' : url.pathname

      const file = Bun.file(join(distDir, filePath))

      if (await file.exists()) {
        const ext = extname(filePath)
        const contentType = mimeTypes[ext] || 'application/octet-stream'

        return new Response(file, {
          headers: { 'Content-Type': contentType },
        })
      }

      // SPA fallback - serve index.html for non-API routes
      const indexFile = Bun.file(join(distDir, 'index.html'))
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      return new Response('Not found', { status: 404 })
    } catch (error) {
      return new Response(`Server error: ${error}`, { status: 500 })
    }
  },
})

console.log(`🚀 DevTools UI Server running on http://localhost:${PORT}`)
if (isDev) {
  console.log('📝 Development mode: API only. Open http://localhost:3002 for UI.')
} else {
  console.log('🌐 Production mode: Serving API and static files')
}

// Log server startup
logger.info('devtools-server', `Server started on port ${PORT}`)
logger.debug('devtools-server', `Mode: ${isDev ? 'development' : 'production'}`)
