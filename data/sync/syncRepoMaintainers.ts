/**
 * Sync Worker - GitHub Repository Maintainers Synchronization
 *
 * Synchronizes maintainers/collaborators for all non-archived repositories
 * from GitHub API to the repo_maintainers table.
 */

import { GitHubAPI } from "../github/client.js";
import { query } from "../db/index.js";
import { closePool } from "../db/index.js";
import { upsertMaintainer } from "../db/repoMaintainers.js";
import { upsertGitHubUser, markMaintainer } from "../db/githubUsers.js";
import { fetchRepoCollaborators } from "../github/collaborators.js";
import { detectMaintainersFromFiles } from "../../sync/detectMaintainers.js";

interface RepoWithOwner {
  github_id: number;
  full_name: string;
  owner_login: string;
  repo_name: string;
}

export interface SyncMaintainersResult {
  reposScanned: number;
  maintainersDiscovered: number;
  usersNewlyMarked: number;
}

/**
 * Synchronizes maintainers for all non-archived repositories.
 *
 * @returns Promise resolving to sync result statistics
 */
export async function syncRepoMaintainers(): Promise<SyncMaintainersResult> {
  console.log("🚀 Starting repository maintainers sync...\n");

  // Initialize GitHub API client
  const api = new GitHubAPI();

  const result: SyncMaintainersResult = {
    reposScanned: 0,
    maintainersDiscovered: 0,
    usersNewlyMarked: 0,
  };

  try {
    // Fetch all non-archived repositories
    const repos = await query<RepoWithOwner>(
      `SELECT 
        r.github_id,
        r.full_name,
        SPLIT_PART(r.full_name, '/', 1) as owner_login,
        SPLIT_PART(r.full_name, '/', 2) as repo_name
      FROM repos r
      WHERE r.archived = false
      ORDER BY r.github_id`,
    );

    console.log(
      `📋 Found ${repos.rows.length} non-archived repositories to scan\n`,
    );

    // Track which users we've marked as maintainers in this run
    const newlyMarkedUsers = new Set<number>();

    // Process each repository
    for (let i = 0; i < repos.rows.length; i++) {
      const repo = repos.rows[i];
      const repoNum = i + 1;

      try {
        // Validate repo information
        if (!repo.owner_login || !repo.repo_name) {
          console.warn(
            `  ⚠ Repo ${repo.github_id}: Invalid full_name format: ${repo.full_name}`,
          );
          continue;
        }

        const repoObj = {
          id: repo.github_id,
          name: repo.repo_name,
          full_name: repo.full_name,
          owner: { login: repo.owner_login },
          private: false,
          archived: false,
          pushed_at: null,
          updated_at: "",
        };

        // Method 1: Fetch collaborators from GitHub API
        let collaborators: Awaited<
          ReturnType<typeof fetchRepoCollaborators>
        > | null = null;
        try {
          collaborators = await fetchRepoCollaborators(repoObj, api);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const isPermissionError =
            errorMessage.includes("Must have push access") ||
            errorMessage.includes("push access to view") ||
            errorMessage.includes("403") ||
            errorMessage.includes("Forbidden");

          if (isPermissionError) {
            console.warn(
              `  ⚠ Permission denied for collaborators API for ${repo.full_name}, will use file-based methods only`,
            );
          } else {
            // Re-throw if not a permission error
            throw error;
          }
        }

        // Method 2 & 3: Also try CODEOWNERS and BCR metadata template files
        const fileResults = await detectMaintainersFromFiles(
          repoObj,
          api,
          true, // Also mark in github_users table
        );

        // Process collaborators from GitHub API (if available)
        let repoMaintainersCount = 0;
        const allDetectedUserIds = new Set<number>();

        if (collaborators) {
          // Filter to maintainers (admin, maintain, or write permissions)
          const maintainers = collaborators.filter((collab) => {
            // Skip bots
            if (collab.type === "Bot") {
              return false;
            }

            // Include users with admin, maintain, or write (push) permissions
            return (
              collab.permissions.admin ||
              collab.permissions.maintain ||
              collab.permissions.push
            );
          });

          // Upsert each maintainer from collaborators API
          for (const maintainer of maintainers) {
            try {
              // First, ensure the user exists in github_users table
              await upsertGitHubUser({
                github_id: maintainer.id,
                login: maintainer.login,
                avatar_url: maintainer.avatar_url,
                name: null,
                type: maintainer.type,
              });

              // Determine permission level for source/confidence
              let permissionLevel = "write";
              if (maintainer.permissions.admin) {
                permissionLevel = "admin";
              } else if (maintainer.permissions.maintain) {
                permissionLevel = "maintain";
              }

              // Upsert into repo_maintainers table
              await upsertMaintainer(
                repo.github_id,
                maintainer.id,
                "github-permissions",
                100, // High confidence - this is from GitHub API
              );

              // Also mark user as maintainer in github_users table
              await markMaintainer(maintainer.id, "github-permissions");

              repoMaintainersCount++;
              allDetectedUserIds.add(maintainer.id);

              // Track if this is the first time we're marking this user as a maintainer
              if (!newlyMarkedUsers.has(maintainer.id)) {
                newlyMarkedUsers.add(maintainer.id);
                result.usersNewlyMarked++;
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              console.warn(
                `  ⚠ Failed to upsert maintainer ${maintainer.login} for repo ${repo.full_name}: ${errorMessage}`,
              );
            }
          }
        }

        // Track maintainers from CODEOWNERS
        for (const userId of fileResults.codeowners) {
          if (!allDetectedUserIds.has(userId)) {
            allDetectedUserIds.add(userId);
            repoMaintainersCount++;
            if (!newlyMarkedUsers.has(userId)) {
              newlyMarkedUsers.add(userId);
              result.usersNewlyMarked++;
            }
          }
        }

        // Track maintainers from BCR metadata template
        for (const userId of fileResults.bcrMetadata) {
          if (!allDetectedUserIds.has(userId)) {
            allDetectedUserIds.add(userId);
            repoMaintainersCount++;
            if (!newlyMarkedUsers.has(userId)) {
              newlyMarkedUsers.add(userId);
              result.usersNewlyMarked++;
            }
          }
        }

        result.maintainersDiscovered += repoMaintainersCount;
        result.reposScanned++;

        const sources: string[] = [];
        if (collaborators) sources.push("GitHub API");
        if (fileResults.codeowners.length > 0) sources.push("CODEOWNERS");
        if (fileResults.bcrMetadata.length > 0) sources.push("BCR metadata");

        if (repoMaintainersCount > 0) {
          console.log(
            `[${repoNum}/${repos.rows.length}] ${repo.full_name}: ${repoMaintainersCount} maintainer${repoMaintainersCount !== 1 ? "s" : ""} from ${sources.join(", ")}`,
          );
        } else {
          console.log(
            `[${repoNum}/${repos.rows.length}] ${repo.full_name}: No maintainers found`,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `  ❌ Error syncing maintainers for ${repo.full_name}: ${errorMessage}`,
        );
        // Continue with next repo
      }
    }

    console.log(`\n✨ Maintainers sync completed!`);
    console.log(`📊 Summary:`);
    console.log(`   Repositories scanned: ${result.reposScanned}`);
    console.log(`   Maintainers discovered: ${result.maintainersDiscovered}`);
    console.log(
      `   Users newly marked as maintainers: ${result.usersNewlyMarked}\n`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Fatal error during maintainers sync: ${errorMessage}`);
    throw error;
  }

  return result;
}

/**
 * Main function for running the maintainers sync worker.
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
    // Allow PAT authentication as fallback
    if (!process.env.GITHUB_TOKEN && !process.env.GITHUB_PAT) {
      console.error(
        "❌ GitHub credentials required: either (APP_ID, PRIVATE_KEY, INSTALLATION_ID) or (GITHUB_TOKEN or GITHUB_PAT)",
      );
      process.exit(1);
    }
  }

  try {
    await syncRepoMaintainers();
  } catch (error) {
    console.error("Maintainers sync failed:", error);
    process.exit(1);
  } finally {
    // Close database connection pool
    await closePool();
  }
}

// Execute main() if this file is run directly (not imported as a module)
if (process.argv[1]?.includes("syncRepoMaintainers")) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
