/**
 * Database Connection and Query Helper
 *
 * Provides a connection pool and query helper for Postgres operations.
 */

import { Pool, PoolClient, QueryResult } from "pg";

let pool: Pool | null = null;

/**
 * Gets or creates the database connection pool.
 */
function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false, // Neon requires SSL but doesn't need cert verification
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
    });

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });
  }

  return pool;
}

/**
 * Executes a parameterized SQL query.
 *
 * @param text - SQL query text with parameter placeholders ($1, $2, etc.)
 * @param params - Array of parameter values
 * @returns Promise resolving to the query result
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

/**
 * Gets a client from the pool for transactions.
 * Remember to release the client when done.
 *
 * @returns Promise resolving to a pool client
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

/**
 * Closes the database connection pool.
 * Should be called when shutting down the application.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
