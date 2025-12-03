/**
 * Sync Worker - GitHub Issues Synchronization
 *
 * Synchronizes all repositories and issues from a GitHub organization
 * to the Postgres database.
 */

import { GitHubAPI } from "../github/client.js";
import { fetchOrgRepos, type Repo } from "../github/repos.js";
import { fetchRepoIssues, type Issue } from "../github/issues.js";
import { upsertRepo } from "../db/repos.js";
import { upsertIssue } from "../db/issues.js";
import { closePool } from "../db/index.js";
import { upsertGitHubUser } from "../db/githubUsers.js";

export interface SyncResult {
  reposProcessed: number;
  reposSkipped: number;
  issuesSynced: number;
  errors: Array<{ repo: string; error: string }>;
}

/**
 * Synchronizes all repositories and issues from a GitHub organization.
 *
 * @param orgOrUser - GitHub organization or user name
 * @returns Promise resolving to sync result statistics
 */
export async function syncAllIssues(orgOrUser: string): Promise<SyncResult> {
  const result: SyncResult = {
    reposProcessed: 0,
    reposSkipped: 0,
    issuesSynced: 0,
    errors: [],
  };

  console.log(`🚀 Starting sync for: ${orgOrUser}\n`);

  // Initialize GitHub API client
  const api = new GitHubAPI();

  try {
    // Fetch all repositories
    console.log(`📦 Fetching repositories for ${orgOrUser}...`);
    const repos = await fetchOrgRepos(orgOrUser, api);
    console.log(`✅ Found ${repos.length} repositories\n`);

    // Process each repository
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      const repoNum = i + 1;

      try {
        console.log(
          `[${repoNum}/${repos.length}] Processing ${repo.full_name}...`,
        );

        // Upsert repository metadata
        await upsertRepo(repo);
        console.log(`  ✓ Repository metadata synced`);

        // Fetch and sync issues
        let repoIssuesCount = 0;
        let batchCount = 0;

        for await (const batch of fetchRepoIssues(repo, api)) {
          batchCount++;
          repoIssuesCount += batch.issues.length;

          // Upsert each issue in the batch
          for (const issue of batch.issues) {
            try {
              await upsertIssue(issue, repo.id);

              // Upsert issue author
              try {
                await upsertGitHubUser({
                  github_id: issue.user.id,
                  login: issue.user.login,
                  avatar_url: issue.user.avatar_url,
                  name: issue.user.name,
                  type: issue.user.type,
                });
              } catch (error) {
                // Log but don't fail the issue sync if user upsert fails
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                console.warn(
                  `  ⚠ Failed to upsert author ${issue.user.login} for issue #${issue.number}: ${errorMessage}`,
                );
              }

              // Upsert issue assignees
              for (const assignee of issue.assignees) {
                try {
                  await upsertGitHubUser({
                    github_id: assignee.id,
                    login: assignee.login,
                    avatar_url: assignee.avatar_url,
                    name: assignee.name,
                    type: assignee.type,
                  });
                } catch (error) {
                  // Log but don't fail the issue sync if user upsert fails
                  const errorMessage =
                    error instanceof Error ? error.message : String(error);
                  console.warn(
                    `  ⚠ Failed to upsert assignee ${assignee.login} for issue #${issue.number}: ${errorMessage}`,
                  );
                }
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              console.error(
                `  ⚠ Failed to upsert issue #${issue.number}: ${errorMessage}`,
              );
              result.errors.push({
                repo: repo.full_name,
                error: `Issue #${issue.number}: ${errorMessage}`,
              });
            }
          }

          if (batch.hasMore) {
            console.log(
              `  📄 Batch ${batchCount}: ${batch.issues.length} issues (${repoIssuesCount} total so far)`,
            );
          }
        }

        result.issuesSynced += repoIssuesCount;
        result.reposProcessed++;

        console.log(
          `  ✅ Completed: ${repoIssuesCount} issues synced across ${batchCount} batch(es)\n`,
        );
      } catch (error) {
        result.reposSkipped++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `  ❌ Error processing ${repo.full_name}: ${errorMessage}\n`,
        );
        result.errors.push({
          repo: repo.full_name,
          error: errorMessage,
        });
        // Continue with next repo
      }
    }

    // Print summary
    console.log("✨ Sync completed!\n");
    console.log(`📊 Summary:`);
    console.log(`   Repositories processed: ${result.reposProcessed}`);
    console.log(`   Repositories skipped: ${result.reposSkipped}`);
    console.log(`   Total issues synced: ${result.issuesSynced}`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`\n⚠️  Errors encountered:`);
      result.errors.forEach((err) => {
        console.log(`   - ${err.repo}: ${err.error}`);
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Fatal error during sync: ${errorMessage}`);
    throw error;
  }

  return result;
}

/**
 * Main function for running the sync worker.
 * Reads organization name from environment variable or command line argument.
 */
export async function main(): Promise<void> {
  const orgOrUser = process.env.GITHUB_ORG || process.argv[2];
  if (!orgOrUser) {
    console.error("❌ GITHUB_ORG or command line argument is required");
    process.exit(1);
  }

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
    await syncAllIssues(orgOrUser);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  } finally {
    // Close database connection pool
    await closePool();
  }
}

// Execute main() if this file is run directly (not imported as a module)
// Simple check: if process.argv[1] contains this filename, we're running directly
if (process.argv[1]?.includes("syncAllIssues")) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
