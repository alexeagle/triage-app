/**
 * Backfill Common Room Company Data
 *
 * Fetches company data from Common Room API and updates the commonroom_member_metadata table.
 * Handles rate limiting and is safe to re-run (idempotent).
 */

import { Pool } from "pg";
import { fetchAndUpdateCommonRoomMetadata } from "../commonroom/updateCompanyData.js";

interface GitHubUserRow {
  github_id: number;
  login: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const commonroomToken = process.env.COMMONROOM_API_TOKEN;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  if (!commonroomToken) {
    console.error("❌ COMMONROOM_API_TOKEN environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Query all github_users
    const result = await pool.query<GitHubUserRow>(
      `SELECT github_id, login
       FROM github_users
       WHERE login IS NOT NULL
       ORDER BY github_id`,
    );

    const users = result.rows;
    console.log(`📋 Found ${users.length} users to update\n`);

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const progress = `[${i + 1}/${users.length}]`;

      try {
        const companyData = await fetchAndUpdateCommonRoomMetadata(
          user.login,
          commonroomToken,
        );

        if (companyData && companyData.companyName) {
          console.log(
            `${progress} ✅ Updated ${user.login} → ${companyData.companyName}`,
          );
          synced++;
        } else {
          // No match found in Common Room or no company data
          console.log(
            `${progress} ⏭️  Skipped ${user.login} (not found in Common Room or no company data)`,
          );
          skipped++;
        }

        // Small delay to avoid hitting rate limits
        // Common Room API rate limits are typically generous, but be respectful
        await sleep(200);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check for rate limiting (429)
        if (errorMessage.includes("429") || errorMessage.includes("Rate")) {
          console.warn(
            `${progress} ⚠️  Rate limited for ${user.login}, waiting 5 seconds...`,
          );
          await sleep(5000);
          // Retry this user
          i--;
          continue;
        }

        console.error(
          `${progress} ❌ Error updating ${user.login}: ${errorMessage}`,
        );
        errors++;

        // On API errors, wait a bit longer before continuing
        await sleep(1000);
      }
    }

    console.log(`\n✨ Backfill completed!`);
    console.log(`   ✅ Synced: ${synced}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
