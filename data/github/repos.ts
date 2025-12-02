/**
 * GitHub Repository Fetching
 *
 * This module provides functions to fetch repositories from a GitHub organization.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { GitHubAPI } from "./client.js";

interface OrgSyncConfig {
  include: "*" | string[];
  exclude?: string[];
}

interface SyncConfig {
  [org: string]: OrgSyncConfig;
}

/**
 * Loads sync configuration from sync-config.json file.
 *
 * @returns Sync configuration object mapping org names to include/exclude config
 */
function loadSyncConfig(): SyncConfig {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const configPath = join(__dirname, "../../sync-config.json");

  try {
    const configContent = readFileSync(configPath, "utf-8");
    const rawConfig = JSON.parse(configContent) as Record<string, unknown>;

    // Migrate old format (string "*" or array) to new format
    const migratedConfig: SyncConfig = {};
    for (const [org, value] of Object.entries(rawConfig)) {
      if (typeof value === "string" && value === "*") {
        migratedConfig[org] = { include: "*", exclude: [] };
      } else if (Array.isArray(value)) {
        migratedConfig[org] = { include: value, exclude: [] };
      } else if (
        typeof value === "object" &&
        value !== null &&
        "include" in value
      ) {
        migratedConfig[org] = value as OrgSyncConfig;
      } else {
        throw new Error(
          `Invalid config format for ${org}: expected "*", array, or {include, exclude} object`,
        );
      }
    }

    return migratedConfig;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load sync-config.json from ${configPath}: ${errorMessage}`,
    );
  }
}

/**
 * Filters repositories based on sync configuration.
 *
 * @param repos - All repositories from the org
 * @param config - Sync configuration for the org with include/exclude rules
 * @returns Filtered list of repositories to sync
 */
function filterReposByConfig(repos: Repo[], config: OrgSyncConfig): Repo[] {
  const excludeSet = new Set(config.exclude || []);

  // First, apply include filter
  let included: Repo[];
  if (config.include === "*") {
    included = repos;
  } else {
    // Filter to only repos in the include list
    const includeSet = new Set(config.include);
    included = repos.filter((repo) => {
      // Match by full_name (owner/repo) or just repo name
      return (
        includeSet.has(repo.full_name) ||
        includeSet.has(repo.name) ||
        includeSet.has(repo.full_name.split("/")[1])
      );
    });
  }

  // Then, apply exclude filter
  return included.filter((repo) => {
    // Exclude if matches any exclude pattern
    return !(
      excludeSet.has(repo.full_name) ||
      excludeSet.has(repo.name) ||
      excludeSet.has(repo.full_name.split("/")[1])
    );
  });
}

export interface Repo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
  updated_at: string;
}

/**
 * Fetches all repositories for a given GitHub organization or user.
 * Handles pagination automatically.
 * Works for both organizations and user accounts.
 * Filters out any repositories that are:
 * - archived
 * - not included per the sync-config.json include/exclude rules
 */
export async function fetchOrgRepos(
  orgOrUser: string,
  api: GitHubAPI,
): Promise<Repo[]> {
  const allRepos: Repo[] = [];
  let page = 1;
  const perPage = 100;

  // Try organization endpoint first, fall back to user endpoint if 404
  let endpoint = "/orgs/{org}/repos";
  let paramName = "org";
  let isOrg = true;

  while (true) {
    try {
      const repos = await api.request<Repo[]>({
        method: "GET",
        url: endpoint,
        [paramName]: orgOrUser,
        page,
        per_page: perPage,
        sort: "updated",
        direction: "desc",
      });

      if (repos.length === 0) {
        break;
      }

      allRepos.push(...repos);

      // If we got fewer than perPage results, we're on the last page
      if (repos.length < perPage) {
        break;
      }

      page++;
    } catch (error: unknown) {
      // If 404 and we haven't tried user endpoint yet, switch to user endpoint
      const status = (error as { status?: number })?.status;
      if (status === 404 && isOrg) {
        // Retry with user endpoint
        endpoint = "/users/{username}/repos";
        paramName = "username";
        isOrg = false;
        page = 1; // Reset to first page
        continue;
      }
      // Re-throw other errors
      throw error;
    }
  }

  // Filter out archived repositories
  const nonArchivedRepos = allRepos.filter((repo) => !repo.archived);

  // Apply sync-config.json filtering if config exists
  try {
    const syncConfig = loadSyncConfig();
    const orgConfig = syncConfig[orgOrUser];

    if (orgConfig) {
      return filterReposByConfig(nonArchivedRepos, orgConfig);
    }
  } catch (error) {
    // If config file doesn't exist or is invalid, log warning but continue
    // This allows the function to work even without a config file
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️  Could not load sync-config.json, syncing all non-archived repos: ${errorMessage}`,
    );
  }

  // If no config or config loading failed, return all non-archived repos
  return nonArchivedRepos;
}
