/**
 * Issue Comments Database Operations
 *
 * Provides functions for upserting issue comment data.
 */

import { query } from "./index.js";

export interface IssueCommentInput {
  issue_github_id: number;
  comment_github_id: number;
  author_login: string;
  body: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Upserts an issue comment into the database.
 * Inserts if the comment doesn't exist, updates if it does.
 *
 * @param comment - Issue comment data
 * @returns Promise resolving to the number of rows affected
 */
export async function upsertIssueComment(
  comment: IssueCommentInput,
): Promise<number> {
  const result = await query(
    `INSERT INTO issue_comments (
      issue_github_id, comment_github_id, author_login, body,
      created_at, updated_at, synced_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (comment_github_id)
    DO UPDATE SET
      issue_github_id = EXCLUDED.issue_github_id,
      author_login = EXCLUDED.author_login,
      body = EXCLUDED.body,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      synced_at = NOW()`,
    [
      comment.issue_github_id,
      comment.comment_github_id,
      comment.author_login,
      comment.body,
      comment.created_at,
      comment.updated_at,
    ],
  );

  return result.rowCount || 0;
}
