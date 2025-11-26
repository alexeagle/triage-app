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
  // @neondatabase/serverless: use .query() method for parameterized queries
  // Always pass params as an array (empty array if no params)
  const results = await sql.query(queryText, params || []);
  return results as T[];
}
