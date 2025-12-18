/**
 * Company Data Enrichment
 *
 * Helper functions to populate metadata tables from
 * Common Room and GitHub sources after user insertion/update.
 */

import { fetchAndUpdateCommonRoomMetadata } from "../commonroom/updateCompanyData.js";
import { fetchGitHubUserProfile } from "../github/userProfile.js";
import { upsertGitHubProfile } from "./githubProfile.js";

/**
 * Attempts to populate metadata tables for a user from Common Room and GitHub.
 * This is a fire-and-forget operation that doesn't block on errors.
 *
 * @param githubLogin - GitHub username (login)
 * @param githubId - GitHub user ID (unused but kept for compatibility)
 */
export async function enrichCompanyDataForUser(
  githubLogin: string,
  githubId: number,
): Promise<void> {
  try {
    // Try Common Room first
    try {
      await fetchAndUpdateCommonRoomMetadata(githubLogin);
    } catch (error) {
      // If Common Room fails, log but continue to try GitHub
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `[enrichCompanyData] Common Room lookup failed for ${githubLogin}: ${errorMessage}`,
      );
    }

    // Always try GitHub profile to populate github_profiles
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
    if (githubToken) {
      try {
        const profile = await fetchGitHubUserProfile(githubLogin, githubToken);
        await upsertGitHubProfile({
          github_id: githubId,
          company: profile.company,
          bio: profile.bio,
          blog: profile.blog,
          location: profile.location,
          twitter: profile.twitter_username,
          name: profile.name,
        });
      } catch (githubError) {
        // Silently fail - this is a best-effort enrichment
        const githubErrorMessage =
          githubError instanceof Error
            ? githubError.message
            : String(githubError);
        console.warn(
          `[enrichCompanyData] GitHub profile lookup failed for ${githubLogin}: ${githubErrorMessage}`,
        );
      }
    }
  } catch (error) {
    // Silently fail - this is a best-effort enrichment that shouldn't break sync
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `[enrichCompanyData] Failed to enrich metadata for ${githubLogin}: ${errorMessage}`,
    );
  }
}

/**
 * Fire-and-forget wrapper for enriching company data.
 * Calls enrichCompanyDataForUser but doesn't await or block on errors.
 *
 * @param githubLogin - GitHub username (login)
 * @param githubId - GitHub user ID
 */
export function enrichCompanyDataForUserAsync(
  githubLogin: string,
  githubId: number,
): void {
  // Fire and forget - don't await, don't block sync
  enrichCompanyDataForUser(githubLogin, githubId).catch((error) => {
    // Already logged in enrichCompanyDataForUser, just prevent unhandled rejection
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `[enrichCompanyData] Unhandled error for ${githubLogin}: ${errorMessage}`,
    );
  });
}
