/**
 * Repo Maintainers Database Operations
 *
 * Provides functions for managing maintainership relationships between repositories and GitHub users.
 */

import { query } from "./index.js";

/**
 * Upserts a maintainership relationship into the database.
 * Inserts if the relationship doesn't exist, updates if it does.
 * Updates last_confirmed_at timestamp on existing relationships.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @param githubUserId - GitHub ID of the user
 * @param source - Source of the maintainership assertion (e.g., "github-permissions", "bcr-metadata", "codeowners", "manual")
 * @param confidence - Confidence level (0-100) in this maintainership assertion
 */
export async function upsertMaintainer(
  repoGithubId: number,
  githubUserId: number,
  source: string,
  confidence: number = 100,
): Promise<void> {
  await query(
    `INSERT INTO repo_maintainers (
      repo_github_id, github_user_id, source, confidence,
      first_detected_at, last_confirmed_at
    ) VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (repo_github_id, github_user_id, source)
    DO UPDATE SET
      confidence = EXCLUDED.confidence,
      last_confirmed_at = NOW()`,
    [repoGithubId, githubUserId, source, confidence],
  );
}

/**
 * Gets the GitHub user ID for a given login.
 *
 * @param login - GitHub username/login
 * @returns GitHub user ID, or null if not found
 */
export async function getGitHubUserIdByLogin(
  login: string,
): Promise<number | null> {
  const result = await query<{ github_id: number }>(
    `SELECT github_id FROM github_users WHERE login = $1`,
    [login],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].github_id;
}
