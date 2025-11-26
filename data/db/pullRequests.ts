/**
 * Pull Request Database Operations
 *
 * Provides functions for upserting pull request data.
 */

import { query } from "./index.js";
import type { PullRequest } from "../github/pullRequests.js";
import type { PullRequestReview } from "../github/pullRequests.js";

/**
 * Upserts a pull request into the database.
 * Inserts if the pull request doesn't exist, updates if it does.
 * Uses github_id as the conflict target.
 *
 * @param pr - Pull request data from GitHub API (normalized)
 * @param repoGithubId - GitHub ID of the repository this PR belongs to
 */
export async function upsertPullRequest(
  pr: PullRequest,
  repoGithubId: number,
): Promise<void> {
  await query(
    `INSERT INTO pull_requests (
      github_id, repo_github_id, number, title, body, state, draft,
      author_login, assignees, labels, additions, deletions, changed_files,
      merged, merged_at, merge_commit_sha, created_at, updated_at, closed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (github_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      state = EXCLUDED.state,
      draft = EXCLUDED.draft,
      author_login = EXCLUDED.author_login,
      assignees = EXCLUDED.assignees,
      labels = EXCLUDED.labels,
      additions = EXCLUDED.additions,
      deletions = EXCLUDED.deletions,
      changed_files = EXCLUDED.changed_files,
      merged = EXCLUDED.merged,
      merged_at = EXCLUDED.merged_at,
      merge_commit_sha = EXCLUDED.merge_commit_sha,
      updated_at = EXCLUDED.updated_at,
      closed_at = EXCLUDED.closed_at,
      synced_at = NOW()`,
    [
      pr.id, // github_id
      repoGithubId, // repo_github_id
      pr.number,
      pr.title,
      pr.body,
      pr.state,
      pr.draft,
      pr.author_login,
      JSON.stringify(pr.assignees), // Convert to JSONB
      JSON.stringify(pr.labels), // Convert to JSONB
      pr.additions,
      pr.deletions,
      pr.changed_files,
      pr.merged,
      pr.merged_at,
      pr.merge_commit_sha,
      pr.created_at,
      pr.updated_at,
      pr.closed_at,
    ],
  );
}

/**
 * Replaces all reviews for a pull request.
 * Deletes existing reviews and inserts the new ones.
 *
 * @param prGithubId - GitHub ID of the pull request
 * @param reviews - Array of pull request reviews
 */
export async function replacePullRequestReviews(
  prGithubId: number,
  reviews: PullRequestReview[],
): Promise<void> {
  // Delete existing reviews for this PR
  await query(`DELETE FROM pull_request_reviews WHERE pr_github_id = $1`, [
    prGithubId,
  ]);

  // Insert new reviews
  if (reviews.length === 0) {
    return;
  }

  // Use a single INSERT with multiple VALUES for efficiency
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  for (const review of reviews) {
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`,
    );
    values.push(
      prGithubId,
      review.reviewer_login,
      review.submitted_at,
      review.state,
    );
    paramIndex += 4;
  }

  await query(
    `INSERT INTO pull_request_reviews (pr_github_id, reviewer_login, submitted_at, state)
     VALUES ${placeholders.join(", ")}`,
    values,
  );
}
