/**
 * Database Schema Definitions
 *
 * This module defines the database schema and types for storing:
 * - Repositories
 * - Issues
 * - Sync metadata (last sync time, etc.)
 *
 * TODO: Define database tables and their schemas
 * TODO: Create migration files or schema initialization
 */

// TODO: Define database schema
// - Repositories table: id, github_id, name, full_name, org, etc.
// - Issues table: id, github_id, repo_id, number, title, body, state, etc.
// - Sync metadata table: last_sync_time, repo_id, etc.

// TODO: Define TypeScript interfaces matching database schema
export interface DbRepo {
  // TODO: Define repository database record interface
}

export interface DbIssue {
  // TODO: Define issue database record interface
}

// TODO: Create SQL schema/migration
// - CREATE TABLE statements
// - Indexes for performance
// - Foreign key relationships
