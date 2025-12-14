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
 * Only syncs if needed (no stars or stale data).
 * Does not throw errors - logs them instead.
 *
 * @param userGithubId - GitHub user ID
 * @param username - GitHub username
 * @param accessToken - GitHub OAuth access token for the user
 * @returns Result object with sync statistics
 */
export async function syncStarredRepos(
  userGithubId: number,
  username: string,
  accessToken: string,
): Promise<SyncStarredReposResult> {
  const result: SyncStarredReposResult = {
    reposSynced: 0,
    starsUpserted: 0,
    staleStarsRemoved: 0,
  };

  try {
    // Check if sync is needed
    const needsSync = await shouldSyncStars(userGithubId);
    if (!needsSync) {
      console.log(
        `[syncStarredRepos] Skipping sync for user ${username} (${userGithubId}): data is fresh`,
      );
      return result;
    }

    console.log(
      `[syncStarredRepos] Starting sync for user ${username} (${userGithubId})`,
    );

    // Fetch starred repos using user's access token
    const starredRepos = await fetchStarredRepos(username, accessToken);

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
    const existingRepoIds = new Set(
      existingReposResult.rows.map((r) => r.github_id),
    );

    // Only sync stars for repos that already exist in the database
    const currentRepoIds: number[] = [];
    for (const repo of starredRepos) {
      // Skip repos that don't exist in our database
      if (!existingRepoIds.has(repo.id)) {
        continue;
      }

      // Upsert star (use starred_at from API)
      await upsertStar(userGithubId, repo.id, repo.starred_at);
      currentRepoIds.push(repo.id);
      result.starsUpserted++;
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
        `${result.reposSynced} repos, ${result.starsUpserted} stars upserted, ` +
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
