/**
 * Repository Database Operations
 *
 * Provides functions for upserting repository data.
 */

import { query } from "./index.js";
import type { Repo } from "../github/repos.js";

/**
 * Upserts a repository into the database.
 * Inserts if the repository doesn't exist, updates if it does.
 *
 * @param githubRepo - Repository data from GitHub API
 */
export async function upsertRepo(githubRepo: Repo): Promise<void> {
  await query(
    `INSERT INTO repos (
      github_id, name, full_name, private, archived,
      pushed_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (github_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      full_name = EXCLUDED.full_name,
      private = EXCLUDED.private,
      archived = EXCLUDED.archived,
      pushed_at = EXCLUDED.pushed_at,
      updated_at = EXCLUDED.updated_at`,
    [
      githubRepo.id, // github_id
      githubRepo.name,
      githubRepo.full_name,
      githubRepo.private,
      githubRepo.archived,
      githubRepo.pushed_at,
      githubRepo.updated_at,
    ],
  );
}
