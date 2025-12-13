/**
 * Backfill Starred Repositories for Existing Users
 *
 * This script syncs starred repositories for all users who need it.
 * It uses a GitHub Personal Access Token (PAT) if provided, which will
 * only work for the user who owns the token.
 *
 * Usage:
 *   tsx data/manual-tests/backfillStarredRepos.ts
 *
 * Required environment variables:
 *   - DATABASE_URL: PostgreSQL connection string
 *
 * Optional environment variables:
 *   - GITHUB_TOKEN or GITHUB_PAT: GitHub Personal Access Token
 *     (must belong to a user in the database for sync to work)
 */

import { query } from "../db/index.js";
import { shouldSyncStars } from "../db/repoStars.js";
import { syncStarredRepos } from "../../lib/syncStarredRepos.js";

interface UserRow {
  id: number;
  github_id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

async function main() {
  console.log("🔄 Backfilling starred repositories for existing users...\n");

  // Check for GitHub token
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  if (!githubToken) {
    console.error(
      "❌ Missing GITHUB_TOKEN or GITHUB_PAT environment variable.\n" +
        "   A GitHub Personal Access Token is required to fetch starred repos.\n" +
        "   Note: The token will only work for the user who owns it.\n",
    );
    process.exit(1);
  }

  try {
    // Get all users from the database
    const usersResult = await query<UserRow>(
      `SELECT id, github_id, login, name, avatar_url, created_at
       FROM users
       ORDER BY created_at DESC`,
    );

    const users = usersResult.rows;

    if (users.length === 0) {
      console.log("ℹ️  No users found in the database.");
      return;
    }

    console.log(`Found ${users.length} user(s) in the database.\n`);

    // Find users who need syncing
    const usersToSync: UserRow[] = [];
    for (const user of users) {
      const needsSync = await shouldSyncStars(user.github_id);
      if (needsSync) {
        usersToSync.push(user);
      }
    }

    if (usersToSync.length === 0) {
      console.log(
        "✅ All users have fresh starred repos data. No sync needed.\n",
      );
      return;
    }

    console.log(
      `Found ${usersToSync.length} user(s) who need starred repos synced.\n`,
    );

    // Sync starred repos for each user
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < usersToSync.length; i++) {
      const user = usersToSync[i];
      const userNum = i + 1;

      console.log(
        `[${userNum}/${usersToSync.length}] Syncing starred repos for @${user.login} (${user.github_id})...`,
      );

      try {
        const result = await syncStarredRepos(
          user.github_id,
          user.login,
          githubToken,
        );

        if (result.error) {
          console.error(`  ❌ Error: ${result.error}\n`);
          errorCount++;
        } else if (result.reposSynced === 0 && result.starsUpserted === 0) {
          console.log(`  ⏭️  Skipped (data is fresh or no stars found)\n`);
          skipCount++;
        } else {
          console.log(
            `  ✅ Synced ${result.reposSynced} repos, ${result.starsUpserted} stars upserted, ${result.staleStarsRemoved} stale stars removed\n`,
          );
          successCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Error: ${errorMessage}\n`);
        errorCount++;
      }
    }

    // Print summary
    console.log("\n📊 Backfill Summary:\n");
    console.log(`  ✅ Successfully synced: ${successCount}`);
    console.log(`  ⏭️  Skipped (fresh/no stars): ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log("");

    if (errorCount > 0) {
      console.log(
        "⚠️  Some users failed to sync. This may be because:\n" +
          "   - The GitHub token doesn't belong to that user\n" +
          "   - The user has no starred repos\n" +
          "   - API rate limits were hit\n" +
          "   - Network/API errors occurred\n",
      );
    }

    console.log("✨ Backfill completed!");
  } catch (error) {
    console.error("\n❌ Error during backfill check:\n");
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
