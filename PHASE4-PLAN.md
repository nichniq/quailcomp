<!-- markdownlint-disable -->

# Phase 4: Production Readiness - Docker-Free Deployment

**Created**: 2025-02-01
**Goal**: Make Quailcomp production-ready with systemd deployment, observability, security hardening, and comprehensive documentation
**Estimated Effort**: 22-28 hours (3-4 weeks at part-time pace)

---

## Context Summary

The Quailcomp application is built on Bun runtime and designed for direct server deployment without Docker. Phase 4 replaces Docker containerization with systemd service management while adding essential production infrastructure.

**Current Architecture:**
- **Runtime**: Bun 1.3.6 (self-contained, no Node.js needed)
- **Server**: `server/src/index.ts` using Bun.serve()
- **Database**: PostgreSQL 16 with role-based permissions
- **Frontend**: Vue 3 (builds to static files in `frontend/dist/`)
- **No build step** for server (TypeScript runs directly)

**What Already Exists:**
- Health endpoint at `/health`
- Basic JSON logging to console
- In-memory metrics collector
- Environment validation with Zod
- Rate limiting (Phase 1)
- Authorization middleware (Phase 1)

**What Phase 4 Adds:**
- Systemd service management with graceful shutdown
- Production-grade observability (pino, Prometheus, Sentry)
- Complete deployment documentation
- OpenAPI specification + Swagger UI
- Security hardening (headers, password validation, HTTPS)

---

## 4.1: Systemd Service & Process Management

**Goal**: Replace Docker with systemd for professional Linux server deployment

### Files to Create

1. **`deployment/systemd/quailcomp.service`** (40 lines)
   - Systemd unit file for server process
   - Auto-restart on failure
   - Resource limits
   - Security hardening (NoNewPrivileges, PrivateTmp)
   - Depends on PostgreSQL

2. **`deployment/systemd/logrotate.conf`** (15 lines)
   - Daily log rotation
   - 14 day retention
   - Compression enabled

3. **`deployment/install.sh`** (100 lines)
   - Create service user (quailcomp)
   - Install to `/opt/quailcomp`
   - Install dependencies with Bun
   - Build frontend
   - Install systemd service
   - Setup log directory

4. **`deployment/README.md`** (150 lines)
   - Installation instructions
   - Systemd management commands
   - Log access procedures
   - Troubleshooting guide

### Files to Modify

5. **`server/src/index.ts`** - Add graceful shutdown
   ```typescript
   // Add signal handlers for SIGTERM/SIGINT
   // Stop accepting new connections
   // Wait for in-flight requests (max 10s)
   // Handle uncaught errors gracefully
   ```

6. **`server/src/server.ts`** - Add static file serving
   ```typescript
   // Serve frontend/dist/ in production
   // Implement SPA fallback (serve index.html for all routes)
   // Only for non-/api/ paths
   ```

### Implementation Steps

1. Create systemd service file (30 min)
2. Add graceful shutdown to index.ts (30 min)
3. Add static file serving to server.ts (45 min)
4. Create installation script (1 hour)
5. Write deployment README (1 hour)
6. Test locally with systemd (1 hour)

### Testing

```bash
# Test graceful shutdown
bun run dev:server
pkill -TERM -f "bun.*server/src/index.ts"
# Should log "SIGTERM received, shutting down gracefully..."

# Test static file serving
bun run build:frontend
NODE_ENV=production bun run dev:server
curl http://localhost:3000/  # Should serve index.html
```

### Success Criteria

- [ ] Server handles SIGTERM/SIGINT gracefully
- [ ] In-flight requests complete before shutdown
- [ ] Static files served in production mode
- [ ] SPA routing works (all paths serve index.html)
- [ ] Systemd service starts automatically
- [ ] Service auto-restarts on failure
- [ ] Logs rotated daily

### Time Estimate: 4-6 hours

---

## 4.2: Enhanced Observability Stack

**Goal**: Production-ready logging, metrics, and error tracking

### Files to Create

1. **`server/src/logging/pino-logger.ts`** (120 lines)
   - Pino logger adapter
   - Pretty printing in development
   - JSON logging in production
   - Redaction of sensitive fields (password, token)
   - Request ID support

2. **`server/src/metrics/prometheus.ts`** (180 lines)
   - Convert in-memory metrics to Prometheus text format
   - Export counters with labels
   - Export histograms with buckets
   - Handler for `/metrics` endpoint

3. **`server/src/observability/sentry.ts`** (100 lines)
   - Sentry initialization
   - Error capture with context
   - Breadcrumb support
   - Sample rate configuration
   - Only enabled in production

4. **`server/src/middleware/request-id.ts`** (40 lines)
   - Generate or extract X-Request-Id
   - Echo in response headers
   - Useful for distributed tracing

