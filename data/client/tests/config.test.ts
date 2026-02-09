import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getDbConfig, getTestDbConfig } from "@/db/config";

describe("Database Configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_SSL;
    delete process.env.DB_MAX_CONNECTIONS;
    delete process.env.DB_TEST_NAME;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("getDbConfig", () => {
    it("should return default configuration", () => {
      const config = getDbConfig();

      expect(config.host).toBe("localhost");
      expect(config.port).toBe(5432);
      expect(config.database).toBe("quailcomp");
      expect(config.username).toBe("quailcomp_app");
      expect(config.password).toBe("");
      expect(config.ssl).toBe(false);
      expect(config.max).toBe(10);
    });

    it("should use DB_HOST from environment", () => {
      process.env.DB_HOST = "db.example.com";
      const config = getDbConfig();
      expect(config.host).toBe("db.example.com");
    });

    it("should use DB_PORT from environment", () => {
      process.env.DB_PORT = "5433";
      const config = getDbConfig();
      expect(config.port).toBe(5433);
    });

    it("should use DB_NAME from environment", () => {
      process.env.DB_NAME = "my_custom_db";
      const config = getDbConfig();
      expect(config.database).toBe("my_custom_db");
    });

    it("should use DB_USER from environment", () => {
      process.env.DB_USER = "custom_user";
      const config = getDbConfig();
      expect(config.username).toBe("custom_user");
    });

    it("should use DB_PASSWORD from environment", () => {
      process.env.DB_PASSWORD = "secret123";
      const config = getDbConfig();
      expect(config.password).toBe("secret123");
    });

    it("should enable SSL when DB_SSL is true", () => {
      process.env.DB_SSL = "true";
      const config = getDbConfig();
      expect(config.ssl).toBe(true);
    });

    it("should disable SSL when DB_SSL is false", () => {
      process.env.DB_SSL = "false";
      const config = getDbConfig();
      expect(config.ssl).toBe(false);
    });

    it("should disable SSL when DB_SSL is not set", () => {
      const config = getDbConfig();
      expect(config.ssl).toBe(false);
    });

    it("should use DB_MAX_CONNECTIONS from environment", () => {
      process.env.DB_MAX_CONNECTIONS = "20";
      const config = getDbConfig();
      expect(config.max).toBe(20);
    });

    it("should parse all environment variables together", () => {
      process.env.DB_HOST = "prod.example.com";
      process.env.DB_PORT = "5433";
      process.env.DB_NAME = "production_db";
      process.env.DB_USER = "prod_user";
      process.env.DB_PASSWORD = "prod_pass";
      process.env.DB_SSL = "true";
      process.env.DB_MAX_CONNECTIONS = "50";

      const config = getDbConfig();

      expect(config.host).toBe("prod.example.com");
      expect(config.port).toBe(5433);
      expect(config.database).toBe("production_db");
      expect(config.username).toBe("prod_user");
      expect(config.password).toBe("prod_pass");
      expect(config.ssl).toBe(true);
      expect(config.max).toBe(50);
    });
  });

  describe("getTestDbConfig", () => {
    it("should return test database configuration", () => {
      const config = getTestDbConfig();

      expect(config.host).toBe("localhost");
      expect(config.port).toBe(5432);
      expect(config.database).toBe("quailcomp_test");
      expect(config.username).toBe("quailcomp_app");
      expect(config.password).toBe("");
      expect(config.ssl).toBe(false);
      expect(config.max).toBe(10);
    });

    it("should use DB_TEST_NAME from environment", () => {
      process.env.DB_TEST_NAME = "custom_test_db";
      const config = getTestDbConfig();
      expect(config.database).toBe("custom_test_db");
    });

    it("should inherit other config from getDbConfig", () => {
      process.env.DB_HOST = "test.example.com";
      process.env.DB_PORT = "5433";
      process.env.DB_USER = "test_user";
      process.env.DB_PASSWORD = "test_pass";
      process.env.DB_SSL = "true";
      process.env.DB_MAX_CONNECTIONS = "5";
      process.env.DB_TEST_NAME = "my_tests";

      const config = getTestDbConfig();

      expect(config.host).toBe("test.example.com");
      expect(config.port).toBe(5433);
      expect(config.database).toBe("my_tests");
      expect(config.username).toBe("test_user");
      expect(config.password).toBe("test_pass");
      expect(config.ssl).toBe(true);
      expect(config.max).toBe(5);
    });
  });
});
