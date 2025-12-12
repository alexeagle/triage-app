/**
 * GitHub Collaborators Fetching
 *
 * This module provides functions to fetch collaborators from a GitHub repository.
 */

import { GitHubAPI } from "./client.js";
import { Repo } from "./repos.js";

/**
 * GitHub API response for a repository collaborator.
 */
export interface Collaborator {
  id: number;
  login: string;
  avatar_url: string;
  type: "User" | "Bot";
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean; // write permission
    triage: boolean;
    pull: boolean; // read permission
  };
}

/**
 * Fetches collaborators for a repository from GitHub API.
 * Handles pagination automatically.
 *
 * @param repo - Repository object with owner and name
 * @param api - GitHub API client instance
 * @returns Array of collaborators
 */
export async function fetchRepoCollaborators(
  repo: Repo,
  api: GitHubAPI,
): Promise<Collaborator[]> {
  const allCollaborators: Collaborator[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const collaborators = await api.request<Collaborator[]>({
      method: "GET",
      url: "/repos/{owner}/{repo}/collaborators",
      owner: repo.owner.login,
      repo: repo.name,
      affiliation: "direct",
      page,
      per_page: perPage,
    });

    if (collaborators.length === 0) {
      break;
    }

    allCollaborators.push(...collaborators);

    // If we got fewer than perPage results, we're on the last page
    if (collaborators.length < perPage) {
      break;
    }

    page++;
  }

  return allCollaborators;
}
