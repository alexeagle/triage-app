/**
 * Sync Worker - GitHub Issue Comments Synchronization
 *
 * Synchronizes comments for all open issues from the database
 * to the Postgres issue_comments table.
 */

import { GitHubAPI } from "../github/client.js";
import { query } from "../db/index.js";
import { closePool } from "../db/index.js";
import { upsertIssueComment } from "../db/issueComments.js";
import { fetchIssueComments } from "../github/issues.js";

interface IssueWithRepo {
  github_id: number;
  number: number;
  repo_full_name: string;
  owner_login: string;
  repo_name: string;
}

/**
 * Synchronizes comments for all open issues.
 *
 * @returns Promise resolving to the number of comments synced
 */
export async function syncIssueComments(): Promise<number> {
  console.log("🚀 Starting issue comments sync...\n");

  // Initialize GitHub API client
  const api = new GitHubAPI();

  let totalCommentsSynced = 0;

  try {
    // Fetch all open issues with their repository information
    const issues = await query<IssueWithRepo>(
      `SELECT 
        i.github_id,
        i.number,
        r.full_name as repo_full_name,
        SPLIT_PART(r.full_name, '/', 1) as owner_login,
        SPLIT_PART(r.full_name, '/', 2) as repo_name
      FROM issues i
      INNER JOIN repos r ON i.repo_github_id = r.github_id
      WHERE i.state = 'open'
      ORDER BY i.github_id`,
    );

    console.log(
      `📋 Found ${issues.rows.length} open issues to sync comments for\n`,
    );

    // Process each issue
    for (let i = 0; i < issues.rows.length; i++) {
      const issue = issues.rows[i];
      const issueNum = i + 1;

      try {
        // Validate repo information
        if (!issue.owner_login || !issue.repo_name) {
          console.warn(
            `  ⚠ Issue #${issue.number} (${issue.github_id}): Invalid repo full_name format: ${issue.repo_full_name}`,
          );
          continue;
        }

        // Fetch comments from GitHub API
        const repo = {
          id: 0, // Not needed for fetching comments
          name: issue.repo_name,
          full_name: issue.repo_full_name,
          owner: { login: issue.owner_login },
          private: false,
          archived: false,
          pushed_at: null,
          updated_at: "",
        };
        const comments = await fetchIssueComments(repo, issue.number, api);

        // Upsert each comment
        let issueCommentsCount = 0;
        for (const comment of comments) {
          await upsertIssueComment({
            issue_github_id: issue.github_id,
            comment_github_id: comment.id,
            author_login: comment.user.login,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
          });
          issueCommentsCount++;
        }

        totalCommentsSynced += issueCommentsCount;

        if (issueCommentsCount > 0) {
          console.log(
            `[${issueNum}/${issues.rows.length}] Issue #${issue.number} (${issue.repo_full_name}): ${issueCommentsCount} comments synced`,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `  ❌ Error syncing comments for issue #${issue.number} (${issue.github_id}): ${errorMessage}`,
        );
        // Continue with next issue
      }
    }

    console.log(`\n✨ Comments sync completed!`);
    console.log(`📊 Total comments synced: ${totalCommentsSynced}\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Fatal error during comments sync: ${errorMessage}`);
    throw error;
  }

  return totalCommentsSynced;
}

/**
 * Main function for running the comments sync worker.
 */
export async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  if (
    !process.env.APP_ID ||
    !process.env.PRIVATE_KEY ||
    !process.env.INSTALLATION_ID
  ) {
    console.error(
      "❌ GitHub App credentials required: APP_ID, PRIVATE_KEY, INSTALLATION_ID",
    );
    process.exit(1);
  }

  try {
    await syncIssueComments();
  } catch (error) {
    console.error("Comments sync failed:", error);
    process.exit(1);
  } finally {
    // Close database connection pool
    await closePool();
  }
}

// Execute main() if this file is run directly (not imported as a module)
if (process.argv[1]?.includes("syncIssueComments")) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
