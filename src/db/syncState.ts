/**
 * Sync State Database Operations
 *
 * Provides functions for managing incremental sync state.
 */

import { query } from "./index.js";

export interface SyncState {
  last_issue_sync: string | null;
  last_pr_sync: string | null;
}

/**
 * Gets the sync state for a repository.
 * Returns null if no sync state exists (indicating full sync needed).
 *
 * @param repoGithubId - GitHub ID of the repository
 * @returns Sync state or null if not found
 */
export async function getSyncState(
  repoGithubId: number,
): Promise<SyncState | null> {
  const result = await query<{
    last_issue_sync: string | null;
    last_pr_sync: string | null;
  }>(
    `SELECT last_issue_sync, last_pr_sync
     FROM sync_state
     WHERE repo_github_id = $1`,
    [repoGithubId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Upserts the issue sync timestamp for a repository.
 * Inserts if the row doesn't exist, updates if it does.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @param timestamp - Timestamp of the last issue sync
 */
export async function upsertIssueSyncTime(
  repoGithubId: number,
  timestamp: string,
): Promise<void> {
  await query(
    `INSERT INTO sync_state (repo_github_id, last_issue_sync, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (repo_github_id)
     DO UPDATE SET
       last_issue_sync = EXCLUDED.last_issue_sync,
       updated_at = NOW()`,
    [repoGithubId, timestamp],
  );
}

/**
 * Upserts the PR sync timestamp for a repository.
 * Inserts if the row doesn't exist, updates if it does.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @param timestamp - Timestamp of the last PR sync
 */
export async function upsertPrSyncTime(
  repoGithubId: number,
  timestamp: string,
): Promise<void> {
  await query(
    `INSERT INTO sync_state (repo_github_id, last_pr_sync, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (repo_github_id)
     DO UPDATE SET
       last_pr_sync = EXCLUDED.last_pr_sync,
       updated_at = NOW()`,
    [repoGithubId, timestamp],
  );
}
