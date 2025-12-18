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

// Query profiling configuration
const ENABLE_QUERY_PROFILING =
  process.env.ENABLE_QUERY_PROFILING === "true" ||
  process.env.NODE_ENV === "development";
const SLOW_QUERY_THRESHOLD_MS = parseInt(
  process.env.SLOW_QUERY_THRESHOLD_MS || "100",
  10,
);

/**
 * Extracts a short identifier from a SQL query for logging purposes.
 * Returns the first few words of the query (typically the operation type).
 */
function getQueryIdentifier(queryText: string): string {
  const trimmed = queryText.trim();
  const words = trimmed.split(/\s+/);
  // Take first 3-4 words, but limit to ~50 chars
  const identifier = words.slice(0, 4).join(" ");
  return identifier.length > 50
    ? identifier.substring(0, 47) + "..."
    : identifier;
}

/**
 * Executes a parameterized SQL query with optional performance profiling.
 *
 * @param queryText - SQL query text with parameter placeholders ($1, $2, etc.)
 * @param params - Array of parameter values
 * @returns Promise resolving to query results
 */
export async function query<T = unknown>(
  queryText: string,
  params?: unknown[],
): Promise<T[]> {
  if (!ENABLE_QUERY_PROFILING) {
    // Fast path: no profiling overhead
    const results = await sql.query(queryText, params || []);
    return results as T[];
  }

  // Profiling enabled: measure query time
  const startTime = performance.now();
  const queryId = getQueryIdentifier(queryText);

  try {
    const results = await sql.query(queryText, params || []);
    const duration = performance.now() - startTime;

    // Log slow queries or all queries if threshold is 0
    if (duration >= SLOW_QUERY_THRESHOLD_MS || SLOW_QUERY_THRESHOLD_MS === 0) {
      const rowCount = Array.isArray(results) ? results.length : 0;
      console.log(
        `[QUERY] ${duration.toFixed(2)}ms | ${rowCount} rows | ${queryId}`,
      );
    }

    return results as T[];
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(
      `[QUERY ERROR] ${duration.toFixed(2)}ms | ${queryId} | ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
