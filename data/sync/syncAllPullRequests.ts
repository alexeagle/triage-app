/**
 * Sync Worker - GitHub Pull Requests Synchronization
 *
 * Synchronizes all pull requests from repositories in a GitHub organization
 * to the Postgres database.
 */

import { GitHubAPI } from "../github/client.js";
import { fetchOrgRepos, type Repo } from "../github/repos.js";
import {
  fetchRepoPullRequests,
  fetchPullRequestFileStats,
  fetchPullRequestReviews,
  type PullRequest,
  type FileStats,
  type PullRequestReview,
} from "../github/pullRequests.js";
import { upsertPullRequest } from "../db/pullRequests.js";
import { replacePullRequestReviews } from "../db/pullRequests.js";
import { closePool } from "../db/index.js";

export interface PRSyncResult {
  reposProcessed: number;
  reposSkipped: number;
  prsSynced: number;
  errors: Array<{ repo: string; pr?: number; error: string }>;
}

/**
 * Synchronizes all pull requests from repositories in a GitHub organization.
 *
 * @param orgOrUser - GitHub organization or user name
 * @returns Promise resolving to sync result statistics
 */
export async function syncAllPullRequests(
  orgOrUser: string,
): Promise<PRSyncResult> {
  const result: PRSyncResult = {
    reposProcessed: 0,
    reposSkipped: 0,
    prsSynced: 0,
    errors: [],
  };

  console.log(`🚀 Starting PR sync for: ${orgOrUser}\n`);

  // Initialize GitHub API client
  const api = new GitHubAPI();

  try {
    // Fetch all repositories (same as syncAllIssues)
    console.log(`📦 Fetching repositories for ${orgOrUser}...`);
    const repos = await fetchOrgRepos(orgOrUser, api);
    console.log(`✅ Found ${repos.length} repositories\n`);

    // Process each repository
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      const repoNum = i + 1;

      try {
        console.log(
          `[${repoNum}/${repos.length}] Processing PRs for ${repo.full_name}...`,
        );

        let repoPRsCount = 0;
        let batchCount = 0;

        // Fetch pull requests for this repo
        for await (const batch of fetchRepoPullRequests(repo, api)) {
          batchCount++;
          repoPRsCount += batch.pullRequests.length;

          console.log(
            `  📄 Batch ${batchCount}: ${batch.pullRequests.length} PRs (${repoPRsCount} total so far)`,
          );

          // Process each PR in the batch
          for (const pr of batch.pullRequests) {
            try {
              // Fetch file stats and reviews for this PR
              const [fileStats, reviews] = await Promise.all([
                fetchPullRequestFileStats(repo, pr.number, api).catch(
                  (error) => {
                    const errorMessage =
                      error instanceof Error ? error.message : String(error);
                    console.warn(
                      `  ⚠ Failed to fetch file stats for PR #${pr.number}: ${errorMessage}`,
                    );
                    // Return null stats if fetch fails
                    return null;
                  },
                ),
                fetchPullRequestReviews(repo, pr.number, api).catch((error) => {
                  const errorMessage =
                    error instanceof Error ? error.message : String(error);
                  console.warn(
                    `  ⚠ Failed to fetch reviews for PR #${pr.number}: ${errorMessage}`,
                  );
                  // Return empty array if fetch fails
                  return [];
                }),
              ]);

              // Merge file stats into PR object if available
              const normalizedPR: PullRequest = {
                ...pr,
                additions: fileStats?.additions ?? pr.additions,
                deletions: fileStats?.deletions ?? pr.deletions,
                changed_files: fileStats?.changed_files ?? pr.changed_files,
              };

              // Upsert the pull request
              await upsertPullRequest(normalizedPR, repo.id);

              // Replace reviews for this PR
              await replacePullRequestReviews(pr.id, reviews);

              console.log(
                `  ✓ PR #${pr.number}: ${pr.title} (${reviews.length} reviews)`,
              );
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              console.error(
                `  ❌ Failed to sync PR #${pr.number}: ${errorMessage}`,
              );
              result.errors.push({
                repo: repo.full_name,
                pr: pr.number,
                error: errorMessage,
              });
            }
          }
        }

        result.prsSynced += repoPRsCount;
        result.reposProcessed++;

        console.log(
          `  ✅ Completed: ${repoPRsCount} PRs synced across ${batchCount} batch(es)\n`,
        );
      } catch (error) {
        result.reposSkipped++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `  ❌ Error processing PRs for ${repo.full_name}: ${errorMessage}\n`,
        );
        result.errors.push({
          repo: repo.full_name,
          error: errorMessage,
        });
        // Continue with next repo
      }
    }

    // Print summary
    console.log("✨ PR sync completed!\n");
    console.log(`📊 Summary:`);
    console.log(`   Repositories processed: ${result.reposProcessed}`);
    console.log(`   Repositories skipped: ${result.reposSkipped}`);
    console.log(`   Total PRs synced: ${result.prsSynced}`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`\n⚠️  Errors encountered:`);
      result.errors.forEach((err) => {
        if (err.pr) {
          console.log(`   - ${err.repo} PR #${err.pr}: ${err.error}`);
        } else {
          console.log(`   - ${err.repo}: ${err.error}`);
        }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Fatal error during PR sync: ${errorMessage}`);
    throw error;
  }

  return result;
}

/**
 * Main function for running the PR sync worker.
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
    await syncAllPullRequests(orgOrUser);
  } catch (error) {
    console.error("PR sync failed:", error);
    process.exit(1);
  } finally {
    // Close database connection pool
    await closePool();
  }
}

// Execute main() if this file is run directly (not imported as a module)
// Simple check: if process.argv[1] contains this filename, we're running directly
if (process.argv[1]?.includes("syncAllPullRequests")) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
