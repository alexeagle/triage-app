/**
 * GitHub Starred Repositories API
 *
 * Fetches repositories that a user has starred.
 */

import { request } from "@octokit/request";
import type { Repo } from "./repos.js";

interface GitHubStarredRepoItem {
  starred_at: string; // When the user starred this repo
  repo: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    archived: boolean;
    pushed_at: string | null;
    updated_at: string;
  };
}

/**
 * Fetches all starred repositories for a given GitHub user.
 * Handles pagination automatically.
 * Only returns public repositories.
 *
 * @param username - GitHub username
 * @param accessToken - GitHub OAuth access token for the user
 * @returns Array of starred repositories with starred_at timestamp
 */
export async function fetchStarredRepos(
  username: string,
  accessToken: string,
): Promise<Array<Repo & { starred_at: string }>> {
  const allRepos: Array<Repo & { starred_at: string }> = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await request({
      method: "GET",
      url: "/users/{username}/starred",
      username,
      page,
      per_page: perPage,
      sort: "updated",
      direction: "desc",
      headers: {
        authorization: `token ${accessToken}`,
        accept: "application/vnd.github.v3.star+json", // Include starred_at in response
      },
    });

    const starredItems = response.data as GitHubStarredRepoItem[];

    // Validate response structure
    if (!Array.isArray(starredItems)) {
      console.error(
        `Unexpected response format from GitHub API for user ${username}, page ${page}`,
      );
      console.error(
        `Response type: ${typeof response.data}, keys: ${Object.keys(response.data || {}).join(", ")}`,
      );
      break;
    }

    if (starredItems.length === 0) {
      break;
    }

    // Extract repos from the nested structure (starred_at is at top level, repo data is nested)
    const publicRepos: Array<Repo & { starred_at: string }> = starredItems
      .filter((item) => {
        const repo = item.repo;
        // Skip private repos
        if (repo.private) {
          return false;
        }

        // Check for required fields
        if (!repo.full_name || !repo.name || !repo.id) {
          return false;
        }
        return true;
      })
      .map((item) => {
        const repo = item.repo;
        // Extract owner from full_name (format: "owner/repo")
        const ownerLogin = repo.full_name.split("/")[0];

        return {
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          archived: repo.archived || false,
          pushed_at: repo.pushed_at,
          updated_at: repo.updated_at,
          owner: {
            login: ownerLogin,
          },
          starred_at: item.starred_at,
        };
      });

    allRepos.push(...publicRepos);

    // If we got fewer than perPage results, we're on the last page
    if (starredItems.length < perPage) {
      break;
    }

    page++;
  }

  return allRepos;
}
