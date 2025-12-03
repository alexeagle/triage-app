/**
 * GitHub Users Database Operations
 *
 * Provides functions for upserting GitHub user data and managing maintainer status.
 */

import { query } from "./index.js";

export interface GitHubUserInput {
  github_id: number;
  login: string;
  avatar_url?: string | null;
  name?: string | null;
  type?: string | null;
}

/**
 * Upserts a GitHub user into the database.
 * Inserts if the user doesn't exist, updates if it does.
 * Updates last_seen timestamp on existing users.
 * Updates avatar_url, name, and type if they have changed.
 *
 * @param user - GitHub user data
 */
export async function upsertGitHubUser(user: GitHubUserInput): Promise<void> {
  await query(
    `INSERT INTO github_users (
      github_id, login, avatar_url, name, type, first_seen, last_seen
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (github_id)
    DO UPDATE SET
      login = EXCLUDED.login,
      avatar_url = EXCLUDED.avatar_url,
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      last_seen = NOW()`,
    [
      user.github_id,
      user.login,
      user.avatar_url ?? null,
      user.name ?? null,
      user.type ?? null,
    ],
  );
}

/**
 * Marks a GitHub user as a maintainer by appending the source to maintainer_sources
 * and setting is_maintainer to true.
 * Deduplicates the source string if it already exists in the array.
 *
 * @param github_id - GitHub ID of the user
 * @param source - Source string to add (e.g., "github-app", "bcr-metadata")
 */
export async function markMaintainer(
  github_id: number,
  source: string,
): Promise<void> {
  await query(
    `UPDATE github_users
     SET 
       maintainer_sources = CASE 
         WHEN maintainer_sources @> jsonb_build_array($2::text)
         THEN maintainer_sources
         ELSE maintainer_sources || jsonb_build_array($2::text)
       END,
       is_maintainer = true
     WHERE github_id = $1`,
    [github_id, source],
  );
}
