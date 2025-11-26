/**
 * Database Connection Helper
 *
 * Provides a query helper for Neon Postgres database using @neondatabase/serverless.
 */

import { neon } from "@neondatabase/serverless";

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create Neon client
const sql = neon(databaseUrl);

/**
 * Executes a parameterized SQL query.
 *
 * @param queryText - SQL query text with parameter placeholders ($1, $2, etc.)
 * @param params - Array of parameter values
 * @returns Promise resolving to query results
 */
export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<T[]> {
  // @neondatabase/serverless supports parameterized queries
  // The sql function can be called with a query string and params array
  const results = await (
    sql as unknown as (query: string, params?: unknown[]) => Promise<unknown[]>
  )(queryText, params);
  return results as T[];
}
