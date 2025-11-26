/**
 * Manual test script for incremental issue fetching.
 *
 * Tests fetching issues updated since the last sync timestamp.
 *
 * Usage:
 *   tsx src/manual-tests/testIncrementalIssues.ts <repo>
 *
 * Examples:
 *   tsx src/manual-tests/testIncrementalIssues.ts bazel-contrib/rules_js
 *   tsx src/manual-tests/testIncrementalIssues.ts rules_js  # assumes alexeagle org
 *
 * Required environment variables:
 *   - APP_ID: GitHub App ID
 *   - PRIVATE_KEY: GitHub App private key (PEM format)
 *   - INSTALLATION_ID: GitHub App installation ID
 *   - DATABASE_URL: Postgres connection string
 */

import { GitHubAPI } from "../github/client.js";
import { fetchOrgRepos, Repo } from "../github/repos.js";
import { fetchUpdatedIssuesSince } from "../github/issues.js";
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
    console.error("  tsx src/manual-tests/testIncrementalIssues.ts <repo>");
    console.error("\nExamples:");
    console.error(
      "  tsx src/manual-tests/testIncrementalIssues.ts bazel-contrib/rules_js",
    );
    console.error("  tsx src/manual-tests/testIncrementalIssues.ts rules_js");
    process.exit(1);
  }

  console.log("Testing incremental issue fetching...\n");

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

    if (!syncState || !syncState.last_issue_sync) {
      console.log(
        `⚠️  No sync state found or no last_issue_sync timestamp.\n` +
          `   This means a full sync is needed (no incremental sync possible).\n`,
      );
      console.log(
        `   To test incremental sync, first run a full sync to populate sync_state.\n`,
      );
      process.exit(0);
    }

    const sinceTimestamp = syncState.last_issue_sync;
    console.log(
      `✅ Last issue sync: ${sinceTimestamp}\n` +
        `📋 Fetching issues updated since ${sinceTimestamp}...\n`,
    );

    // Fetch updated issues
    let totalIssues = 0;
    let batchCount = 0;
    const issues: Array<{ number: number; title: string; updated_at: string }> =
      [];

    for await (const batch of fetchUpdatedIssuesSince(
      repo,
      api,
      sinceTimestamp,
    )) {
      batchCount++;
      totalIssues += batch.issues.length;

      console.log(
        `Batch ${batchCount} (page ${batch.page}): ${batch.issues.length} issues`,
      );

      // Collect issue info
      batch.issues.forEach((issue) => {
        issues.push({
          number: issue.number,
          title: issue.title,
          updated_at: issue.updated_at,
        });
      });
    }

    // Print summary
    console.log(`\n✅ Found ${totalIssues} issues updated since last sync\n`);

    if (totalIssues > 0) {
      console.log("Issues:");
      issues.forEach((issue) => {
        console.log(
          `  #${issue.number}: ${issue.title} (updated: ${issue.updated_at})`,
        );
      });
    } else {
      console.log("No issues have been updated since the last sync.");
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
