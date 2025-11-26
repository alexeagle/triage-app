/**
 * Manual test script for incremental pull request fetching.
 *
 * Tests fetching PRs updated since the last sync timestamp.
 *
 * Usage:
 *   tsx src/manual-tests/testIncrementalPrs.ts <repo>
 *
 * Examples:
 *   tsx src/manual-tests/testIncrementalPrs.ts bazel-contrib/rules_js
 *   tsx src/manual-tests/testIncrementalPrs.ts rules_js  # assumes alexeagle org
 *
 * Required environment variables:
 *   - APP_ID: GitHub App ID
 *   - PRIVATE_KEY: GitHub App private key (PEM format)
 *   - INSTALLATION_ID: GitHub App installation ID
 *   - DATABASE_URL: Postgres connection string
 */

import { GitHubAPI } from "../github/client.js";
import { fetchOrgRepos, Repo } from "../github/repos.js";
import { fetchRepoPullRequests } from "../github/pullRequests.js";
import { getSyncState } from "../db/syncState.js";

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
    console.error("  tsx src/manual-tests/testIncrementalPrs.ts <repo>");
    console.error("\nExamples:");
    console.error(
      "  tsx src/manual-tests/testIncrementalPrs.ts bazel-contrib/rules_js",
    );
    console.error("  tsx src/manual-tests/testIncrementalPrs.ts rules_js");
    process.exit(1);
  }

  console.log("Testing incremental PR fetching...\n");

  // Validate environment variables
  const requiredEnvVars = [
    "APP_ID",
    "PRIVATE_KEY",
    "INSTALLATION_ID",
    "DATABASE_URL",
  ];
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

    // Fetch sync state from database
    console.log(`📊 Fetching sync state for ${repo.full_name}...`);
    const syncState = await getSyncState(repo.id);

    if (!syncState || !syncState.last_pr_sync) {
      console.log(
        `⚠️  No sync state found or no last_pr_sync timestamp.\n` +
          `   This means a full sync is needed (no incremental sync possible).\n`,
      );
      console.log(
        `   To test incremental sync, first run a full sync to populate sync_state.\n`,
      );
      process.exit(0);
    }

    const sinceTimestamp = syncState.last_pr_sync;
    console.log(
      `✅ Last PR sync: ${sinceTimestamp}\n` +
        `📋 Fetching PRs updated since ${sinceTimestamp}...\n`,
    );

    // Fetch updated PRs (using since parameter)
    let totalPRs = 0;
    let batchCount = 0;
    const prs: Array<{ number: number; title: string; updated_at: string }> =
      [];

    for await (const batch of fetchRepoPullRequests(
      repo,
      api,
      sinceTimestamp,
    )) {
      batchCount++;
      totalPRs += batch.pullRequests.length;

      console.log(
        `Batch ${batchCount} (page ${batch.page}): ${batch.pullRequests.length} PRs`,
      );

      // Collect PR info
      batch.pullRequests.forEach((pr) => {
        prs.push({
          number: pr.number,
          title: pr.title,
          updated_at: pr.updated_at,
        });
      });
    }

    // Print summary
    console.log(`\n✅ Found ${totalPRs} PRs updated since last sync\n`);

    if (totalPRs > 0) {
      console.log("Pull Requests:");
      prs.forEach((pr) => {
        console.log(`  #${pr.number}: ${pr.title} (updated: ${pr.updated_at})`);
      });
    } else {
      console.log("No PRs have been updated since the last sync.");
    }

    console.log(`\n✨ Test completed successfully!`);
  } catch (error) {
    console.error("\n❌ Test failed with error:\n");

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("Unknown error:", error);
    }

    console.error("\nFull error details:");
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
