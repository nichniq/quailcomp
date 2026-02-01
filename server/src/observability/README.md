# Observability

Error tracking and monitoring integrations.

## Files

- `sentry.ts` - Sentry error tracking integration with breadcrumbs, context, and user tracking

## Usage

Sentry is initialized automatically at application startup in [index.ts](../../index.ts:9).

### Capturing Errors

```typescript
import { captureError } from "@/observability/sentry";

try {
  // ... code that might fail
} catch (error) {
  captureError(error, {
    tags: { feature: "authentication" },
    extra: { userId: user.id },
  });
}
```

### Adding Breadcrumbs

```typescript
import { addBreadcrumb } from "@/observability/sentry";

addBreadcrumb("User logged in", { userId: user.id }, "auth");
```

### Configuration

Sentry requires environment variables:

- `SENTRY_DSN` - Sentry project DSN
- `SENTRY_ENABLED` - Enable/disable Sentry (default: false)

See [Environment Variables](../../../docs/reference/environment-variables.md) for details.
