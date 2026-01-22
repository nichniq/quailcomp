/**
 * Database connection using Bun's built-in SQL
 *
 * Bun provides native PostgreSQL support with tagged template literals
 * for queries, providing automatic parameterization and SQL injection protection.
 */

import { SQL } from "bun";
import { type DbConfig, getDbConfig } from "./config";

export type Sql = SQL;

/**
 * Create a database connection with the given configuration
 */
export function createConnection(config: DbConfig): Sql {
  const url = buildConnectionUrl(config);
  return new SQL({
    url,
    max: config.max,
    // Bun SQL uses camelCase by default for column names
  });
}

/**
 * Build a PostgreSQL connection URL from config
 */
function buildConnectionUrl(config: DbConfig): string {
  const auth = config.password
    ? `${config.username}:${encodeURIComponent(config.password)}`
    : config.username;

  const params = new URLSearchParams();
  if (config.ssl) {
    params.set("sslmode", "require");
  }

  const queryString = params.toString();
  const suffix = queryString ? `?${queryString}` : "";

  return `postgres://${auth}@${config.host}:${config.port}/${config.database}${suffix}`;
}

/**
 * Default database connection using environment configuration
 * Use this for the main application
 */
let defaultConnection: Sql | null = null;

export function getConnection(): Sql {
  if (!defaultConnection) {
    defaultConnection = createConnection(getDbConfig());
  }
  return defaultConnection;
}

/**
 * Close the default connection (useful for graceful shutdown)
 */
export async function closeConnection(): Promise<void> {
  if (defaultConnection) {
    await defaultConnection.close();
    defaultConnection = null;
  }
}
