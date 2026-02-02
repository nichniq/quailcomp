/**
 * WebSocket Server
 *
 * Provides real-time updates for book collection changes.
 * Clients can subscribe to specific entities and receive updates when they change.
 */

import type { ServerWebSocket } from "bun";
import type { Sql } from "@quailcomp/data";
import { verifyToken } from "@/auth/jwt";
import { AuthorizationService } from "@/authz/service";

export interface WebSocketData {
  userId: number;
  subscriptions: Set<number>; // entity IDs
  authenticated: boolean;
}

export interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "ping" | "error" | "authenticated";
  entityId?: number;
  message?: string;
}

export interface BroadcastMessage {
  type: "entity.created" | "entity.updated" | "entity.deleted";
  entityId: number;
  entityType: string;
  data?: unknown;
  timestamp: string;
}

/**
 * Global registry of all connected WebSocket clients
 */
const clients = new Set<ServerWebSocket<WebSocketData>>();

/**
 * WebSocket handler for Bun server
 */
export function createWebSocketHandler(sql: Sql) {
  const authzService = new AuthorizationService(sql);

  return {
    /**
     * Called when a WebSocket connection is opened
     */
    async open(ws: ServerWebSocket<WebSocketData>) {
      clients.add(ws);

      console.log("WebSocket opened, awaiting authentication");

      // Send authentication required message
      ws.send(
        JSON.stringify({
          type: "auth_required",
          message: "Please authenticate by sending your JWT token",
        })
      );
    },

    /**
     * Called when a message is received from a client
     */
    async message(
      ws: ServerWebSocket<WebSocketData>,
      message: string | Buffer
    ) {
      try {
        const data = JSON.parse(message.toString()) as WebSocketMessage & {
          token?: string;
        };

        // Handle authentication
        if (!ws.data.authenticated) {
          if (data.type === "authenticate" && data.token) {
            try {
              const payload = await verifyToken(data.token);
              if (!payload || !payload.user_id) {
                throw new Error("Invalid token payload");
              }

              ws.data.userId = payload.user_id;
              ws.data.authenticated = true;

              ws.send(
                JSON.stringify({
                  type: "authenticated",
                  message: "Authentication successful",
                })
              );

              console.log(`WebSocket authenticated for user ${payload.user_id}`);
            } catch (error) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Authentication failed",
                })
              );
              ws.close(1008, "Authentication failed");
            }
          } else {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Authentication required",
              })
            );
          }
          return;
        }

        // Handle authenticated messages
        switch (data.type) {
          case "subscribe": {
            if (typeof data.entityId !== "number") {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Invalid entityId",
                })
              );
              return;
            }

            // Check if user has read access to this entity
            const hasAccess = await authzService.checkAccess(
              ws.data.userId,
              data.entityId,
              "read"
            );

            if (!hasAccess) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Access denied to entity",
                })
              );
              return;
            }

            ws.data.subscriptions.add(data.entityId);
            ws.send(
              JSON.stringify({
                type: "subscribed",
                entityId: data.entityId,
              })
            );
            console.log(
              `User ${ws.data.userId} subscribed to entity ${data.entityId}`
            );
            break;
          }

          case "unsubscribe": {
            if (typeof data.entityId === "number") {
              ws.data.subscriptions.delete(data.entityId);
              ws.send(
                JSON.stringify({
                  type: "unsubscribed",
                  entityId: data.entityId,
                })
              );
              console.log(
                `User ${ws.data.userId} unsubscribed from entity ${data.entityId}`
              );
            }
            break;
          }

          case "ping": {
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          }

          default: {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Unknown message type",
              })
            );
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          })
        );
      }
    },

    /**
     * Called when a WebSocket connection is closed
     */
    close(ws: ServerWebSocket<WebSocketData>) {
      clients.delete(ws);
      console.log(
        `WebSocket closed for user ${ws.data.userId ?? "unauthenticated"}`
      );
    },

    /**
     * Called when a WebSocket error occurs
     */
    error(ws: ServerWebSocket<WebSocketData>, error: Error) {
      console.error("WebSocket error:", error);
    },
  };
}

/**
 * Broadcast an update to all subscribed clients
 *
 * Only sends to clients that:
 * 1. Are authenticated
 * 2. Have subscribed to this entity
 * 3. Have read access to this entity (checked at subscription time)
 */
export function broadcastUpdate(message: BroadcastMessage): void {
  const payload = JSON.stringify(message);

  let sentCount = 0;
  for (const client of clients) {
    if (
      client.data.authenticated &&
      client.data.subscriptions.has(message.entityId)
    ) {
      client.send(payload);
      sentCount++;
    }
  }

  if (sentCount > 0) {
    console.log(
      `Broadcast ${message.type} for entity ${message.entityId} to ${sentCount} clients`
    );
  }
}

/**
 * Get count of active WebSocket connections
 */
export function getActiveConnectionCount(): number {
  return clients.size;
}

/**
 * Get count of authenticated WebSocket connections
 */
export function getAuthenticatedConnectionCount(): number {
  return Array.from(clients).filter((c) => c.data.authenticated).length;
}
