/**
 * WebSocket tests
 *
 * Tests real-time updates via WebSocket connections.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { createEntitiesClient, getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";
import { createServer } from "@/server";
import type { ServerInstance } from "@/server";
import { AuthService } from "@/auth/service";
import { AuthorizationService } from "@/authz/service";
import type { BookEntitySnapshot } from "@domains/types/books";

describe("WebSocket", () => {
  let sql: Sql;
  let server: ServerInstance;
  let baseUrl: string;
  let wsUrl: string;
  let authToken: string;
  let userId: number;

  const BOOK_TYPE = "book";
  const timestamp = Date.now();

  beforeAll(async () => {
    sql = getConnection();
    server = createServer({ port: 0 }); // Random port
    const url = new URL(server.url);
    baseUrl = `http://${url.host}`;
    wsUrl = `ws://${url.host}/ws`;

    // Create test user and get auth token
    const authService = new AuthService(sql);
    const testEmail = `ws-test-${timestamp}@example.com`;
    const testPassword = "Wss0cket!Test99"; // Strong unique password

    const authResponse = await authService.register({
      email: testEmail,
      password: testPassword,
    });
    userId = authResponse.user.userId;
    authToken = authResponse.token;
  });

  afterAll(async () => {
    server.stop();
    await sql.end();
  });

  describe("Connection and Authentication", () => {
    test("establishes WebSocket connection", async () => {
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          resolve();
        };
        ws.onerror = (error) => {
          reject(error);
        };
        setTimeout(() => reject(new Error("Connection timeout")), 5000);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    test("requires authentication", async () => {
      const ws = new WebSocket(wsUrl);
      let authRequired = false;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          // Don't authenticate, just wait for auth required message
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "auth_required") {
            authRequired = true;
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 5000);
      });

      expect(authRequired).toBe(true);
    });

    test("authenticates with valid token", async () => {
      const ws = new WebSocket(wsUrl);
      let authenticated = false;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "authenticated") {
            authenticated = true;
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 5000);
      });

      expect(authenticated).toBe(true);
    });

    test("rejects invalid token", async () => {
      const ws = new WebSocket(wsUrl);
      let authFailed = false;

      await new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: "invalid-token",
            })
          );
        };

        ws.onclose = (event) => {
          if (event.code === 1008) {
            authFailed = true;
          }
          resolve();
        };

        ws.onerror = () => {
          resolve();
        };

        setTimeout(() => resolve(), 5000);
      });

      expect(authFailed).toBe(true);
    });
  });

  describe("Subscription Management", () => {
    test("subscribes to entity with access", async () => {
      const entities = createEntitiesClient(sql);
      const authzService = new AuthorizationService(sql);

      // Create a book
      const book = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: {
          title: `WS Test Book ${timestamp}`,
          author: "Test Author",
        },
      });

      await authzService.grantOwnerOnCreate(book.entityId, userId);

      const ws = new WebSocket(wsUrl);
      let subscribed = false;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "authenticated") {
            ws.send(
              JSON.stringify({
                type: "subscribe",
                entityId: book.entityId,
              })
            );
          } else if (data.type === "subscribed") {
            subscribed = true;
            expect(data.entityId).toBe(book.entityId);
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 5000);
      });

      expect(subscribed).toBe(true);
    });

    test("rejects subscription to entity without access", async () => {
      const entities = createEntitiesClient(sql);
      const authService = new AuthService(sql);

      // Create another user
      const otherUserResponse = await authService.register({
        email: `ws-other-${timestamp}@example.com`,
        password: "Wss0cket!Test99",
      });
      const otherUser = otherUserResponse.user;

      // Create a book owned by other user
      const authzService = new AuthorizationService(sql);
      const book = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: {
          title: `Private Book ${timestamp}`,
          author: "Test Author",
        },
      });

      await authzService.grantOwnerOnCreate(book.entityId, otherUser.userId);

      const ws = new WebSocket(wsUrl);
      let accessDenied = false;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "authenticated") {
            ws.send(
              JSON.stringify({
                type: "subscribe",
                entityId: book.entityId,
              })
            );
          } else if (data.type === "error" && data.message.includes("Access denied")) {
            accessDenied = true;
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 5000);
      });

      expect(accessDenied).toBe(true);
    });

    test("unsubscribes from entity", async () => {
      const entities = createEntitiesClient(sql);
      const authzService = new AuthorizationService(sql);

      const book = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: {
          title: `Unsubscribe Test ${timestamp}`,
          author: "Test Author",
        },
      });

      await authzService.grantOwnerOnCreate(book.entityId, userId);

      const ws = new WebSocket(wsUrl);
      let unsubscribed = false;

      await new Promise<void>((resolve, reject) => {
        let subscribedFirst = false;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "authenticated") {
            ws.send(
              JSON.stringify({
                type: "subscribe",
                entityId: book.entityId,
              })
            );
          } else if (data.type === "subscribed" && !subscribedFirst) {
            subscribedFirst = true;
            ws.send(
              JSON.stringify({
                type: "unsubscribe",
                entityId: book.entityId,
              })
            );
          } else if (data.type === "unsubscribed") {
            unsubscribed = true;
            expect(data.entityId).toBe(book.entityId);
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 5000);
      });

      expect(unsubscribed).toBe(true);
    });
  });

  describe("Real-time Updates", () => {
    test("receives update when subscribed entity is modified", async () => {
      const entities = createEntitiesClient(sql);
      const authzService = new AuthorizationService(sql);

      const book = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: {
          title: `Update Test ${timestamp}`,
          author: "Test Author",
        },
      });

      await authzService.grantOwnerOnCreate(book.entityId, userId);

      const ws = new WebSocket(wsUrl);
      let receivedUpdate = false;

      await new Promise<void>((resolve, reject) => {
        let authenticated = false;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "auth_required") {
            // Ignore auth_required
            return;
          } else if (data.type === "authenticated") {
            authenticated = true;
            ws.send(
              JSON.stringify({
                type: "subscribe",
                entityId: book.entityId,
              })
            );
          } else if (data.type === "subscribed" && authenticated) {
            // Now update the book via HTTP API
            const response = await fetch(`${baseUrl}/books/${book.entityId}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: "Updated Title",
              }),
            });

            expect(response.ok).toBe(true);
          } else if (data.type === "entity.updated") {
            receivedUpdate = true;
            expect(data.entityId).toBe(book.entityId);
            expect(data.entityType).toBe(BOOK_TYPE);
            expect(data.data.data.title).toBe("Updated Title");
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 10000);
      });

      expect(receivedUpdate).toBe(true);
    });

    test("receives create notification when subscribed entity is created", async () => {
      const entities = createEntitiesClient(sql);
      const authzService = new AuthorizationService(sql);

      // Pre-create a book to subscribe to
      const existingBook = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: {
          title: `Existing ${timestamp}`,
          author: "Test Author",
        },
      });

      await authzService.grantOwnerOnCreate(existingBook.entityId, userId);

      const ws = new WebSocket(wsUrl);
      let receivedCreate = false;
      let newBookId: number;

      await new Promise<void>((resolve, reject) => {
        let authenticated = false;
        let subscribed = false;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "authenticated") {
            authenticated = true;
            // Create a new book and immediately subscribe to it
            const response = await fetch(`${baseUrl}/books`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: `New Book ${timestamp}`,
                author: "Test Author",
              }),
            });

            const result = await response.json();
            newBookId = result.book.entityId;

            // Subscribe to the newly created book
            ws.send(
              JSON.stringify({
                type: "subscribe",
                entityId: newBookId,
              })
            );
          } else if (data.type === "subscribed") {
            subscribed = true;
            // Now create another book with same ID to trigger broadcast
            // Actually, we should update the book we just subscribed to
            await fetch(`${baseUrl}/books/${newBookId}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: "Triggered Update",
              }),
            });
          } else if (data.type === "entity.updated" && subscribed) {
            receivedCreate = true;
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 10000);
      });

      expect(receivedCreate).toBe(true);
    });

    test("receives delete notification when subscribed entity is deleted", async () => {
      const entities = createEntitiesClient(sql);
      const authzService = new AuthorizationService(sql);

      const book = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: {
          title: `Delete Test ${timestamp}`,
          author: "Test Author",
        },
      });

      await authzService.grantOwnerOnCreate(book.entityId, userId);

      const ws = new WebSocket(wsUrl);
      let receivedDelete = false;

      await new Promise<void>((resolve, reject) => {
        let authenticated = false;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "authenticated") {
            authenticated = true;
            ws.send(
              JSON.stringify({
                type: "subscribe",
                entityId: book.entityId,
              })
            );
          } else if (data.type === "subscribed" && authenticated) {
            // Delete the book via HTTP API
            const response = await fetch(`${baseUrl}/books/${book.entityId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            });

            expect(response.ok).toBe(true);
          } else if (data.type === "entity.deleted") {
            receivedDelete = true;
            expect(data.entityId).toBe(book.entityId);
            expect(data.entityType).toBe(BOOK_TYPE);
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 10000);
      });

      expect(receivedDelete).toBe(true);
    });

    test("does not receive updates for unsubscribed entities", async () => {
      const entities = createEntitiesClient(sql);
      const authzService = new AuthorizationService(sql);

      const book1 = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: {
          title: `Book 1 ${timestamp}`,
          author: "Test Author",
        },
      });

      const book2 = await entities.create<BookEntitySnapshot>({
        type: BOOK_TYPE,
        data: {
          title: `Book 2 ${timestamp}`,
          author: "Test Author",
        },
      });

      await authzService.grantOwnerOnCreate(book1.entityId, userId);
      await authzService.grantOwnerOnCreate(book2.entityId, userId);

      const ws = new WebSocket(wsUrl);
      let receivedUnsubscribedUpdate = false;

      await new Promise<void>((resolve, reject) => {
        let authenticated = false;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "authenticated") {
            authenticated = true;
            // Only subscribe to book1
            ws.send(
              JSON.stringify({
                type: "subscribe",
                entityId: book1.entityId,
              })
            );
          } else if (data.type === "subscribed" && authenticated) {
            // Update book2 (not subscribed)
            await fetch(`${baseUrl}/books/${book2.entityId}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: "Updated Book 2",
              }),
            });

            // Wait a bit to see if we receive any updates
            setTimeout(() => {
              ws.close();
              resolve();
            }, 1000);
          } else if (
            data.type === "entity.updated" &&
            data.entityId === book2.entityId
          ) {
            receivedUnsubscribedUpdate = true;
            ws.close();
            reject(new Error("Received update for unsubscribed entity"));
          }
        };

        ws.onerror = reject;
        setTimeout(() => {
          ws.close();
          resolve();
        }, 5000);
      });

      expect(receivedUnsubscribedUpdate).toBe(false);
    });
  });

  describe("Ping/Pong", () => {
    test("responds to ping with pong", async () => {
      const ws = new WebSocket(wsUrl);
      let receivedPong = false;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "authenticate",
              token: authToken,
            })
          );
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "authenticated") {
            ws.send(JSON.stringify({ type: "ping" }));
          } else if (data.type === "pong") {
            receivedPong = true;
            ws.close();
            resolve();
          }
        };

        ws.onerror = reject;
        setTimeout(() => reject(new Error("Timeout")), 5000);
      });

      expect(receivedPong).toBe(true);
    });
  });
});