### Files to Modify

5. **`server/src/config.ts`** - Add observability config
   ```typescript
   SENTRY_DSN: z.string().url().optional()
   SENTRY_ENABLED: z.coerce.boolean().default(false)
   PROMETHEUS_ENABLED: z.coerce.boolean().default(true)
   ```

6. **`server/src/index.ts`** - Initialize Sentry
   ```typescript
   import { initSentry } from '@/observability/sentry';
   initSentry();  // Before createServer()
   ```

7. **`server/src/middleware/error-handler.ts`** - Capture errors
   ```typescript
   import { captureError } from '@/observability/sentry';
   // After logging unexpected errors, send to Sentry
   ```

8. **`server/src/routes/health.ts`** - Use Prometheus handler
   ```typescript
   export const metricsHandler = prometheusMetricsHandler;
   ```

9. **`server/package.json`** - Add dependencies
   ```json
   "pino": "^9.0.0",
   "pino-pretty": "^11.0.0",
   "@sentry/bun": "^8.0.0"
   ```

### Implementation Steps

1. Install pino dependencies (5 min)
2. Create pino logger adapter (30 min)
3. Implement Prometheus exporter (1 hour)
4. Integrate Sentry (1 hour)
5. Add request ID middleware (30 min)
6. Update error handler (30 min)
7. Test all observability features (45 min)

### Testing

```bash
# Test pino logging
bun run dev:server
# Should see pretty-printed logs

NODE_ENV=production bun run dev:server
# Should see JSON logs

# Test Prometheus metrics
curl http://localhost:3000/metrics
# Should return Prometheus text format

# Test request ID
curl -H "X-Request-Id: test-123" http://localhost:3000/health
# Response should include: x-request-id: test-123
```

### Success Criteria

- [ ] Pino logs prettified in development
- [ ] Pino logs as JSON in production
- [ ] Sensitive fields redacted from logs
- [ ] /metrics returns Prometheus text format
- [ ] Counters and histograms exported correctly
- [ ] Request IDs echoed in headers
- [ ] Sentry captures unhandled errors
- [ ] Sentry receives error context

### Time Estimate: 4-5 hours

---

## 4.3: Production Deployment Documentation

**Goal**: Complete guide for VPS/dedicated server deployment

### Files to Create

1. **`docs/how-to/deploy-production.md`** (400 lines)
   - Server prerequisites (Ubuntu 22.04/24.04)
   - Installing Bun and PostgreSQL 16
   - Database setup and user creation
   - Application installation with install.sh
   - Nginx reverse proxy configuration
   - SSL with Let's Encrypt (certbot)
   - Systemd service management
   - Monitoring and log management
   - Environment variable configuration
   - Troubleshooting guide

2. **`deployment/nginx/quailcomp.conf`** (50 lines)
   - HTTP to HTTPS redirect
   - SSL certificate configuration
   - Reverse proxy to Bun server (port 3000)
   - Security headers
   - Health check endpoint (no logs)
   - Proxy timeouts (60s)

3. **`deployment/backup.sh`** (80 lines)
   - PostgreSQL backup with pg_dump
   - Gzip compression
   - 30 day retention
   - Timestamp-based filenames
   - Cleanup of old backups

4. **`deployment/healthcheck.sh`** (40 lines)
   - Curl /health endpoint
   - 5 second timeout
   - Exit 0 if healthy, 1 if unhealthy
   - For cron monitoring

5. **`docs/how-to/backup-restore-production.md`** (200 lines)
   - Automated backup setup
   - Cron job configuration
   - Restoration procedures
   - Point-in-time recovery
   - Backup verification steps
   - Off-site backup strategies (rsync, S3)

### Implementation Steps

1. Write deployment documentation (2 hours)
   - Prerequisites section
   - Step-by-step installation
   - Configuration examples
   - Common issues

2. Create Nginx configuration (45 min)
   - Reverse proxy setup
   - SSL configuration
   - Security headers

3. Create operational scripts (1 hour)
   - Backup script with retention
   - Health check script
   - Make executable

4. Document backup procedures (1 hour)
   - Automated backup setup
   - Restoration guide
   - Verification steps

5. Create monitoring guide (45 min)
   - Systemd journal commands
   - Prometheus scraping
   - Alert configuration

### Testing

```bash
# Test backup script
sudo -u quailcomp ./deployment/backup.sh
ls -lh /var/backups/quailcomp/

# Test health check
./deployment/healthcheck.sh

# Test Nginx configuration
sudo nginx -t

# Test SSL renewal (dry run)
sudo certbot renew --dry-run
```

### Success Criteria

