/**
 * Maintainer Detection Helpers
 *
 * Detects maintainers from various sources (GitHub permissions, BCR metadata, CODEOWNERS).
 * These functions operate on already-fetched data and call DB-layer maintainership functions.
 * They never make GitHub API calls or parse files directly.
 */

import {
  upsertMaintainer,
  getGitHubUserIdByLogin,
} from "../data/db/repoMaintainers.js";
import type { Repo } from "../data/github/repos.js";

/**
 * Contributor with optional permission information.
 * Permission data should be included in the sync payload if available.
 */
export interface Contributor {
  id: number;
  login: string;
  type?: string | null;
  permission?: string | null; // e.g., "admin", "maintain", "write", "read"
}

/**
 * BCR metadata structure containing maintainer information.
 */
export interface BcrMetadata {
  maintainers?: string[]; // Array of GitHub usernames
}

/**
 * Detects maintainers from GitHub permissions.
 * For each contributor with "admin" or "maintain" permission, upserts a maintainership record.
 *
 * @param repo - Repository object from sync
 * @param contributors - List of GitHub users associated with this repo (authors, assignees, reviewers, etc.)
 * @returns Array of detected maintainer user IDs
 */
export async function detectMaintainersFromGitHubPermissions(
  repo: Repo,
  contributors: Contributor[],
): Promise<number[]> {
  const detected: number[] = [];

  if (!contributors || contributors.length === 0) {
    return detected;
  }

  for (const contributor of contributors) {
    // Skip bots
    if (contributor.type === "Bot") {
      continue;
    }

    // Check if contributor has admin or maintain permission
    const permission = contributor.permission?.toLowerCase();
    if (permission === "admin" || permission === "maintain") {
      try {
        await upsertMaintainer(
          repo.id,
          contributor.id,
          "github-permissions",
          100,
        );
        detected.push(contributor.id);
      } catch (error) {
        // Log but don't throw - continue processing other contributors
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `Failed to upsert maintainer ${contributor.login} for repo ${repo.full_name}: ${errorMessage}`,
        );
      }
    }
  }

  return detected;
}

/**
 * Detects maintainers from BCR metadata.
 * For each maintainer username in the metadata, looks up the GitHub user ID and upserts a maintainership record.
 *
 * @param repo - Repository object from sync
 * @param metadata - Parsed metadata from .bcr/metadata.json (if available)
 * @returns Array of detected maintainer user IDs
 */
export async function detectMaintainersFromBcrMetadata(
  repo: Repo,
  metadata: BcrMetadata | null | undefined,
): Promise<number[]> {
  const detected: number[] = [];

  if (!metadata || !metadata.maintainers || metadata.maintainers.length === 0) {
    return detected;
  }

  for (const username of metadata.maintainers) {
    try {
      const githubUserId = await getGitHubUserIdByLogin(username);
      if (githubUserId === null) {
        // User not found in database - skip silently
        continue;
      }

      await upsertMaintainer(repo.id, githubUserId, "bcr-metadata", 100);
      detected.push(githubUserId);
    } catch (error) {
      // Log but don't throw - continue processing other maintainers
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to upsert maintainer ${username} from BCR metadata for repo ${repo.full_name}: ${errorMessage}`,
      );
    }
  }

  return detected;
}

/**
 * Detects maintainers from CODEOWNERS file.
 * For each username in the CODEOWNERS list, looks up the GitHub user ID and upserts a maintainership record.
 * Uses lower confidence (90) since CODEOWNERS tends to over-include users.
 *
 * @param repo - Repository object from sync
 * @param codeowners - List of usernames parsed from CODEOWNERS file (if available)
 * @returns Array of detected maintainer user IDs
 */
export async function detectMaintainersFromCodeowners(
  repo: Repo,
  codeowners: string[] | null | undefined,
): Promise<number[]> {
  const detected: number[] = [];

  if (!codeowners || codeowners.length === 0) {
    return detected;
  }

  for (const username of codeowners) {
    try {
      const githubUserId = await getGitHubUserIdByLogin(username);
      if (githubUserId === null) {
        // User not found in database - skip silently
        continue;
      }

      await upsertMaintainer(repo.id, githubUserId, "codeowners", 90);
      detected.push(githubUserId);
    } catch (error) {
      // Log but don't throw - continue processing other maintainers
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to upsert maintainer ${username} from CODEOWNERS for repo ${repo.full_name}: ${errorMessage}`,
      );
    }
  }

  return detected;
}

/**
 * Aggregates maintainer signals from all available sources.
 * Calls all detection functions based on whatever data the sync step has collected for this repo.
 *
 * @param repo - Repository object from sync
 * @param options - Optional data collected during sync
 * @param options.contributors - Contributors with permission info (if available)
 * @param options.bcrMetadata - Parsed BCR metadata (if available)
 * @param options.codeowners - List of CODEOWNERS usernames (if available)
 * @returns List of (github_user_id, sources) tuples for debugging
 */
export async function aggregateMaintainerSignals(
  repo: Repo,
  options?: {
    contributors?: Contributor[];
    bcrMetadata?: BcrMetadata | null;
    codeowners?: string[] | null;
  },
): Promise<Array<{ github_user_id: number; sources: string[] }>> {
  const maintainerMap = new Map<number, Set<string>>();

  // Helper to record a maintainer detection
  const recordMaintainer = (userId: number, source: string) => {
    if (!maintainerMap.has(userId)) {
      maintainerMap.set(userId, new Set());
    }
    maintainerMap.get(userId)!.add(source);
  };

  // Detect from GitHub permissions
  if (options?.contributors) {
    const detected = await detectMaintainersFromGitHubPermissions(
      repo,
      options.contributors,
    );
    for (const userId of detected) {
      recordMaintainer(userId, "github-permissions");
    }
  }

  // Detect from BCR metadata
  if (options?.bcrMetadata) {
    const detected = await detectMaintainersFromBcrMetadata(
      repo,
      options.bcrMetadata,
    );
    for (const userId of detected) {
      recordMaintainer(userId, "bcr-metadata");
    }
  }

  // Detect from CODEOWNERS
  if (options?.codeowners) {
    const detected = await detectMaintainersFromCodeowners(
      repo,
      options.codeowners,
    );
    for (const userId of detected) {
      recordMaintainer(userId, "codeowners");
    }
  }

  // Convert map to array for return
  return Array.from(maintainerMap.entries()).map(
    ([github_user_id, sources]) => ({
      github_user_id,
      sources: Array.from(sources),
    }),
  );
}
