/**
 * Repository Stars Database Operations
 *
 * Provides functions for managing repository star data.
 */

import { query } from "./index";

/**
 * Upserts a star record for a user and repository.
 *
 * @param userGithubId - GitHub user ID
 * @param repoGithubId - GitHub repository ID
 * @param starredAt - ISO timestamp when the repo was starred
 */
export async function upsertStar(
  userGithubId: number,
  repoGithubId: number,
  starredAt: string,
): Promise<void> {
  await query(
    `INSERT INTO repo_stars (
      user_github_id, repo_github_id, starred_at, synced_at
    ) VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_github_id, repo_github_id)
    DO UPDATE SET
      starred_at = EXCLUDED.starred_at,
      synced_at = NOW()`,
    [userGithubId, repoGithubId, starredAt],
  );
}

/**
 * Deletes all star records for a user that are not in the provided list of repo IDs.
 * Used to remove stale stars (repos that were unstarred).
 *
 * @param userGithubId - GitHub user ID
 * @param currentRepoIds - Array of repository GitHub IDs that are currently starred
 */
export async function deleteStaleStars(
  userGithubId: number,
  currentRepoIds: number[],
): Promise<void> {
  if (currentRepoIds.length === 0) {
    // If no current stars, delete all stars for this user
    await query(`DELETE FROM repo_stars WHERE user_github_id = $1`, [
      userGithubId,
    ]);
    return;
  }

  // Delete stars for repos not in the current list
  await query(
    `DELETE FROM repo_stars
     WHERE user_github_id = $1
       AND repo_github_id != ALL($2::bigint[])`,
    [userGithubId, currentRepoIds],
  );
}

/**
 * Checks if a user's stars need to be synced.
 * Returns true if:
 * - User has no stars, OR
 * - Most recent synced_at is older than 24 hours
 *
 * @param userGithubId - GitHub user ID
 * @returns true if sync is needed, false otherwise
 */
export async function shouldSyncStars(userGithubId: number): Promise<boolean> {
  const result = await query<{
    count: number;
    latest_synced_at: string | null;
  }>(
    `SELECT 
       COUNT(*)::int as count,
       MAX(synced_at) as latest_synced_at
     FROM repo_stars
     WHERE user_github_id = $1`,
    [userGithubId],
  );

  if (result.rows.length === 0) {
    return true;
  }

  const row = result.rows[0];

  // If no stars exist, sync is needed
  if (row.count === 0) {
    return true;
  }

  // If latest sync is older than 24 hours, sync is needed
  if (row.latest_synced_at) {
    const latestSync = new Date(row.latest_synced_at);
    const now = new Date();
    const hoursSinceSync =
      (now.getTime() - latestSync.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync >= 24;
  }

  return true;
}
