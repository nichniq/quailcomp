# WebSocket

> Enables real-time bidirectional communication between server and clients for entity updates.

This domain provides WebSocket connections that allow clients to subscribe to specific entities
and receive immediate updates when those entities are created, updated, or deleted. The WebSocket
server enforces authentication and authorization, ensuring clients only receive updates for
entities they have permission to access.

**Key Principle**: Real-time updates are permission-aware. Clients must authenticate and can only
subscribe to entities they have read access to. This maintains security while providing
low-latency updates.

## Connection Lifecycle

> WebSocket connections follow a three-phase lifecycle: authentication, subscription, and updates.

When a client connects, they must first authenticate using a JWT token before they can subscribe
to any entities. After authentication, they can subscribe to specific entity IDs. The server
broadcasts updates only to clients that are both authenticated and subscribed to the affected
entity.

**Phase 1 - Connection**:

1. Client opens WebSocket connection
2. Server sends `auth_required` message
3. Client must authenticate or connection remains unauthenticated

**Phase 2 - Authentication**:

1. Client sends `authenticate` message with JWT token
2. Server verifies token and extracts `user_id`
3. Server sends `authenticated` confirmation or closes connection

**Phase 3 - Subscription & Updates**:

1. Client sends `subscribe` messages for specific entity IDs
2. Server checks read access for each entity
3. Server broadcasts updates to all subscribed clients
4. Client can `unsubscribe` from entities at any time

## Connection Data

> Each WebSocket connection maintains per-connection state for authentication and subscriptions.

```typescript
export interface WebSocketData {
  /** User ID from authenticated JWT token */
  userId: number;
  /** Set of entity IDs this connection is subscribed to */
  subscriptions: Set<number>;
  /** Whether this connection has successfully authenticated */
  authenticated: boolean;
}
```

The `WebSocketData` is attached to each connection and tracks:

- **userId**: Extracted from the JWT token during authentication
- **subscriptions**: A Set of entity IDs the client wants to receive updates for
- **authenticated**: Whether the client has successfully authenticated (required before subscribing)

## Client Messages

> Clients send messages to authenticate, subscribe, unsubscribe, or ping the server.

```typescript
export interface WebSocketMessage {
  /** Message type indicating the action */
  type: "subscribe" | "unsubscribe" | "ping" | "error" | "authenticated";
  /** Entity ID for subscribe/unsubscribe actions */
  entityId?: number;
  /** Error or status message */
  message?: string;
}
```

**Message Types**:

- **authenticate**: Client sends JWT token (type not in interface, handled specially)
- **subscribe**: Request updates for a specific entity ID
- **unsubscribe**: Stop receiving updates for an entity ID
- **ping**: Keep-alive message (server responds with `pong`)
- **error**: Error response from server
- **authenticated**: Confirmation of successful authentication

**Authentication Message** (special case):

```json
{
  "type": "authenticate",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Server Broadcasts

> Server broadcasts entity updates to all subscribed and authorized clients.

```typescript
export interface BroadcastMessage {
  /** Type of entity change */
  type: "entity.created" | "entity.updated" | "entity.deleted";
  /** ID of the affected entity */
  entityId: number;
  /** Entity type string (e.g., "book", "series") */
  entityType: string;
  /** Optional entity data (depends on event type) */
  data?: unknown;
  /** ISO timestamp of when the event occurred */
  timestamp: string;
}
```

**Broadcast Types**:

- **entity.created**: A new entity was created
- **entity.updated**: An existing entity was modified
- **entity.deleted**: An entity was soft-deleted

**Example Broadcast**:

```json
{
  "type": "entity.updated",
  "entityId": 42,
  "entityType": "book",
  "data": { "title": "Updated Title", "version": 2 },
  "timestamp": "2026-02-06T12:34:56.789Z"
}
```

## WebSocket Handler

> The WebSocket handler manages connection lifecycle events and message routing.

The handler is created via `createWebSocketHandler(sql)` and implements four lifecycle methods:

- **open(ws)**: Called when a connection is opened, sends `auth_required` message
- **message(ws, message)**: Routes incoming messages and enforces authentication
- **close(ws)**: Called when a connection closes, removes from active connections
- **error(ws, error)**: Called on connection errors, logs the error

**Authentication Flow**:

1. All messages require authentication except `authenticate` message
2. Unauthenticated clients receive `error` response for all non-auth messages
3. After successful authentication, `userId` is stored in connection data
4. Failed authentication closes the connection with code 1008

**Subscription Flow**:

1. Client sends `subscribe` message with `entityId`
2. Server checks if user has read access via `AuthorizationService`
3. If authorized, entity ID is added to subscriptions Set
4. If denied, client receives `error` response

## Broadcasting Updates

> The `broadcastUpdate()` function sends updates to all relevant clients.

The function signature is:

```typescript
export function broadcastUpdate(message: BroadcastMessage): void;
```

**Broadcast Rules**:

1. Only sends to authenticated connections
2. Only sends to connections subscribed to the affected entity
3. Access control is enforced at subscription time (not broadcast time)

The function iterates over all active connections and sends the message to those that meet
both criteria. This is efficient because:

- Access checks happen once at subscription time
- Broadcasting is a simple Set membership check
- No database queries during broadcast

**Example Usage**:

After updating an entity in the database, call `broadcastUpdate()` with a message describing the change.

## Connection Monitoring

> Helper functions provide visibility into active connections.

The monitoring functions are:

```typescript
export function getActiveConnectionCount(): number;
export function getAuthenticatedConnectionCount(): number;
```

These functions are useful for:

- Monitoring dashboard metrics
- Health checks
- Debugging WebSocket issues
- Understanding system load

## Integration Points

- [Authentication Domain](./authentication.md) - JWT token verification for WebSocket connections
- [Authorization Domain](./authorization.md) - Access control checks during subscription
- [HTTP Domain](./http.md) - WebSocket handler integrates with HTTP server
- [Entities Domain](./entities.md) - Entity updates trigger WebSocket broadcasts

## Security Invariants

> Security constraints that must always hold true.

1. **Authentication Required**: Clients must authenticate before subscribing to any entities
2. **Authorization on Subscribe**: Read access is checked when client subscribes to an entity
3. **No Cross-User Leaks**: Clients only receive updates for entities they're subscribed to
4. **Connection Cleanup**: Unsubscribe happens automatically when connection closes
5. **Token Verification**: JWT tokens are verified using the same logic as HTTP authentication

## Use Cases

**Real-Time Book Updates**:

Client subscribes to a book they're viewing, then receives immediate updates when another user modifies it.

**Multi-Device Sync**:

User has app open on phone and computer. Both clients subscribe to the same entities. Updates from one device instantly appear on the other through WebSocket broadcasts.

**Collaborative Editing**:

Multiple users with shared access to a series all subscribe to the series entity. When one user updates it, others see changes immediately via broadcast messages.

## Implementation Notes

**Connection Registry**:

All active connections are stored in a module-level Set. This provides fast iteration for
broadcasting but means the WebSocket state is in-memory only. If the server restarts, all
connections are dropped and clients must reconnect.

**Access Control Timing**:

Authorization checks happen at subscription time, not broadcast time. This means:

- ✅ Efficient: No database queries during broadcast
- ✅ Secure: Access is verified before subscription
- ⚠️ Consideration: If user permissions change, subscriptions don't update until reconnect

**No Automatic Resubscription**:

If a client disconnects and reconnects, they must re-authenticate and re-subscribe to all
entities. The server does not track or restore previous subscriptions.

**Message Format**:

All messages use JSON serialization. Binary messages are not supported. Messages are
UTF-8 encoded strings containing JSON objects.
