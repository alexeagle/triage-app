/**
 * Sync Starred Repositories
 *
 * Syncs repositories that a user has starred from GitHub.
 * Only syncs public repositories.
 */

import { fetchStarredRepos } from "../data/github/starredRepos";
import {
  upsertStar,
  deleteStaleStars,
  shouldSyncStars,
} from "../data/db/repoStars";
import { upsertGitHubUser } from "../data/db/githubUsers";
import { enrichUserWithProfile } from "../data/github/userProfile";
import { query } from "../data/db/index";

interface SyncStarredReposResult {
  reposSynced: number;
  starsUpserted: number;
  staleStarsRemoved: number;
  error?: string;
}

/**
 * Syncs starred repositories for a GitHub user.
 * Only syncs if needed (no stars or stale data), unless force is true.
 * Does not throw errors - logs them instead.
 *
 * @param userGithubId - GitHub user ID
 * @param username - GitHub username
 * @param accessToken - GitHub OAuth access token for the user
 * @param force - If true, bypass the freshness check and always sync
 * @returns Result object with sync statistics
 */
export async function syncStarredRepos(
  userGithubId: number,
  username: string,
  accessToken: string,
  force: boolean = false,
): Promise<SyncStarredReposResult> {
  const result: SyncStarredReposResult = {
    reposSynced: 0,
    starsUpserted: 0,
    staleStarsRemoved: 0,
  };

  try {
    // Check if sync is needed (unless forced)
    if (!force) {
      const needsSync = await shouldSyncStars(userGithubId);
      if (!needsSync) {
        console.log(
          `[syncStarredRepos] Skipping sync for user ${username} (${userGithubId}): data is fresh`,
        );
        return result;
      }
    } else {
      console.log(
        `[syncStarredRepos] Force syncing for user ${username} (${userGithubId})`,
      );
    }

    console.log(
      `[syncStarredRepos] Starting sync for user ${username} (${userGithubId})`,
    );

    // Fetch starred repos using user's access token
    const starredRepos = await fetchStarredRepos(username, accessToken);
    console.log(
      `[syncStarredRepos] Fetched ${starredRepos.length} starred repos from GitHub API`,
    );

    // Upsert user into github_users with profile data
    const enrichedUser = await enrichUserWithProfile(
      {
        github_id: userGithubId,
        login: username,
        avatar_url: null,
        name: null,
        type: "User",
      },
      accessToken,
    );
    await upsertGitHubUser(enrichedUser);

    // Get all existing repo IDs from the database
    const existingReposResult = await query<{ github_id: number }>(
      `SELECT github_id FROM repos`,
    );
    // Ensure all IDs are numbers (PostgreSQL might return them as strings)
    const existingRepoIds = new Set(
      existingReposResult.rows.map((r) => Number(r.github_id)),
    );
    console.log(
      `[syncStarredRepos] Found ${existingRepoIds.size} repos in database`,
    );

    // Only sync stars for repos that already exist in the database
    const currentRepoIds: number[] = [];
    let skippedCount = 0;
    for (const repo of starredRepos) {
      // Ensure repo.id is a number for Set lookup (PostgreSQL returns bigint as string)
      const repoId = Number(repo.id);
      // Skip repos that don't exist in our database
      if (!existingRepoIds.has(repoId)) {
        skippedCount++;
        continue;
      }

      // Upsert star (use starred_at from API)
      await upsertStar(userGithubId, repo.id, repo.starred_at);
      currentRepoIds.push(repo.id);
      result.starsUpserted++;
    }

    if (skippedCount > 0) {
      console.log(
        `[syncStarredRepos] Skipped ${skippedCount} starred repos that don't exist in database (only syncing stars for repos already in the repos table)`,
      );
    }

    // Remove stale stars (repos that were unstarred)
    const beforeDelete = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count
       FROM repo_stars
       WHERE user_github_id = $1`,
      [userGithubId],
    );
    const starsBeforeDelete = beforeDelete.rows[0]?.count || 0;

    await deleteStaleStars(userGithubId, currentRepoIds);

    const afterDelete = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count
       FROM repo_stars
       WHERE user_github_id = $1`,
      [userGithubId],
    );
    const starsAfterDelete = afterDelete.rows[0]?.count || 0;
    result.staleStarsRemoved = starsBeforeDelete - starsAfterDelete;

    result.reposSynced = currentRepoIds.length;

    console.log(
      `[syncStarredRepos] Completed sync for user ${username} (${userGithubId}): ` +
        `${starredRepos.length} starred repos found, ` +
        `${result.reposSynced} repos synced, ${result.starsUpserted} stars upserted, ` +
        `${result.staleStarsRemoved} stale stars removed`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.error = errorMessage;
    console.error(
      `[syncStarredRepos] Error syncing starred repos for user ${username} (${userGithubId}):`,
      errorMessage,
    );
  }

  return result;
}