- [ ] Complete deployment documentation exists
- [ ] Nginx configuration works with SSL
- [ ] Backup script creates valid .sql.gz files
- [ ] Health check script returns correct exit codes
- [ ] Restoration procedure documented and tested
- [ ] All scripts have proper error handling

### Time Estimate: 5-6 hours

---

## 4.4: OpenAPI Specification

**Goal**: Auto-generated API documentation with Swagger UI

### Files to Create

1. **`server/src/openapi/spec.ts`** (300 lines)
   - OpenAPI 3.0 specification generator
   - Document all endpoints:
     - `/health` - Health check
     - `/auth/register` - User registration
     - `/auth/login` - User login
     - `/books/*` - Book CRUD operations
     - `/entities/:id/access` - Access management
   - Request/response schemas
   - Security schemes (Bearer JWT)

2. **`server/src/routes/api-docs.ts`** (60 lines)
   - Handler for `/api/openapi.json` (JSON spec)
   - Handler for `/api/docs` (Swagger UI HTML)
   - Load Swagger UI from CDN
   - Point to local OpenAPI spec

### Files to Modify

3. **`server/src/server.ts`** - Register API docs routes
   ```typescript
   import { createOpenAPIHandler, swaggerUIHandler } from '@/routes/api-docs';

   router.get('/api/docs', swaggerUIHandler);
   router.get('/api/openapi.json', createOpenAPIHandler(router));
   ```

### Implementation Steps

1. Create OpenAPI spec generator (2 hours)
   - Define spec structure
   - Document health endpoint
   - Document auth endpoints
   - Add schemas

2. Create Swagger UI handler (30 min)
   - Serve HTML page
   - Load from CDN
   - Point to /api/openapi.json

3. Document book routes (1 hour)
   - GET /books (list)
   - GET /books/:id (get one)
   - POST /books (create)
   - PUT /books/:id (update)
   - DELETE /books/:id (delete)

4. Document authz routes (1 hour)
   - POST /entities/:id/access (grant)
   - DELETE /entities/:id/access/:userId (revoke)
   - GET /entities/:id/access (list)
   - POST /entities/:id/transfer (ownership)

5. Add examples (1 hour)
   - Request examples for all endpoints
   - Response examples (success + errors)
   - Authentication examples

### Testing

```bash
# Start server
bun run dev:server

# View Swagger UI
open http://localhost:3000/api/docs

# Get OpenAPI spec
curl http://localhost:3000/api/openapi.json | jq

# Validate spec (optional)
npx @apidevtools/swagger-cli validate http://localhost:3000/api/openapi.json
```

### Success Criteria

- [ ] OpenAPI spec is valid
- [ ] Swagger UI loads correctly
- [ ] All endpoints documented
- [ ] Request/response schemas defined
- [ ] Security schemes configured (Bearer JWT)
- [ ] Examples provided for common operations
- [ ] Error responses documented

### Time Estimate: 5-6 hours

---

## 4.5: Security Hardening

**Goal**: Implement production security best practices

### Files to Create

1. **`server/src/middleware/security-headers.ts`** (80 lines)
   - X-Frame-Options: SAMEORIGIN
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin
   - Content-Security-Policy (CSP)
   - Strict-Transport-Security (HSTS in production)
   - Permissions-Policy

2. **`server/src/auth/password-validator.ts`** (120 lines)
   - Minimum length check (12 chars)
   - Complexity requirements:
     - Lowercase letter
     - Uppercase letter
     - Number
     - Special character
   - Common password detection
   - Entropy calculation
   - Strength rating (weak/medium/strong)
   - Detailed error feedback

3. **`server/src/middleware/https-redirect.ts`** (30 lines)
   - Redirect HTTP to HTTPS in production
   - 301 permanent redirect
   - Skip in development

### Files to Modify

4. **`server/src/auth/password.ts`** - Use enhanced validation
   ```typescript
   import { validatePasswordStrength } from './password-validator';

   export function validatePassword(password: string): string | null {
     const result = validatePasswordStrength(password);
     return result.valid ? null : result.errors[0];
   }
   ```

5. **`server/src/middleware/cors.ts`** - Environment-specific CORS
   ```typescript
   import { env, isProduction } from '@/config';

   const allowedOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim());

   // Only allow configured origins in production
   const isAllowed = !isProduction || allowedOrigins.includes(origin || '');
   ```

6. **`server/src/server.ts`** - Add security middleware
   ```typescript
   import { securityHeaders } from '@/middleware/security-headers';
   import { httpsRedirect } from '@/middleware/https-redirect';

   const globalMiddleware = compose(
     errorHandler,
     httpsRedirect,        // NEW
     securityHeaders,      // NEW
     requestLogger,
     requestMetrics,
     corsMiddleware        // UPDATED
   );
   ```

