/**
 * E2E Authorization Workflow Tests
 *
 * Tests complete authorization flows including:
 * - Owner access granted on entity creation
 * - Access control enforcement
 * - Granting and revoking access
 * - Transferring ownership
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createServer, type ServerInstance } from "@/server";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

let server: ServerInstance;
let baseUrl: string;
let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
  server = createServer({ port: 0 }); // Use random available port
  baseUrl = server.url.toString().replace(/\/$/, "");
});

afterAll(() => {
  server.stop();
});

/**
 * Helper to register a user and return their token
 */
async function registerUser(email: string, password: string): Promise<{ userId: number; token: string }> {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  return { userId: data.user.userId, token: data.token };
}

/**
 * Helper to create a book (entity) and return its ID
 */
async function createBook(token: string, bookData: any): Promise<number> {
  const response = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bookData),
  });

  const { book } = await response.json();
  return book.entityId;
}

describe("E2E Authorization Workflow", () => {
  const timestamp = Date.now();

  test("owner automatically granted on book creation", async () => {
    const { token } = await registerUser(
      `owner-grant-${timestamp}@example.com`,
      "password123"
    );

    // Create book
    const bookId = await createBook(token, {
      title: "Test Book",
      isbn: `978000000${timestamp}`,
    });

    // Verify owner can read
    const readResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(readResponse.status).toBe(200);

    // Verify owner can update
    const updateResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: "Updated Title" }),
    });
    expect(updateResponse.status).toBe(200);

    // Verify owner can delete
    const deleteResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("user without access cannot read book", async () => {
    const owner = await registerUser(`owner-no-access-${timestamp}@example.com`, "password123");
    const other = await registerUser(`other-no-access-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Private Book",
      isbn: `978000001${timestamp}`,
    });

    // Other user tries to read
    const response = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${other.token}` },
    });

    expect(response.status).toBe(403);
    const error = await response.json();
    expect(error.error).toBe("Access denied");
  });

  test("user without write access cannot update book", async () => {
    const owner = await registerUser(`owner-no-write-${timestamp}@example.com`, "password123");
    const reader = await registerUser(`reader-no-write-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Read Only Book",
      isbn: `978000002${timestamp}`,
    });

    // Grant read access to reader
    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: reader.userId,
        accessLevel: "read",
      }),
    });

    // Reader can read
    const readResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${reader.token}` },
    });
    expect(readResponse.status).toBe(200);

    // Reader cannot update
    const updateResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${reader.token}`,
      },
      body: JSON.stringify({ title: "Hacked!" }),
    });
    expect(updateResponse.status).toBe(403);
  });

  test("user without owner access cannot delete book", async () => {
    const owner = await registerUser(`owner-no-delete-${timestamp}@example.com`, "password123");
    const writer = await registerUser(`writer-no-delete-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Protected Book",
      isbn: `978000003${timestamp}`,
    });

    // Grant write access to writer
    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: writer.userId,
        accessLevel: "write",
      }),
    });

    // Writer can update
    const updateResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writer.token}`,
      },
      body: JSON.stringify({ title: "Updated by Writer" }),
    });
    expect(updateResponse.status).toBe(200);

    // Writer cannot delete
    const deleteResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${writer.token}` },
    });
    expect(deleteResponse.status).toBe(403);
  });

  test("owner can grant read access", async () => {
    const owner = await registerUser(`owner-grant-read-${timestamp}@example.com`, "password123");
    const reader = await registerUser(`reader-grant-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Shared Book",
      isbn: `978000004${timestamp}`,
    });

    // Reader cannot access initially
    const initialResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${reader.token}` },
    });
    expect(initialResponse.status).toBe(403);

    // Owner grants read access
    const grantResponse = await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: reader.userId,
        accessLevel: "read",
      }),
    });
    expect(grantResponse.status).toBe(201);

    // Reader can now access
    const afterGrantResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${reader.token}` },
    });
    expect(afterGrantResponse.status).toBe(200);
  });

  test("owner can grant write access", async () => {
    const owner = await registerUser(`owner-grant-write-${timestamp}@example.com`, "password123");
    const writer = await registerUser(`writer-grant-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Collaborative Book",
      isbn: `978000005${timestamp}`,
    });

    // Grant write access
    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: writer.userId,
        accessLevel: "write",
      }),
    });

    // Writer can update
    const updateResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writer.token}`,
      },
      body: JSON.stringify({ title: "Updated Collaboratively" }),
    });
    expect(updateResponse.status).toBe(200);
  });

  test("non-owner cannot grant access", async () => {
    const owner = await registerUser(`owner-non-grant-${timestamp}@example.com`, "password123");
    const reader = await registerUser(`reader-non-grant-${timestamp}@example.com`, "password123");
    const other = await registerUser(`other-non-grant-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Owner Only Grant",
      isbn: `978000006${timestamp}`,
    });

    // Grant read access to reader
    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: reader.userId,
        accessLevel: "read",
      }),
    });

    // Reader tries to grant access to other
    const grantResponse = await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${reader.token}`,
      },
      body: JSON.stringify({
        userId: other.userId,
        accessLevel: "read",
      }),
    });
    expect(grantResponse.status).toBe(403);
  });

  test("owner can revoke access", async () => {
    const owner = await registerUser(`owner-revoke-${timestamp}@example.com`, "password123");
    const reader = await registerUser(`reader-revoke-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Revoked Access Book",
      isbn: `978000007${timestamp}`,
    });

    // Grant read access
    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: reader.userId,
        accessLevel: "read",
      }),
    });

    // Verify reader can access
    const beforeRevokeResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${reader.token}` },
    });
    expect(beforeRevokeResponse.status).toBe(200);

    // Revoke access
    const revokeResponse = await fetch(`${baseUrl}/entities/${bookId}/access/${reader.userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(revokeResponse.status).toBe(200);

    // Verify reader can no longer access
    const afterRevokeResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      headers: { Authorization: `Bearer ${reader.token}` },
    });
    expect(afterRevokeResponse.status).toBe(403);
  });

  test("non-owner cannot revoke access", async () => {
    const owner = await registerUser(`owner-non-revoke-${timestamp}@example.com`, "password123");
    const reader1 = await registerUser(`reader1-non-revoke-${timestamp}@example.com`, "password123");
    const reader2 = await registerUser(`reader2-non-revoke-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Multi Reader Book",
      isbn: `978000008${timestamp}`,
    });

    // Grant read access to both readers
    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: reader1.userId,
        accessLevel: "read",
      }),
    });

    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: reader2.userId,
        accessLevel: "read",
      }),
    });

    // reader1 tries to revoke reader2's access
    const revokeResponse = await fetch(`${baseUrl}/entities/${bookId}/access/${reader2.userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${reader1.token}` },
    });
    expect(revokeResponse.status).toBe(403);
  });

  test("owner can transfer ownership", async () => {
    const owner = await registerUser(`owner-transfer-${timestamp}@example.com`, "password123");
    const newOwner = await registerUser(`new-owner-transfer-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Transferred Book",
      isbn: `978000009${timestamp}`,
    });

    // Transfer ownership
    const transferResponse = await fetch(`${baseUrl}/entities/${bookId}/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        newOwnerId: newOwner.userId,
      }),
    });
    expect(transferResponse.status).toBe(200);

    // New owner can delete
    const deleteResponse = await fetch(`${baseUrl}/books/${bookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${newOwner.token}` },
    });
    expect(deleteResponse.status).toBe(200);

    // Original owner cannot delete (now has write access)
    // Create another book for this test
    const bookId2 = await createBook(owner.token, {
      title: "Another Transferred Book",
      isbn: `978000010${timestamp}`,
    });

    await fetch(`${baseUrl}/entities/${bookId2}/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        newOwnerId: newOwner.userId,
      }),
    });

    const oldOwnerDeleteResponse = await fetch(`${baseUrl}/books/${bookId2}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(oldOwnerDeleteResponse.status).toBe(403);
  });

  test("non-owner cannot transfer ownership", async () => {
    const owner = await registerUser(`owner-non-transfer-${timestamp}@example.com`, "password123");
    const writer = await registerUser(`writer-non-transfer-${timestamp}@example.com`, "password123");
    const other = await registerUser(`other-non-transfer-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Owner Only Transfer",
      isbn: `978000011${timestamp}`,
    });

    // Grant write access to writer
    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: writer.userId,
        accessLevel: "write",
      }),
    });

    // Writer tries to transfer ownership
    const transferResponse = await fetch(`${baseUrl}/entities/${bookId}/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writer.token}`,
      },
      body: JSON.stringify({
        newOwnerId: other.userId,
      }),
    });
    expect(transferResponse.status).toBe(403);
  });

  test("list accessors shows all users with access", async () => {
    const owner = await registerUser(`owner-list-${timestamp}@example.com`, "password123");
    const reader = await registerUser(`reader-list-${timestamp}@example.com`, "password123");
    const writer = await registerUser(`writer-list-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Multi Access Book",
      isbn: `978000012${timestamp}`,
    });

    // Grant access to reader and writer
    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: reader.userId,
        accessLevel: "read",
      }),
    });

    await fetch(`${baseUrl}/entities/${bookId}/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        userId: writer.userId,
        accessLevel: "write",
      }),
    });

    // List accessors
    const response = await fetch(`${baseUrl}/entities/${bookId}/access`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(response.status).toBe(200);

    const { accessors } = await response.json();
    expect(accessors.length).toBe(3); // owner, reader, writer
    expect(accessors.some((a: any) => a.userId === owner.userId && a.accessLevel === "owner")).toBe(true);
    expect(accessors.some((a: any) => a.userId === reader.userId && a.accessLevel === "read")).toBe(true);
    expect(accessors.some((a: any) => a.userId === writer.userId && a.accessLevel === "write")).toBe(true);
  });

  test("user without access cannot list accessors", async () => {
    const owner = await registerUser(`owner-list-no-access-${timestamp}@example.com`, "password123");
    const other = await registerUser(`other-list-no-access-${timestamp}@example.com`, "password123");

    const bookId = await createBook(owner.token, {
      title: "Private List Book",
      isbn: `978000013${timestamp}`,
    });

    // Other user tries to list accessors
    const response = await fetch(`${baseUrl}/entities/${bookId}/access`, {
      headers: { Authorization: `Bearer ${other.token}` },
    });
    expect(response.status).toBe(403);
  });

  test("user can only see their own books in list", async () => {
    const user1 = await registerUser(`user1-list-books-${timestamp}@example.com`, "password123");
    const user2 = await registerUser(`user2-list-books-${timestamp}@example.com`, "password123");

    const book1Id = await createBook(user1.token, {
      title: "User 1 Book",
      isbn: `978000014${timestamp}`,
    });

    const book2Id = await createBook(user2.token, {
      title: "User 2 Book",
      isbn: `978000015${timestamp}`,
    });

    // User 1 lists books
    const user1Response = await fetch(`${baseUrl}/books`, {
      headers: { Authorization: `Bearer ${user1.token}` },
    });
    const { books: user1Books } = await user1Response.json();
    expect(user1Books.some((b: any) => b.entityId === book1Id)).toBe(true);
    expect(user1Books.some((b: any) => b.entityId === book2Id)).toBe(false);

    // User 2 lists books
    const user2Response = await fetch(`${baseUrl}/books`, {
      headers: { Authorization: `Bearer ${user2.token}` },
    });
    const { books: user2Books } = await user2Response.json();
    expect(user2Books.some((b: any) => b.entityId === book2Id)).toBe(true);
    expect(user2Books.some((b: any) => b.entityId === book1Id)).toBe(false);
  });
});
