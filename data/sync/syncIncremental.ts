/**
 * Incremental Sync Worker - GitHub Issues and PRs Synchronization
 *
 * Synchronizes only updated issues and PRs from repositories using sync state.
 * This is designed to be run periodically (e.g., via GitHub Actions).
 */

import { GitHubAPI } from "../github/client.js";
import { fetchOrgRepos, type Repo } from "../github/repos.js";
import {
  fetchRepoIssues,
  fetchUpdatedIssuesSince,
  fetchClosedIssuesSince,
  type Issue,
} from "../github/issues.js";
import {
  fetchRepoPullRequests,
  fetchPullRequestFileStats,
  fetchPullRequestReviews,
  type PullRequest,
  type PullRequestReview,
} from "../github/pullRequests.js";
import { upsertRepo } from "../db/repos.js";
import { upsertIssue } from "../db/issues.js";
import { upsertPullRequest } from "../db/pullRequests.js";
import { replacePullRequestReviews } from "../db/pullRequests.js";
import {
  getSyncState,
  upsertIssueSyncTime,
  upsertPrSyncTime,
} from "../db/syncState.js";
import { closePool } from "../db/index.js";
import { upsertGitHubUser } from "../db/githubUsers.js";
import { enrichCompanyDataForUserAsync } from "../db/enrichCompanyData.js";

export interface IncrementalSyncResult {
  reposProcessed: number;
  reposSkipped: number;
  issuesSynced: number;
  prsSynced: number;
  errors: Array<{ repo: string; error: string }>;
}

/**
 * Synchronizes updated issues and PRs from all repositories in an organization.
 * Uses sync state to only fetch items updated since the last sync.
 *
 * @param orgOrUser - GitHub organization or user name
 * @returns Promise resolving to sync result statistics
 */
