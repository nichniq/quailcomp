import { describe, it, expect } from "bun:test";
import { createConnection, getConnection, closeConnection } from "@/db/connection";
import type { DbConfig } from "@/db/config";

describe("Database Connection", () => {
  describe("createConnection", () => {
    it("should create connection with basic config", () => {
      const config: DbConfig = {
        host: "localhost",
        port: 5432,
        database: "test_db",
        username: "test_user",
        password: "",
        ssl: false,
        max: 10,
      };

      const sql = createConnection(config);
      expect(sql).toBeDefined();
      expect(sql.close).toBeInstanceOf(Function);
    });

    it("should create connection with password", () => {
      const config: DbConfig = {
        host: "localhost",
        port: 5432,
        database: "test_db",
        username: "test_user",
        password: "test_pass",
        ssl: false,
        max: 10,
      };

      const sql = createConnection(config);
      expect(sql).toBeDefined();
    });

    it("should create connection with special characters in password", () => {
      const config: DbConfig = {
        host: "localhost",
        port: 5432,
        database: "test_db",
        username: "test_user",
        password: "p@ss:w0rd!#$%",
        ssl: false,
        max: 10,
      };

      const sql = createConnection(config);
      expect(sql).toBeDefined();
    });

    it("should create connection with SSL enabled", () => {
      const config: DbConfig = {
        host: "localhost",
        port: 5432,
        database: "test_db",
        username: "test_user",
        password: "test_pass",
        ssl: true,
        max: 10,
      };

      const sql = createConnection(config);
      expect(sql).toBeDefined();
    });

    it("should create connection with custom port", () => {
      const config: DbConfig = {
        host: "localhost",
        port: 5433,
        database: "test_db",
        username: "test_user",
        password: "",
        ssl: false,
        max: 10,
      };

      const sql = createConnection(config);
      expect(sql).toBeDefined();
    });

    it("should create connection with custom max connections", () => {
      const config: DbConfig = {
        host: "localhost",
        port: 5432,
        database: "test_db",
        username: "test_user",
        password: "",
        ssl: false,
        max: 50,
      };

      const sql = createConnection(config);
      expect(sql).toBeDefined();
    });
  });

  describe("getConnection", () => {
    it("should return a connection", () => {
      const sql = getConnection();
      expect(sql).toBeDefined();
      expect(sql.close).toBeInstanceOf(Function);
    });

    it("should return the same connection on multiple calls", () => {
      const sql1 = getConnection();
      const sql2 = getConnection();
      expect(sql1).toBe(sql2);
    });
  });

  describe("closeConnection", () => {
    it("should close the default connection", async () => {
      // Get a connection first
      const sql = getConnection();
      expect(sql).toBeDefined();

      // Close it
      await closeConnection();

      // Getting connection again should create a new one
      const newSql = getConnection();
      expect(newSql).toBeDefined();
      // Note: We can't easily test if it's actually different without modifying the module
    });

    it("should handle closing when no connection exists", async () => {
      await closeConnection();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
