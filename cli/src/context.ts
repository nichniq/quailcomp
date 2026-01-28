import { getConnection, createEntitiesClient, createEventsClient } from "@quailcomp/data";
import type { CLIContext } from "@cli/types";

/**
 * Create CLI context with database connection and clients
 */
export function createContext(args: string[]): CLIContext {
  const sql = getConnection();
  const entities = createEntitiesClient(sql);
  const events = createEventsClient(sql);

  return {
    sql,
    entities,
    events,
    args,
  };
}

/**
 * Close database connections and cleanup
 */
export async function cleanup(context: CLIContext): Promise<void> {
  // Bun's SQL connection cleanup is handled automatically
  // This function is here for future cleanup needs
}
