/**
 * Database configuration
 *
 * Configuration is loaded from environment variables with sensible defaults
 * for local development. In production, set these via environment variables.
 *
 * Environment variables:
 * - DB_HOST: Database host (default: localhost)
 * - DB_PORT: Database port (default: 5432)
 * - DB_NAME: Database name (default: quailcomp)
 * - DB_USER: Database user (default: quailcomp_app)
 * - DB_PASSWORD: Database password (required in production)
 * - DB_SSL: Enable SSL (default: false for local, true for production)
 */

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  max: number; // max connections in pool
}

export function getDbConfig(): DbConfig {
  return {
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    database: process.env.DB_NAME ?? "quailcomp",
    username: process.env.DB_USER ?? "quailcomp_app",
    password: process.env.DB_PASSWORD ?? "",
    ssl: process.env.DB_SSL === "true",
    max: parseInt(process.env.DB_MAX_CONNECTIONS ?? "10", 10),
  };
}

/**
 * Get configuration for test database
 * Uses a separate test database to avoid polluting development data
 */
export function getTestDbConfig(): DbConfig {
  return {
    ...getDbConfig(),
    database: process.env.DB_TEST_NAME ?? "quailcomp_test",
  };
}
