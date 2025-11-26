/**
 * Manual test script for fetching repositories from a GitHub organization.
 *
 * Usage:
 *   tsx data/manual-tests/listRepos.ts
 *   # or: pnpm test:repos
 *
 * Required environment variables:
 *   - APP_ID: GitHub App ID
 *   - PRIVATE_KEY: GitHub App private key (PEM format)
 *   - INSTALLATION_ID: GitHub App installation ID
 */

import { GitHubAPI } from "../github/client.js";
import { fetchOrgRepos } from "../github/repos.js";

async function main() {
  console.log("Testing GitHub App authentication and repository fetching...\n");

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

    // Test fetching repos for my personal organization
    const orgName = "alexeagle";
    console.log(`📦 Fetching repositories for organization: ${orgName}\n`);

    const repos = await fetchOrgRepos(orgName, api);

    console.log(`✅ Successfully fetched ${repos.length} repositories:\n`);

    // Print repo information
    repos.forEach((repo, index) => {
      console.log(`${index + 1}. ${repo.full_name}`);
      console.log(`   GitHub ID: ${repo.id}`);
      console.log(`   Private: ${repo.private ? "Yes" : "No"}`);
      console.log(`   Archived: ${repo.archived ? "Yes" : "No"}`);
      console.log(`   Updated: ${repo.updated_at}`);
      console.log("");
    });

    console.log(`\n✨ Test completed successfully!`);
  } catch (error) {
    console.error("\n❌ Test failed with error:\n");

    // Provide helpful error messages for common issues
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      if (
        errorMessage.includes("app_id") ||
        errorMessage.includes("private_key")
      ) {
        console.error("Authentication Error: Invalid APP_ID or PRIVATE_KEY");
        console.error("   - Check that APP_ID is a valid number");
        console.error(
          "   - Check that PRIVATE_KEY is a valid PEM-formatted private key",
        );
        console.error(
          "   - Ensure PRIVATE_KEY includes the full key with headers (-----BEGIN RSA PRIVATE KEY-----)",
        );
      } else if (errorMessage.includes("installation")) {
        console.error("Installation Error: Invalid INSTALLATION_ID");
        console.error(
          "   - Check that INSTALLATION_ID matches your GitHub App installation",
        );
        console.error(
          "   - Verify the installation has access to the organization",
        );
      } else if (
        errorMessage.includes("not found") ||
        errorMessage.includes("404")
      ) {
        console.error(
          "Organization Error: Organization not found or not accessible",
        );
        console.error("   - Verify the organization name is correct");
        console.error(
          "   - Ensure the GitHub App installation has access to this organization",
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
// - Test with different organizations
// - Test pagination with large orgs (100+ repos)
// - Test error cases (invalid org, no access, etc.)
// - Measure performance (time to fetch, API calls made)
// - Validate repo data structure matches expected schema
// - Test incremental sync scenarios (fetch only updated repos)

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
