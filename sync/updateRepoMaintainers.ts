/**
 * Helper function to update repo maintainers during sync.
 * This is called after syncing issues and PRs to detect and update maintainership.
 */

import { aggregateMaintainerSignals } from "./detectMaintainers.js";
import type { Repo } from "../data/github/repos.js";
import type { Contributor, BcrMetadata } from "./detectMaintainers.js";

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
    const detected = await aggregateMaintainerSignals(repo, {
      contributors: syncContext?.contributors,
      bcrMetadata: syncContext?.bcrMetadata,
      codeowners: syncContext?.codeowners,
    });

    const maintainerCount = detected.length;
    if (maintainerCount > 0) {
      const sourcesSummary = detected
        .map((m) => `${m.github_user_id}(${m.sources.join(",")})`)
        .join(", ");
      console.log(
        `  ✓ Maintainers updated: ${maintainerCount} (${sourcesSummary})`,
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