7. **`server/src/config.ts`** - Add security config
   ```typescript
   PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(12)
   PASSWORD_REQUIRE_COMPLEXITY: z.coerce.boolean().default(true)
   HTTPS_REDIRECT: z.coerce.boolean().default(true)
   ```

### Implementation Steps

1. Create security headers middleware (45 min)
   - Add all security headers
   - Configure CSP policy
   - Add HSTS for production only

2. Implement password validator (1.5 hours)
   - Create validation function
   - Add common password list
   - Calculate entropy
   - Provide detailed feedback

3. Update CORS middleware (45 min)
   - Environment-specific origins
   - Proper preflight handling
   - Credentials support

4. Add HTTPS redirect (30 min)
   - Production-only redirect
   - Preserve query parameters
   - 301 permanent

5. Write security tests (1 hour)
   - Test security headers present
   - Test password validation rules
   - Test CORS behavior
   - Test HTTPS redirect

### Testing

```bash
# Test security headers
curl -I http://localhost:3000/health
# Should include: X-Frame-Options, X-Content-Type-Options, CSP, etc.

# Test password validation
bun test server/src/auth/password-validator.test.ts

# Test CORS
curl -H "Origin: http://localhost:5173" http://localhost:3000/health
# Should include CORS headers in development

# Test HTTPS redirect (production)
NODE_ENV=production bun run dev:server
curl -I http://localhost:3000/health
# Should redirect to https://
```

### Success Criteria

- [ ] All security headers present in responses
- [ ] CSP policy configured (allows only required resources)
- [ ] HSTS enabled in production (1 year max-age)
- [ ] Passwords require 12+ chars
- [ ] Passwords require complexity (upper/lower/number/special)
- [ ] Common passwords rejected
- [ ] CORS allows only configured origins
- [ ] HTTPS redirect works in production
- [ ] All security tests passing

### Time Estimate: 4-5 hours

---

## Phase 4 Complete - Verification

After implementing all sections, verify the complete Phase 4:

### Final Testing Checklist

```bash
# 1. Build and install
bun run build
sudo ./deployment/install.sh

# 2. Start service
sudo systemctl start quailcomp
sudo systemctl status quailcomp

# 3. Health check
curl http://localhost:3000/health

# 4. Metrics
curl http://localhost:3000/metrics

# 5. API docs
open http://localhost:3000/api/docs

# 6. Security headers
curl -I http://localhost:3000/health | grep -E "X-|Content-Security|Strict-Transport"

# 7. Graceful shutdown
sudo systemctl stop quailcomp
sudo journalctl -u quailcomp -n 20
# Should show "shutting down gracefully"

# 8. All tests pass
bun test

# 9. Backup
sudo -u quailcomp ./deployment/backup.sh
ls -lh /var/backups/quailcomp/

# 10. Logs
sudo journalctl -u quailcomp -f
```

### Documentation Updates

After Phase 4 completion, update:

- [ ] `docs/how-to/README.md` - Add deployment guide link
- [ ] `.env.example` - Add all new environment variables
- [ ] `docs/reference/environment-variables.md` - Document new vars
- [ ] `ROADMAP.md` - Mark Phase 4 complete
- [ ] `deployment/README.md` - Ensure complete

### Critical Files Reference

The 5 most important files for Phase 4:

1. **`server/src/server.ts`** (line 1-200)
   - Central integration point
   - Middleware stack configuration
   - Static file serving
   - Route registration

2. **`server/src/index.ts`** (line 1-50)
   - Server entry point
   - Graceful shutdown
   - Sentry initialization
   - Process error handling

3. **`server/src/config.ts`** (line 1-100)
   - Environment validation
   - Type-safe configuration
   - Pattern for new env vars

4. **`server/src/middleware/error-handler.ts`** (line 1-80)
   - Global error handling
   - Sentry integration point
   - Middleware pattern example

5. **`server/src/metrics/collector.ts`** (line 1-150)
   - In-memory metrics
   - Prometheus export base
   - Metrics pattern reference

---

## Summary

**Phase 4 Total Time**: 22-28 hours

**Deliverables**:
1. ✅ Systemd service with graceful shutdown
2. ✅ Enhanced observability (pino + Prometheus + Sentry)
3. ✅ Complete deployment documentation
4. ✅ OpenAPI specification + Swagger UI
5. ✅ Security hardening (headers, passwords, CORS)

**Production Ready After Phase 4**:
- Professional systemd deployment
- Production-grade logging and monitoring
- Complete deployment documentation
- Interactive API documentation
- Security best practices implemented
- No Docker required

**Next Steps After Phase 4**:
- Phase 5: Advanced features (domains, search, bulk ops)
- Optional: Add Docker support if deployment needs change
- Continue with PLAN.md roadmap
