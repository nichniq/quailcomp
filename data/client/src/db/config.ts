/**
 * Database configuration
 *
 * Configuration is loaded from environment variables with sensible defaults
 * for local development. In production, set these via environment variables.
 *
 * Environment variables:
 * - DATABASE_URL: PostgreSQL connection URL (takes precedence if set)
 *   Format: postgres://user:password@host:port/database
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

/**
 * Parse DATABASE_URL into connection config
 * Format: postgres://user:password@host:port/database
 */
function parseDatabaseUrl(url: string): Partial<DbConfig> {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname.slice(1), // Remove leading /
      username: parsed.username,
      password: parsed.password,
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error}`);
  }
}

export function getDbConfig(): DbConfig {
  // If DATABASE_URL is set, parse it and use as base config
  const baseConfig = process.env.DATABASE_URL
    ? parseDatabaseUrl(process.env.DATABASE_URL)
    : {};

  return {
    host: baseConfig.host ?? process.env.DB_HOST ?? "localhost",
    port: baseConfig.port ?? parseInt(process.env.DB_PORT ?? "5432", 10),
    database: baseConfig.database ?? process.env.DB_NAME ?? "quailcomp",
    username: baseConfig.username ?? process.env.DB_USER ?? "quailcomp_app",
    password: baseConfig.password ?? process.env.DB_PASSWORD ?? "",
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
