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
import { GitHubAPI } from "../data/github/client.js";
import { fetchRepoFile } from "../data/github/files.js";

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
 * BCR metadata template structure from .bcr/metadata.template.json
 */
export interface BcrMetadataTemplate {
  homepage?: string;
  maintainers?: Array<{
    email?: string;
    github?: string;
    github_user_id?: number;
    name?: string;
  }>;
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
 * Parses CODEOWNERS file content and extracts usernames.
 * Handles GitHub CODEOWNERS format (lines starting with paths, followed by @usernames or emails).
 *
 * @param content - CODEOWNERS file content
 * @returns Array of GitHub usernames (without @ prefix)
 */
function parseCodeowners(content: string): string[] {
  const usernames = new Set<string>();
  const lines = content.split("\n");

  for (const line of lines) {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Split by whitespace and extract usernames/emails
    const parts = trimmed.split(/\s+/);
    for (const part of parts) {
      // Skip path patterns (they don't start with @)
      if (part.startsWith("@")) {
        // Remove @ prefix
        usernames.add(part.substring(1));
      } else if (part.includes("@") && part.includes(".")) {
        // Email address - extract username part if it's a GitHub email
        // Format: username@users.noreply.github.com
        const emailMatch = part.match(/^([^@]+)@users\.noreply\.github\.com$/);
        if (emailMatch) {
          usernames.add(emailMatch[1]);
        }
      }
    }
  }

  return Array.from(usernames);
}

/**
 * Fetches and parses CODEOWNERS file from GitHub repository.
 *
 * @param repo - Repository object
 * @param api - GitHub API client instance
 * @returns Array of usernames from CODEOWNERS, or null if file doesn't exist
 */
export async function fetchCodeownersFromRepo(
  repo: Repo,
  api: GitHubAPI,
): Promise<string[] | null> {
  // Try common CODEOWNERS locations
  const codeownersPaths = [
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "docs/CODEOWNERS",
  ];

  for (const path of codeownersPaths) {
    try {
      const content = await fetchRepoFile(repo, path, api);
      if (content) {
        return parseCodeowners(content);
      }
    } catch (error) {
      // Continue to next path
      continue;
    }
  }

  return null;
}

/**
 * Detects maintainers from CODEOWNERS file.
 * For each username in the CODEOWNERS list, looks up the GitHub user ID and upserts a maintainership record.
 * Uses lower confidence (90) since CODEOWNERS tends to over-include users.
 *
 * @param repo - Repository object from sync
 * @param codeowners - List of usernames parsed from CODEOWNERS file (if available)
 * @param alsoMarkInUsersTable - If true, also mark users as maintainers in github_users table
 * @returns Array of detected maintainer user IDs
 */
export async function detectMaintainersFromCodeowners(
  repo: Repo,
  codeowners: string[] | null | undefined,
  alsoMarkInUsersTable: boolean = false,
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

      // Optionally mark in github_users table (for syncRepoMaintainers)
      if (alsoMarkInUsersTable) {
        const { markMaintainer } = await import("../data/db/githubUsers.js");
        await markMaintainer(githubUserId, "codeowners");
      }

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
 * Fetches and parses .bcr/metadata.template.json from GitHub repository.
 *
 * @param repo - Repository object
 * @param api - GitHub API client instance
 * @returns Parsed metadata template, or null if file doesn't exist
 */
export async function fetchBcrMetadataTemplate(
  repo: Repo,
  api: GitHubAPI,
): Promise<BcrMetadataTemplate | null> {
  try {
    const content = await fetchRepoFile(
      repo,
      ".bcr/metadata.template.json",
      api,
    );
    if (!content) {
      return null;
    }

    const metadata = JSON.parse(content) as BcrMetadataTemplate;
    return metadata;
  } catch (error) {
    // File not found or invalid JSON - return null
    return null;
  }
}

/**
 * Detects maintainers from BCR metadata template file.
 * Extracts GitHub handles from the maintainers array and upserts maintainership records.
 *
 * @param repo - Repository object from sync
 * @param metadataTemplate - Parsed metadata template from .bcr/metadata.template.json
 * @param alsoMarkInUsersTable - If true, also mark users as maintainers in github_users table
 * @returns Array of detected maintainer user IDs
 */
export async function detectMaintainersFromBcrMetadataTemplate(
  repo: Repo,
  metadataTemplate: BcrMetadataTemplate | null | undefined,
  alsoMarkInUsersTable: boolean = false,
): Promise<number[]> {
  const detected: number[] = [];

  if (
    !metadataTemplate ||
    !metadataTemplate.maintainers ||
    metadataTemplate.maintainers.length === 0
  ) {
    return detected;
  }

  for (const maintainer of metadataTemplate.maintainers) {
    // Extract GitHub handle from maintainer object
    const githubHandle = maintainer.github;
    if (!githubHandle) {
      continue;
    }

    try {
      // Prefer github_user_id if available, otherwise look up by login
      let githubUserId: number | null = null;
      if (maintainer.github_user_id) {
        githubUserId = maintainer.github_user_id;
      } else {
        githubUserId = await getGitHubUserIdByLogin(githubHandle);
      }

      if (githubUserId === null) {
        // User not found in database - skip silently
        continue;
      }

      await upsertMaintainer(repo.id, githubUserId, "bcr-metadata", 100);

      // Optionally mark in github_users table (for syncRepoMaintainers)
      if (alsoMarkInUsersTable) {
        const { markMaintainer } = await import("../data/db/githubUsers.js");
        await markMaintainer(githubUserId, "bcr-metadata");
      }

      detected.push(githubUserId);
    } catch (error) {
      // Log but don't throw - continue processing other maintainers
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to upsert maintainer ${githubHandle} from BCR metadata template for repo ${repo.full_name}: ${errorMessage}`,
      );
    }
  }

  return detected;
}

/**
 * Detects maintainers from CODEOWNERS and BCR metadata template files.
 * This is used to supplement GitHub collaborators API data.
 *
 * @param repo - Repository object
 * @param api - GitHub API client instance
 * @param alsoMarkInUsersTable - If true, also mark users as maintainers in github_users table
 * @returns Object with counts and user IDs from both sources
 */
export async function detectMaintainersFromFiles(
  repo: Repo,
  api: GitHubAPI,
  alsoMarkInUsersTable: boolean = false,
): Promise<{ codeowners: number[]; bcrMetadata: number[] }> {
  const result = {
    codeowners: [] as number[],
    bcrMetadata: [] as number[],
  };

  // Try CODEOWNERS file
  try {
    const codeownersUsernames = await fetchCodeownersFromRepo(repo, api);
    if (codeownersUsernames && codeownersUsernames.length > 0) {
      const detected = await detectMaintainersFromCodeowners(
        repo,
        codeownersUsernames,
        alsoMarkInUsersTable,
      );
      result.codeowners = detected;
      if (detected.length > 0) {
        console.log(`  ✓ Maintainers from CODEOWNERS: ${detected.length}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `  ⚠ Failed to fetch CODEOWNERS for ${repo.full_name}: ${errorMessage}`,
    );
  }

  // Try BCR metadata template
  try {
    const metadataTemplate = await fetchBcrMetadataTemplate(repo, api);
    if (
      metadataTemplate &&
      metadataTemplate.maintainers &&
      metadataTemplate.maintainers.length > 0
    ) {
      const detected = await detectMaintainersFromBcrMetadataTemplate(
        repo,
        metadataTemplate,
        alsoMarkInUsersTable,
      );
      result.bcrMetadata = detected;
      if (detected.length > 0) {
        console.log(
          `  ✓ Maintainers from BCR metadata template: ${detected.length}`,
        );
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `  ⚠ Failed to fetch BCR metadata template for ${repo.full_name}: ${errorMessage}`,
    );
  }

  return result;
}

/**
 * Attempts to detect maintainers from CODEOWNERS file as a fallback when permission errors occur.
 * If CODEOWNERS is not found, tries .bcr/metadata.template.json as a second fallback.
 * This is a helper function to reduce duplication between sync workers.
 * @deprecated Use detectMaintainersFromFiles instead for comprehensive detection
 *
 * @param repo - Repository object
 * @param api - GitHub API client instance
 * @param alsoMarkInUsersTable - If true, also mark users as maintainers in github_users table
 * @returns Object with count, user IDs, and source, or null if both fallbacks failed
 */
export async function fallbackToCodeowners(
  repo: Repo,
  api: GitHubAPI,
  alsoMarkInUsersTable: boolean = false,
): Promise<{
  count: number;
  userIds: number[];
  source: "codeowners" | "bcr-metadata";
} | null> {
  const result = await detectMaintainersFromFiles(
    repo,
    api,
    alsoMarkInUsersTable,
  );

  // Return first available source for backward compatibility
  if (result.codeowners.length > 0) {
    return {
      count: result.codeowners.length,
      userIds: result.codeowners,
      source: "codeowners",
    };
  }
  if (result.bcrMetadata.length > 0) {
    return {
      count: result.bcrMetadata.length,
      userIds: result.bcrMetadata,
      source: "bcr-metadata",
    };
  }
  return null;
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