export async function syncIncremental(
  orgOrUser: string,
): Promise<IncrementalSyncResult> {
  const result: IncrementalSyncResult = {
    reposProcessed: 0,
    reposSkipped: 0,
    issuesSynced: 0,
    prsSynced: 0,
    errors: [],
  };

  console.log(`🚀 Starting incremental sync for: ${orgOrUser}\n`);

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

        // Get sync state for this repo
        const syncState = await getSyncState(repo.id);

        // Sync issues (incremental if sync state exists, otherwise full)
        let repoIssuesCount = 0;
        if (syncState?.last_issue_sync) {
          console.log(
            `  📋 Incremental issue sync (since ${syncState.last_issue_sync})...`,
          );

          // Use a Set to track processed issue IDs to avoid duplicates
          const processedIssueIds = new Set<number>();

          // Helper function to process an issue
          const processIssue = async (issue: Issue) => {
            // Skip if we've already processed this issue
            if (processedIssueIds.has(issue.id)) {
              return;
            }
            processedIssueIds.add(issue.id);

            try {
              await upsertIssue(issue, repo.id);

              // Upsert issue author
              try {
                await upsertGitHubUser({
                  github_id: issue.user.id,
                  login: issue.user.login,
                  avatar_url: issue.user.avatar_url,
                  type: issue.user.type,
                });
                // Enrich with company data (fire-and-forget)
                enrichCompanyDataForUserAsync(issue.user.login, issue.user.id);
              } catch (error) {
                console.warn(
                  `  ⚠ Failed to upsert author ${issue.user.login}: ${error}`,
                );
              }

              // Upsert issue assignees
              for (const assignee of issue.assignees) {
                try {
                  await upsertGitHubUser({
                    github_id: assignee.id,
                    login: assignee.login,
                    avatar_url: assignee.avatar_url,
                    type: assignee.type,
                  });
                  // Enrich with company data (fire-and-forget)
                  enrichCompanyDataForUserAsync(assignee.login, assignee.id);
                } catch (error) {
                  console.warn(
                    `  ⚠ Failed to upsert assignee ${assignee.login}: ${error}`,
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
          };

          // Fetch updated issues (includes both open and closed that were updated)
          let updatedIssuesFetched = 0;
          for await (const batch of fetchUpdatedIssuesSince(
            repo,
            api,
            syncState.last_issue_sync,
          )) {
            updatedIssuesFetched += batch.issues.length;

            for (const issue of batch.issues) {
              await processIssue(issue);
            }
          }

          // Also fetch recently closed issues (to catch issues closed but not recently updated)
          let closedIssuesFetched = 0;
          for await (const batch of fetchClosedIssuesSince(
            repo,
            api,
            syncState.last_issue_sync,
          )) {
            closedIssuesFetched += batch.issues.length;

            for (const issue of batch.issues) {
              await processIssue(issue);
            }
          }

          // Count unique issues processed
          repoIssuesCount = processedIssueIds.size;

          if (closedIssuesFetched > 0) {
            console.log(
              `  ✅ Synced ${repoIssuesCount} unique issues (${updatedIssuesFetched} updated, ${closedIssuesFetched} recently closed)`,
            );
          } else {
            console.log(`  ✅ Synced ${repoIssuesCount} updated issues`);
          }
        } else {
          console.log(`  📋 Full issue sync (no previous sync state)...`);
          let batchCount = 0;
          for await (const batch of fetchRepoIssues(repo, api)) {
            batchCount++;
            repoIssuesCount += batch.issues.length;

            for (const issue of batch.issues) {
              try {
                await upsertIssue(issue, repo.id);

                // Upsert issue author
                try {
                  await upsertGitHubUser({
                    github_id: issue.user.id,
                    login: issue.user.login,
                    avatar_url: issue.user.avatar_url,
                    type: issue.user.type,
                  });
                  // Enrich with company data (fire-and-forget)
                  enrichCompanyDataForUserAsync(
                    issue.user.login,
                    issue.user.id,
                  );
                } catch (error) {
                  console.warn(
                    `  ⚠ Failed to upsert author ${issue.user.login}: ${error}`,
                  );
                }

                // Upsert issue assignees
                for (const assignee of issue.assignees) {
                  try {
                    await upsertGitHubUser({
                      github_id: assignee.id,
                      login: assignee.login,
                      avatar_url: assignee.avatar_url,
                      type: assignee.type,
                    });
                    // Enrich with company data (fire-and-forget)
                    enrichCompanyDataForUserAsync(assignee.login, assignee.id);
                  } catch (error) {
                    console.warn(
                      `  ⚠ Failed to upsert assignee ${assignee.login}: ${error}`,
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
          }
          console.log(
            `  ✅ Synced ${repoIssuesCount} issues across ${batchCount} batch(es)`,
          );
        }

        result.issuesSynced += repoIssuesCount;

        // Update issue sync timestamp
        await upsertIssueSyncTime(repo.id, new Date().toISOString());

        // Sync PRs (incremental if sync state exists, otherwise full)
        let repoPRsCount = 0;
        const lastPrSync = syncState?.last_pr_sync;
        const lastPrSyncDate = lastPrSync ? new Date(lastPrSync) : null;

        if (lastPrSyncDate) {
          console.log(`  📋 Incremental PR sync (since ${lastPrSyncDate})...`);
        } else {
          console.log(`  📋 Full PR sync (no previous sync state)...`);
        }

        // Fetch and sync PRs
        let batchCount = 0;
        let prsFiltered = 0;
        for await (const batch of fetchRepoPullRequests(repo, api)) {
          batchCount++;

          // Filter PRs by updated_at if doing incremental sync
          const prsToProcess = lastPrSyncDate
            ? batch.pullRequests.filter((pr) => {
                const prUpdated = new Date(pr.updated_at);
                return prUpdated >= lastPrSyncDate;
              })
            : batch.pullRequests;

          prsFiltered += batch.pullRequests.length - prsToProcess.length;
          repoPRsCount += prsToProcess.length;

          for (const pr of prsToProcess) {
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
                    return null;
                  },
                ),
                fetchPullRequestReviews(repo, pr.number, api).catch((error) => {
                  const errorMessage =
                    error instanceof Error ? error.message : String(error);
                  console.warn(
                    `  ⚠ Failed to fetch reviews for PR #${pr.number}: ${errorMessage}`,
                  );
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

              // Upsert PR author
              if (pr.author) {
                try {
                  await upsertGitHubUser({
                    github_id: pr.author.id,
                    login: pr.author.login,
                    avatar_url: pr.author.avatar_url,
                    type: pr.author.type,
                  });
                  // Enrich with company data (fire-and-forget)
                  enrichCompanyDataForUserAsync(pr.author.login, pr.author.id);
                } catch (error) {
                  console.warn(
                    `  ⚠ Failed to upsert author ${pr.author.login}: ${error}`,
                  );
                }
              }

              // Upsert PR assignees
              if (pr.assignees_full) {
                for (const assignee of pr.assignees_full) {
                  try {
                    await upsertGitHubUser({
                      github_id: assignee.id,
                      login: assignee.login,
                      avatar_url: assignee.avatar_url,
                      type: assignee.type,
                    });
                    // Enrich with company data (fire-and-forget)
                    enrichCompanyDataForUserAsync(assignee.login, assignee.id);
                  } catch (error) {
                    console.warn(
                      `  ⚠ Failed to upsert assignee ${assignee.login}: ${error}`,
                    );
                  }
                }
              }

              // Upsert PR reviewers
              for (const review of reviews) {
                try {
                  await upsertGitHubUser({
                    github_id: review.reviewer.id,
                    login: review.reviewer.login,
                    avatar_url: review.reviewer.avatar_url,
                    type: review.reviewer.type,
                  });
                  // Enrich with company data (fire-and-forget)
                  enrichCompanyDataForUserAsync(
                    review.reviewer.login,
                    review.reviewer.id,
                  );
                } catch (error) {
                  console.warn(
                    `  ⚠ Failed to upsert reviewer ${review.reviewer.login}: ${error}`,
                  );
                }
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              console.error(
                `  ❌ Failed to sync PR #${pr.number}: ${errorMessage}`,
              );
              result.errors.push({
                repo: repo.full_name,
                error: `PR #${pr.number}: ${errorMessage}`,
              });
            }
          }
        }

        result.prsSynced += repoPRsCount;

        // Update PR sync timestamp
        await upsertPrSyncTime(repo.id, new Date().toISOString());

        result.reposProcessed++;
        if (prsFiltered > 0) {
          console.log(
            `  ✅ Completed: ${repoIssuesCount} issues, ${repoPRsCount} PRs (${prsFiltered} PRs skipped - no updates since last sync)\n`,
          );
        } else {
          console.log(
            `  ✅ Completed: ${repoIssuesCount} issues, ${repoPRsCount} PRs\n`,
          );
        }
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
      }
    }

    // Print summary
    console.log("✨ Incremental sync completed!\n");
    console.log(`📊 Summary:`);
    console.log(`   Repositories processed: ${result.reposProcessed}`);
    console.log(`   Repositories skipped: ${result.reposSkipped}`);
    console.log(`   Total issues synced: ${result.issuesSynced}`);
    console.log(`   Total PRs synced: ${result.prsSynced}`);
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
 * Main function for running the incremental sync worker.
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
    await syncIncremental(orgOrUser);
  } catch (error) {
    console.error("Incremental sync failed:", error);
    process.exit(1);
  } finally {
    // Close database connection pool
    await closePool();
  }
}

// Execute main() if this file is run directly
if (process.argv[1]?.includes("syncIncremental")) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
