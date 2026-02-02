# WebSocket Server

Real-time updates for entity changes via WebSocket connections.

## Overview

The WebSocket server provides real-time notifications when entities are created, updated, or deleted. Clients can subscribe to specific entities and receive updates only for entities they have permission to access.

## Architecture

### Connection Flow

1. Client connects to `/ws` endpoint
2. Server sends `auth_required` message
3. Client sends `authenticate` message with JWT token
4. Server verifies token and marks connection as authenticated
5. Client can now subscribe to entities

### Authorization

- All subscriptions require authentication
- Subscription requests check read access via `AuthorizationService`
- Only clients with read access can subscribe to an entity
- Authorization is checked at subscription time (not broadcast time)

### Broadcasting

When an entity is modified via HTTP API:

1. Route handler updates the entity in database
2. Route handler calls `broadcastUpdate()` with entity details
3. Broadcast function finds all authenticated clients subscribed to that entity
4. Update message is sent to each subscribed client

## Files

- `server.ts` - WebSocket handler, connection management, and broadcasting

## Message Types

### Client → Server

#### authenticate

```json
{
  "type": "authenticate",
  "token": "jwt-token-string"
}
```

Authenticates the WebSocket connection with a JWT token.

**Response:** `authenticated` or `error` (with connection close)

#### subscribe

```json
{
  "type": "subscribe",
  "entityId": 123
}
```

Subscribes to updates for a specific entity.

**Requirements:**

- Connection must be authenticated
- User must have read access to the entity

**Response:** `subscribed` or `error`

#### unsubscribe

```json
{
  "type": "unsubscribe",
  "entityId": 123
}
```

Unsubscribes from updates for a specific entity.

**Response:** `unsubscribed`

#### ping

```json
{
  "type": "ping"
}
```

Keep-alive ping message.

**Response:** `pong`

### Server → Client

#### auth_required

```json
{
  "type": "auth_required",
  "message": "Please authenticate by sending your JWT token"
}
```

Sent immediately after connection is established.

#### authenticated

```json
{
  "type": "authenticated",
  "message": "Authentication successful"
}
```

Sent after successful authentication.

#### subscribed

```json
{
  "type": "subscribed",
  "entityId": 123
}
```

Confirms subscription to an entity.

#### unsubscribed

```json
{
  "type": "unsubscribed",
  "entityId": 123
}
```

Confirms unsubscription from an entity.

#### entity.created

```json
{
  "type": "entity.created",
  "entityId": 123,
  "entityType": "book",
  "data": { /* full entity data */ },
  "timestamp": "2026-02-02T10:30:00.000Z"
}
```

Sent when a subscribed entity is created.

#### entity.updated

```json
{
  "type": "entity.updated",
  "entityId": 123,
  "entityType": "book",
  "data": { /* updated entity data */ },
  "timestamp": "2026-02-02T10:30:00.000Z"
}
```

Sent when a subscribed entity is updated.

#### entity.deleted

```json
{
  "type": "entity.deleted",
  "entityId": 123,
  "entityType": "book",
  "timestamp": "2026-02-02T10:30:00.000Z"
}
```

Sent when a subscribed entity is deleted.

#### pong

```json
{
  "type": "pong"
}
```

Response to ping message.

#### error

```json
{
  "type": "error",
  "message": "Error description"
}
```

Sent when an error occurs processing a client message.

## Usage in Routes

To broadcast updates from route handlers:

```typescript
import { broadcastUpdate } from "@/websocket/server";

// After creating an entity
const entry = await entities.create({ type: 'book', data: bookData });
broadcastUpdate({
  type: "entity.created",
  entityId: entry.entityId,
  entityType: 'book',
  data: entry,
  timestamp: new Date().toISOString(),
});

// After updating an entity
const updated = await entities.update({ entityId, type: 'book', data: newData });
broadcastUpdate({
  type: "entity.updated",
  entityId: updated.entityId,
  entityType: 'book',
  data: updated,
  timestamp: new Date().toISOString(),
});

// After deleting an entity
const deleted = await entities.delete({ entityId, type: 'book', data: oldData });
broadcastUpdate({
  type: "entity.deleted",
  entityId: deleted.entityId,
  entityType: 'book',
  timestamp: new Date().toISOString(),
});
```

## Testing

See [../../tests/websocket.test.ts](../../tests/websocket.test.ts) for comprehensive test coverage including:

- Connection and authentication
- Subscription management
- Authorization checks
- Real-time update broadcasting
- Ping/pong keep-alive
- Multi-client scenarios

## Monitoring

Helper functions for monitoring connections:

```typescript
import { getActiveConnectionCount, getAuthenticatedConnectionCount } from "@/websocket/server";

console.log(`Active connections: ${getActiveConnectionCount()}`);
console.log(`Authenticated: ${getAuthenticatedConnectionCount()}`);
```

## Security Considerations

- **Authentication Required**: All operations except initial connection require authentication
- **Authorization Enforced**: Subscriptions check read access permissions
- **Token Validation**: JWT tokens are validated using the same service as HTTP endpoints
- **Connection Limits**: Consider implementing rate limiting for connection attempts
- **Message Size**: Consider implementing message size limits to prevent abuse

## Future Enhancements

Potential improvements for production deployments:

- **Redis Pub/Sub**: For multi-instance deployments, use Redis to broadcast across servers
- **Connection Pooling**: Limit connections per user
- **Rate Limiting**: Throttle subscription requests
- **Selective Broadcasting**: Only send fields that changed (delta updates)
- **Compression**: Enable WebSocket compression for large payloads
- **Reconnection Logic**: Server-side tracking of subscriptions for seamless reconnection
