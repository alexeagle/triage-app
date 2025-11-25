/**
 * Manual test script for fetching pull requests from a GitHub repository.
 *
 * Usage:
 *   tsx src/manual-tests/listPullRequests.ts <repo>
 *   # or: pnpm test:prs <repo>
 *
 * Examples:
 *   tsx src/manual-tests/listPullRequests.ts bazel-contrib/bazel-lib
 *   tsx src/manual-tests/listPullRequests.ts bazel-lib  # assumes alexeagle org
 *
 * Required environment variables:
 *   - APP_ID: GitHub App ID
 *   - PRIVATE_KEY: GitHub App private key (PEM format)
 *   - INSTALLATION_ID: GitHub App installation ID
 */

import { GitHubAPI } from "../github/client.js";
import { fetchOrgRepos, Repo } from "../github/repos.js";
import {
  fetchRepoPullRequests,
  fetchPullRequestFileStats,
  fetchPullRequestReviews,
} from "../github/pullRequests.js";

async function findRepo(api: GitHubAPI, repoArg: string): Promise<Repo> {
  // If repoArg contains a slash, treat it as owner/repo
  if (repoArg.includes("/")) {
    const [owner, repoName] = repoArg.split("/", 2);
    // Fetch all repos to find the matching one
    const repos = await fetchOrgRepos(owner, api);
    const repo = repos.find((r) => r.name === repoName);
    if (!repo) {
      throw new Error(
        `Repository ${repoArg} not found in organization ${owner}`,
      );
    }
    return repo;
  }

  // Otherwise, assume alexeagle org and search for the repo
  const orgName = "alexeagle";
  const repos = await fetchOrgRepos(orgName, api);
  const repo = repos.find((r) => r.name === repoArg || r.full_name === repoArg);

  if (!repo) {
    throw new Error(
      `Repository "${repoArg}" not found in organization ${orgName}.\n` +
        `Available repos: ${repos
          .slice(0, 5)
          .map((r) => r.name)
          .join(", ")}${repos.length > 5 ? "..." : ""}`,
    );
  }

  return repo;
}

