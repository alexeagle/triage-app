/**
 * GitHub Profile Database Operations
 *
 * Stores metadata fetched from GitHub user profiles.
 */

import { query } from "./index.js";
import { normalizeCompanyName } from "./normalizeCompany.js";

export interface GitHubProfileInput {
  github_id: number;
  company?: string | null;
  bio?: string | null;
  blog?: string | null;
  location?: string | null;
  twitter?: string | null;
  name?: string | null;
}

/**
 * Upserts GitHub profile data into the github_profiles table.
 *
 * @param profile - GitHub profile data
 */
export async function upsertGitHubProfile(
  profile: GitHubProfileInput,
): Promise<void> {
  await query(
    `INSERT INTO github_profiles (
      github_id, company, bio, blog, location, twitter, name, last_fetched_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (github_id)
    DO UPDATE SET
      company = EXCLUDED.company,
      bio = EXCLUDED.bio,
      blog = EXCLUDED.blog,
      location = EXCLUDED.location,
      twitter = EXCLUDED.twitter,
      name = EXCLUDED.name,
      last_fetched_at = NOW()`,
    [
      profile.github_id,
      normalizeCompanyName(profile.company),
      profile.bio ?? null,
      profile.blog ?? null,
      profile.location ?? null,
      profile.twitter ?? null,
      profile.name ?? null,
    ],
  );
}
