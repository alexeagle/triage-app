/**
 * GitHub Repository Fetching
 *
 * This module provides functions to fetch repositories from a GitHub organization.
 */

import { GitHubAPI } from "./client.js";

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

  return allRepos;
}
