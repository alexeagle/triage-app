/**
 * GitHub Issues Fetching
 *
 * This module provides functions to fetch issues from a GitHub repository.
 */

import { GitHubAPI } from "./client.js";
import { Repo } from "./repos.js";

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  user: {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
    type: "User" | "Bot";
  };
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  assignees: Array<{
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
    type: "User" | "Bot";
  }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: {
    url: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
  };
}

export interface IssueBatch {
  issues: Issue[];
  page: number;
  hasMore: boolean;
}

/**
 * Fetches issues for a repository as an async generator.
 * Yields batches of issues with pagination information.
 * Automatically filters out pull requests.
 *
 * @param repo - Repository object with owner and name
 * @param api - GitHub API client instance
 * @param since - Optional ISO timestamp to fetch only issues updated after this time
 */
export async function* fetchRepoIssues(
  repo: Repo,
  api: GitHubAPI,
  since?: string,
): AsyncGenerator<IssueBatch> {
  let page = 1;
  const perPage = 100;

  while (true) {
    const params: Record<string, unknown> = {
      owner: repo.owner.login,
      repo: repo.name,
      state: "all",
      page,
      per_page: perPage,
      sort: "updated",
      direction: "desc",
    };

    if (since) {
      params.since = since;
    }

    const items = await api.request<Issue[]>({
      method: "GET",
      url: "/repos/{owner}/{repo}/issues",
      ...params,
    });

    // Filter out pull requests (they have a pull_request field)
    const issues = items.filter((item) => !item.pull_request);

    const hasMore = items.length === perPage;

    yield {
      issues,
      page,
      hasMore,
    };

    if (!hasMore) {
      break;
    }

    page++;
  }
}

/**
 * Fetches issues updated since a specific timestamp.
 * Used for incremental sync - only returns issues that have been updated after the given time.
 * Automatically filters out pull requests (GitHub API returns both issues and PRs).
 *
 * @param repo - Repository object with owner and name
 * @param api - GitHub API client instance
 * @param sinceTimestamp - ISO 8601 timestamp (YYYY-MM-DDTHH:MM:SSZ) to fetch issues updated after this time
 * @returns Async generator yielding batches of issues
 */
export async function* fetchUpdatedIssuesSince(
  repo: Repo,
  api: GitHubAPI,
  sinceTimestamp: string,
): AsyncGenerator<IssueBatch> {
  let page = 1;
  const perPage = 100;

  while (true) {
    const items = await api.request<Issue[]>({
      method: "GET",
      url: "/repos/{owner}/{repo}/issues",
      owner: repo.owner.login,
      repo: repo.name,
      state: "all",
      since: sinceTimestamp,
      page,
      per_page: perPage,
      sort: "updated",
      direction: "desc",
    });

    // Filter out pull requests (they have a pull_request field)
    // GitHub API returns both issues and PRs when querying /issues endpoint
    const issues = items.filter((item) => !item.pull_request);

    const hasMore = items.length === perPage;

    yield {
      issues,
      page,
      hasMore,
    };

    if (!hasMore) {
      break;
    }

    page++;
  }
}
