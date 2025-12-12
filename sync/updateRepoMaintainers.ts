/**
 * Helper function to update repo maintainers during sync.
 * This is called after syncing issues and PRs to detect and update maintainership.
 */

import {
  aggregateMaintainerSignals,
  detectMaintainersFromFiles,
} from "./detectMaintainers.js";
import type { Repo } from "../data/github/repos.js";
import type { Contributor, BcrMetadata } from "./detectMaintainers.js";
import { GitHubAPI } from "../data/github/client.js";

/**
 * Context collected during repo sync for maintainer detection.
 */
export interface SyncContext {
  contributors?: Contributor[];
  bcrMetadata?: BcrMetadata | null;
  codeowners?: string[] | null;
}

/**
 * Updates repo maintainers based on signals collected during sync.
 * This function never throws - errors are logged and execution continues.
 *
 * @param repo - Repository object from sync
 * @param syncContext - Context with contributors, BCR metadata, CODEOWNERS, etc.
 * @returns Number of maintainers detected/updated, or null if detection failed
 */
export async function updateRepoMaintainers(
  repo: Repo,
  syncContext?: SyncContext,
): Promise<number | null> {
  try {
    // Method 1: Use signals from sync context (contributors, BCR metadata, CODEOWNERS)
    const detected = await aggregateMaintainerSignals(repo, {
      contributors: syncContext?.contributors,
      bcrMetadata: syncContext?.bcrMetadata,
      codeowners: syncContext?.codeowners,
    });

    // Method 2 & 3: Also try fetching CODEOWNERS and BCR metadata template files directly
    // This ensures we get maintainers even if they weren't in the sync context
    const api = new GitHubAPI();
    const fileResults = await detectMaintainersFromFiles(repo, api, false);

    // Combine all detected user IDs
    const allUserIds = new Set<number>();
    detected.forEach((m) => allUserIds.add(m.github_user_id));
    fileResults.codeowners.forEach((id) => allUserIds.add(id));
    fileResults.bcrMetadata.forEach((id) => allUserIds.add(id));

    const maintainerCount = allUserIds.size;
    if (maintainerCount > 0) {
      const sources: string[] = [];
      if (detected.length > 0) sources.push("sync context");
      if (fileResults.codeowners.length > 0) sources.push("CODEOWNERS");
      if (fileResults.bcrMetadata.length > 0) sources.push("BCR metadata");

      console.log(
        `  ✓ Maintainers updated: ${maintainerCount} from ${sources.join(", ")}`,
      );
    } else {
      console.log(`  ✓ Maintainers checked: 0 detected`);
    }

    return maintainerCount;
  } catch (error) {
    // Log but don't throw - maintainer detection should not block sync
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `  ⚠ Failed to update maintainers for ${repo.full_name}: ${errorMessage}`,
    );
    return null;
  }
}
