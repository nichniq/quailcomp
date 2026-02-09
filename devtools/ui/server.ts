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

const PORT = 3001
const isDev = process.env.NODE_ENV !== 'production'
const distDir = join(import.meta.dir, 'dist')
const projectRoot = join(import.meta.dir, '../..')

// SSE clients
const sseClients = new Set<ReadableStreamDefaultController>()

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

      // GET /api/coverage - Get the HTML coverage report
      if (url.pathname === '/api/coverage' && req.method === 'GET') {
        try {
          const coveragePath = join(projectRoot, 'coverage/index.html')
          const content = await readFile(coveragePath, 'utf-8')
          const stats = await stat(coveragePath)

          return new Response(content, {
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
          // Run tests with coverage in the background
          const proc = Bun.spawn(['bun', 'test', '--coverage'], {
            cwd: projectRoot,
            stdout: 'pipe',
            stderr: 'pipe',
          })

          // Wait for process to complete
          const exitCode = await proc.exited

          if (exitCode === 0) {
            return Response.json({ success: true, message: 'Coverage report generated' }, { headers: corsHeaders })
          } else {
            const stderr = await new Response(proc.stderr).text()
            return Response.json(
              { success: false, error: 'Tests failed', stderr },
              { status: 500, headers: corsHeaders }
            )
          }
        } catch (error) {
          return Response.json(
            { success: false, error: String(error) },
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
