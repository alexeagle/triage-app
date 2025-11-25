/**
 * Manual test script for fetching issues from a GitHub repository.
 *
 * Usage:
 *   tsx src/manual-tests/listIssues.ts <repo>
 *   # or: pnpm test:issues <repo>
 *
 * Examples:
 *   tsx src/manual-tests/listIssues.ts bazel-contrib/bazel-lib
 *   tsx src/manual-tests/listIssues.ts bazel-lib  # assumes bazel-contrib org
 *
 * Required environment variables:
 *   - APP_ID: GitHub App ID
 *   - PRIVATE_KEY: GitHub App private key (PEM format)
 *   - INSTALLATION_ID: GitHub App installation ID
 */

import { GitHubAPI } from "../github/client.js";
import { fetchOrgRepos, Repo } from "../github/repos.js";
import { fetchRepoIssues } from "../github/issues.js";

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

  // Otherwise, assume my personal org and search for the repo
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
    console.error("  ts-node src/manual-tests/listIssues.ts <repo>");
    console.error("\nExamples:");
    console.error(
      "  ts-node src/manual-tests/listIssues.ts bazel-contrib/bazel-lib",
    );
    console.error("  ts-node src/manual-tests/listIssues.ts bazel-lib");
    process.exit(1);
  }

  console.log("Testing GitHub issue fetching...\n");

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

    // Fetch issues using the async generator
    console.log(`📋 Fetching issues for ${repo.full_name}...\n`);

    let totalIssues = 0;
    let batchCount = 0;

    for await (const batch of fetchRepoIssues(repo, api)) {
      batchCount++;
      totalIssues += batch.issues.length;

      console.log(
        `Batch ${batchCount} (page ${batch.page}): ${batch.issues.length} issues`,
      );

      // Print issue details
      batch.issues.forEach((issue) => {
        console.log(`  #${issue.number}: ${issue.title}`);
        console.log(`    State: ${issue.state}`);
        console.log(`    Author: ${issue.user.login}`);
        console.log(`    Updated: ${issue.updated_at}`);
        if (issue.labels.length > 0) {
          console.log(
            `    Labels: ${issue.labels.map((l) => l.name).join(", ")}`,
          );
        }
        console.log("");
      });

      if (!batch.hasMore) {
        break;
      }
    }

    console.log(
      `\n✅ Successfully fetched ${totalIssues} issues across ${batchCount} batch(es)`,
    );
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
// - Test with repos that have 1000+ issues (stress test pagination)
// - Measure performance (time to fetch, API calls made, rate limit usage)
// - Validate issue data structure matches expected schema
// - Test error handling for private repos, archived repos, etc.
// - Compare fetched issues with what's in the database (once DB layer is ready)
// - Test concurrent fetching from multiple repos

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
