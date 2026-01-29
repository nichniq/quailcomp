# Authentication Service

User authentication with JWT tokens and password hashing.

## Files

- [`service.ts`](service.ts) - Core authentication logic (register, login, verify)
- [`jwt.ts`](jwt.ts) - JWT token generation and validation
- [`password.ts`](password.ts) - Password hashing with bcrypt
- [`middleware.ts`](middleware.ts) - Authentication middleware for protected routes
- [`routes.ts`](routes.ts) - HTTP endpoints for auth operations
- [`types.ts`](types.ts) - Type definitions for auth domain
- [`index.ts`](index.ts) - Public API exports

## API Endpoints

```
POST /auth/register  - Create new user account
POST /auth/login     - Authenticate and receive JWT
GET  /auth/verify    - Verify JWT token validity
POST /auth/logout    - Invalidate session (optional)
```

## Usage

```typescript
import { authService, requireAuth } from './auth'

// In routes
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  const token = await authService.login(email, password)
  res.json({ token })
})

// Protect routes
router.get('/protected', requireAuth, async (req, res) => {
  // req.user contains authenticated user
})
```

## Security

- Passwords hashed with bcrypt (cost factor: 10)
- JWTs signed with HS256 algorithm
- Tokens expire after configurable duration
- Middleware validates tokens on protected routes

## Documentation

- [Authentication Domain](../../../../domains/authentication.md)
- [API Reference](../../../docs/reference/api.md)