async function main() {
  // Get repo name from CLI args
  const repoArg = process.argv[2];

  if (!repoArg) {
    console.error("❌ Missing repository argument");
    console.error("\nUsage:");
    console.error("  tsx src/manual-tests/listPullRequests.ts <repo>");
    console.error("\nExamples:");
    console.error(
      "  tsx src/manual-tests/listPullRequests.ts bazel-contrib/bazel-lib",
    );
    console.error("  tsx src/manual-tests/listPullRequests.ts bazel-lib");
    process.exit(1);
  }

  console.log("Testing GitHub pull request fetching...\n");

  // Validate environment variables
  const requiredEnvVars = ["APP_ID", "PRIVATE_KEY", "INSTALLATION_ID"];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error("\nPlease set these variables before running the test.");
    process.exit(1);
  }

  try {
    // Initialize GitHub API client
    console.log("🔐 Authenticating with GitHub App...");
    const api = new GitHubAPI();

    // Find the repository
    console.log(`🔍 Looking up repository: ${repoArg}...`);
    const repo = await findRepo(api, repoArg);
    console.log(`✅ Found repository: ${repo.full_name}\n`);

    // Fetch pull requests using the async generator
    console.log(`📋 Fetching pull requests for ${repo.full_name}...\n`);

    let totalPRs = 0;
    let batchCount = 0;
    const prsToTestDetails: Array<{ number: number; title: string }> = [];

    for await (const batch of fetchRepoPullRequests(repo, api)) {
      batchCount++;
      totalPRs += batch.pullRequests.length;

      console.log(
        `Batch ${batchCount} (page ${batch.page}): ${batch.pullRequests.length} pull requests`,
      );

      // Print PR details
      batch.pullRequests.forEach((pr) => {
        console.log(`  #${pr.number}: ${pr.title}`);
        console.log(`    State: ${pr.state}`);
        console.log(`    Draft: ${pr.draft ? "Yes" : "No"}`);
        console.log(`    Merged: ${pr.merged ? "Yes" : "No"}`);
        console.log(`    Author: ${pr.author_login}`);
        console.log(`    Created: ${pr.created_at}`);
        console.log(`    Updated: ${pr.updated_at}`);
        if (pr.merged_at) {
          console.log(`    Merged at: ${pr.merged_at}`);
        }
        if (pr.closed_at) {
          console.log(`    Closed at: ${pr.closed_at}`);
        }
        if (pr.labels.length > 0) {
          console.log(`    Labels: ${pr.labels.map((l) => l.name).join(", ")}`);
        }
        if (pr.assignees.length > 0) {
          console.log(
            `    Assignees: ${pr.assignees.map((a) => a.login).join(", ")}`,
          );
        }
        if (pr.additions !== null || pr.deletions !== null) {
          console.log(
            `    File stats: +${pr.additions ?? 0} -${pr.deletions ?? 0} (${pr.changed_files ?? 0} files)`,
          );
        } else {
          console.log(
            `    File stats: Not available (may need separate fetch)`,
          );
        }
        console.log("");

        // Collect first few PRs to test detailed fetching
        if (prsToTestDetails.length < 3) {
          prsToTestDetails.push({ number: pr.number, title: pr.title });
        }
      });

      if (!batch.hasMore) {
        break;
      }
    }

    console.log(
      `\n✅ Successfully fetched ${totalPRs} pull requests across ${batchCount} batch(es)`,
    );

    // Test file stats and reviews for a few PRs
    if (prsToTestDetails.length > 0) {
      console.log(
        `\n🔍 Testing detailed PR fetching for ${prsToTestDetails.length} PR(s)...\n`,
      );

      for (const { number, title } of prsToTestDetails) {
        try {
          console.log(`Testing PR #${number}: ${title}`);

          // Fetch file stats
          const fileStats = await fetchPullRequestFileStats(repo, number, api);
          console.log(
            `  📊 File stats: +${fileStats.additions} -${fileStats.deletions} (${fileStats.changed_files} files)`,
          );

          // Fetch reviews
          const reviews = await fetchPullRequestReviews(repo, number, api);
          if (reviews.length > 0) {
            console.log(`  👥 Reviews (${reviews.length}):`);
            reviews.forEach((review) => {
              console.log(
                `    - ${review.reviewer_login}: ${review.state} (${review.submitted_at})`,
              );
            });
          } else {
            console.log(`  👥 Reviews: None`);
          }

          console.log("");
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `  ⚠ Failed to fetch details for PR #${number}: ${errorMessage}\n`,
          );
        }
      }
    }

    console.log(`✨ Test completed successfully!`);
  } catch (error) {
    console.error("\n❌ Test failed with error:\n");

    // Provide helpful error messages for common issues
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      if (errorMessage.includes("not found")) {
        console.error("Repository Error: Repository not found");
        console.error("   - Check the repository name is correct");
        console.error(
          "   - Verify the repository exists and is accessible to the GitHub App",
        );
      } else if (
        errorMessage.includes("app_id") ||
        errorMessage.includes("private_key")
      ) {
        console.error("Authentication Error: Invalid APP_ID or PRIVATE_KEY");
        console.error("   - Check that APP_ID is a valid number");
        console.error(
          "   - Check that PRIVATE_KEY is a valid PEM-formatted private key",
        );
      } else if (errorMessage.includes("installation")) {
        console.error("Installation Error: Invalid INSTALLATION_ID");
        console.error(
          "   - Check that INSTALLATION_ID matches your GitHub App installation",
        );
      } else if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("429")
      ) {
        console.error("Rate Limit Error: GitHub API rate limit exceeded");
        console.error("   - Wait a few minutes and try again");
      } else {
        console.error(`Error: ${error.message}`);
      }
    } else {
      console.error("Unknown error:", error);
    }

    console.error("\nFull error details:");
    console.error(error);
    process.exit(1);
  }
}

// TODO: Extend this test to:
// - Test incremental sync (using 'since' parameter)
// - Test filtering by state (open/closed)
// - Test with repos that have 1000+ PRs (stress test pagination)
// - Measure performance (time to fetch, API calls made, rate limit usage)
// - Validate PR data structure matches expected schema
// - Test error handling for private repos, archived repos, etc.
// - Compare fetched PRs with what's in the database (once DB layer is ready)
// - Test concurrent fetching from multiple repos

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
