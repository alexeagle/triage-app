/**
 * Backfill GitHub User Profiles
 *
 * Fetches profile data from GitHub API and updates the github_users table.
 * Handles rate limiting and is safe to re-run (idempotent).
 */

import { Pool } from "pg";

interface GitHubUserRow {
  github_id: number;
  login: string;
}

interface GitHubUserResponse {
  name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  twitter_username: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGitHubUser(
  login: string,
  token: string,
): Promise<GitHubUserResponse> {
  const url = `https://api.github.com/users/${encodeURIComponent(login)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "triage-app-backfill",
    },
  });

  // Handle rate limiting (403 or 429)
  if (response.status === 403 || response.status === 429) {
    const resetHeader = response.headers.get("x-ratelimit-reset");
    if (resetHeader) {
      const resetTimestamp = parseInt(resetHeader, 10) * 1000;
      const now = Date.now();
      const sleepDuration = Math.max(0, resetTimestamp - now) + 1000; // Add 1s buffer

      console.warn(
        `Rate limit hit for ${login}. Sleeping until ${new Date(resetTimestamp).toISOString()} (${Math.ceil(sleepDuration / 1000)}s)`,
      );
      await sleep(sleepDuration);
      // Retry the request
      return fetchGitHubUser(login, token);
    }
  }

  if (response.status === 404) {
    throw new Error("User not found (404)");
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API error for ${login}: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return {
    name: data.name || null,
    bio: data.bio || null,
    company: data.company || null,
    blog: data.blog || null,
    location: data.location || null,
    twitter_username: data.twitter_username || null,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  if (!githubToken) {
    console.error("❌ GITHUB_TOKEN environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Query all github_users with non-null login
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
        const profile = await fetchGitHubUser(user.login, githubToken);

        await pool.query(
          `UPDATE github_users
           SET name = $1,
               bio = $2,
               company = $3,
               blog = $4,
               location = $5,
               twitter = $6
           WHERE github_id = $7`,
          [
            profile.name,
            profile.bio,
            profile.company,
            profile.blog,
            profile.location,
            profile.twitter_username,
            user.github_id,
          ],
        );

        console.log(`${progress} synced github profile for ${user.login}`);
        synced++;

        // Small delay to avoid hitting rate limits
        await sleep(100);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("404") ||
          errorMessage.includes("not found")
        ) {
          console.log(
            `${progress} skipped ${user.login} (user not found - may be renamed or deleted)`,
          );
          skipped++;
        } else {
          console.error(
            `${progress} ❌ Error updating ${user.login}: ${errorMessage}`,
          );
          errors++;
        }
      }
    }

    console.log(`\n✨ Backfill completed!`);
    console.log(`   Synced: ${synced}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
