/**
 * Sync Worker - GitHub Issue Reactions Synchronization
 *
 * Synchronizes reactions for all open issues from the database
 * to the Postgres issue_reactions table.
 */

import { GitHubAPI } from "../github/client.js";
import { query } from "../db/index.js";
import { closePool } from "../db/index.js";

interface IssueWithRepo {
  github_id: number;
  number: number;
  repo_full_name: string;
}

interface GitHubReaction {
  id: number;
  user: {
    id: number;
    login: string;
  };
  content: string;
  created_at: string;
}

// Allowed reaction types
const ALLOWED_REACTION_TYPES = new Set([
  "+1",
  "-1",
  "laugh",
  "confused",
  "heart",
  "hooray",
  "rocket",
  "eyes",
]);

/**
 * Fetches all reactions for a specific issue from GitHub API.
 * Handles pagination automatically.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @param api - GitHub API client instance
 * @returns Array of reactions
 */
async function fetchIssueReactions(
  owner: string,
  repo: string,
  issueNumber: number,
  api: GitHubAPI,
): Promise<GitHubReaction[]> {
  const allReactions: GitHubReaction[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const reactions = await api.request<GitHubReaction[]>({
      method: "GET",
      url: "/repos/{owner}/{repo}/issues/{issue_number}/reactions",
      owner,
      repo,
      issue_number: issueNumber,
      page,
      per_page: perPage,
      headers: {
        accept: "application/vnd.github+json",
      },
    });

    if (reactions.length === 0) {
      break;
    }

    allReactions.push(...reactions);

    // If we got fewer than perPage results, we're on the last page
    if (reactions.length < perPage) {
      break;
    }

    page++;
  }

  return allReactions;
}

/**
 * Upserts a reaction into the issue_reactions table.
 *
 * @param issueGithubId - GitHub ID of the issue
 * @param userGithubId - GitHub ID of the user who reacted
 * @param content - Reaction content (e.g., "+1", "heart")
 * @param createdAt - When the reaction was created
 * @returns Promise resolving to the number of rows affected
 */
async function upsertReaction(
  issueGithubId: number,
  userGithubId: number,
  content: string,
  createdAt: string,
): Promise<number> {
  const result = await query(
    `INSERT INTO issue_reactions (
      issue_github_id, user_github_id, content, created_at
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (issue_github_id, user_github_id, content)
    DO UPDATE SET
      synced_at = NOW()`,
    [issueGithubId, userGithubId, content, createdAt],
  );

  return result.rowCount || 0;
}

/**
 * Synchronizes reactions for all open issues.
 *
 * @returns Promise resolving to the number of reactions synced
 */
export async function syncIssueReactions(): Promise<number> {
  console.log("🚀 Starting issue reactions sync...\n");

  // Initialize GitHub API client
  const api = new GitHubAPI();

  let totalReactionsSynced = 0;

  try {
    // Fetch all open issues with their repository information
    const issues = await query<IssueWithRepo>(
      `SELECT 
        i.github_id,
        i.number,
        r.full_name as repo_full_name
      FROM issues i
      INNER JOIN repos r ON i.repo_github_id = r.github_id
      WHERE i.state = 'open'
      ORDER BY i.github_id`,
    );

    console.log(
      `📋 Found ${issues.rows.length} open issues to sync reactions for\n`,
    );

    // Process each issue
    for (let i = 0; i < issues.rows.length; i++) {
      const issue = issues.rows[i];
      const issueNum = i + 1;

      try {
        // Parse owner and repo from full_name (format: "owner/repo")
        const [owner, repo] = issue.repo_full_name.split("/");
        if (!owner || !repo) {
          console.warn(
            `  ⚠ Issue #${issue.number} (${issue.github_id}): Invalid repo full_name format: ${issue.repo_full_name}`,
          );
          continue;
        }

        // Fetch reactions from GitHub API
        const reactions = await fetchIssueReactions(
          owner,
          repo,
          issue.number,
          api,
        );

        // Filter to only allowed reaction types
        const allowedReactions = reactions.filter((reaction) =>
          ALLOWED_REACTION_TYPES.has(reaction.content),
        );

        // Upsert each reaction
        let issueReactionsCount = 0;
        for (const reaction of allowedReactions) {
          await upsertReaction(
            issue.github_id,
            reaction.user.id,
            reaction.content,
            reaction.created_at,
          );
          issueReactionsCount++;
        }

        totalReactionsSynced += issueReactionsCount;

        if (issueReactionsCount > 0 || reactions.length > 0) {
          console.log(
            `[${issueNum}/${issues.rows.length}] Issue #${issue.number} (${issue.repo_full_name}): ${issueReactionsCount} reactions synced (${reactions.length} total, ${reactions.length - issueReactionsCount} filtered out)`,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `  ❌ Error syncing reactions for issue #${issue.number} (${issue.github_id}): ${errorMessage}`,
        );
        // Continue with next issue
      }
    }

    console.log(`\n✨ Reactions sync completed!`);
    console.log(`📊 Total reactions synced: ${totalReactionsSynced}\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Fatal error during reactions sync: ${errorMessage}`);
    throw error;
  }

  return totalReactionsSynced;
}

/**
 * Main function for running the reactions sync worker.
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
    await syncIssueReactions();
  } catch (error) {
    console.error("Reactions sync failed:", error);
    process.exit(1);
  } finally {
    // Close database connection pool
    await closePool();
  }
}

// Execute main() if this file is run directly (not imported as a module)
if (process.argv[1]?.includes("syncIssueReactions")) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
