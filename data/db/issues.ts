/**
 * Issue Database Operations
 *
 * Provides functions for upserting issue data.
 */

import { query } from "./index.js";
import type { Issue } from "../github/issues.js";

/**
 * Upserts an issue into the database.
 * Inserts if the issue doesn't exist, updates if it does.
 *
 * @param githubIssue - Issue data from GitHub API
 * @param repoGithubId - GitHub ID of the repository this issue belongs to
 */
export async function upsertIssue(
  githubIssue: Issue,
  repoGithubId: number,
): Promise<void> {
  await query(
    `INSERT INTO issues (
      github_id, repo_github_id, number, title, body, state,
      created_at, updated_at, closed_at, labels, assignees, author_login
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (github_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      state = EXCLUDED.state,
      updated_at = EXCLUDED.updated_at,
      closed_at = EXCLUDED.closed_at,
      labels = EXCLUDED.labels,
      assignees = EXCLUDED.assignees,
      synced_at = NOW()`,
    [
      githubIssue.id, // github_id
      repoGithubId, // repo_github_id
      githubIssue.number,
      githubIssue.title,
      githubIssue.body,
      githubIssue.state,
      githubIssue.created_at,
      githubIssue.updated_at,
      githubIssue.closed_at,
      JSON.stringify(githubIssue.labels), // Convert to JSONB
      JSON.stringify(githubIssue.assignees), // Convert to JSONB
      githubIssue.user.login, // author_login
    ],
  );
}
