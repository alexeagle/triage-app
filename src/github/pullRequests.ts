/**
 * GitHub Pull Request Fetching
 *
 * This module provides functions to fetch pull requests from a GitHub repository.
 */

import { GitHubAPI } from "./client.js";
import { Repo } from "./repos.js";

/**
 * Normalized pull request object ready for database upsert.
 * Matches the pull_requests table schema.
 */
export interface PullRequest {
  id: number; // github_id
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  author_login: string;
  assignees: Array<{
    login: string;
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  additions: number | null;
  deletions: number | null;
  changed_files: number | null;
  merged: boolean;
  merged_at: string | null;
  merge_commit_sha: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

/**
 * Raw GitHub API pull request response.
 * Used internally to map from API response to normalized format.
 */
interface GitHubPullRequestResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  user: {
    login: string;
  };
  assignees: Array<{
    login: string;
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  merged: boolean;
  merged_at: string | null;
  merge_commit_sha: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface PRBatch {
  pullRequests: PullRequest[];
  page: number;
  hasMore: boolean;
}

/**
 * File stats from GitHub API.
 */
export interface FileStats {
  additions: number;
  deletions: number;
  changed_files: number;
}

/**
 * Pull request review from GitHub API.
 */
export interface PullRequestReview {
  reviewer_login: string;
  state:
    | "APPROVED"
    | "CHANGES_REQUESTED"
    | "COMMENTED"
    | "DISMISSED"
    | "PENDING";
  submitted_at: string;
}

/**
 * Fetches pull requests for a repository as an async generator.
 * Yields batches of pull requests with pagination information.
 *
 * @param repo - Repository object with owner and name
 * @param api - GitHub API client instance
 * @param since - Optional ISO timestamp to fetch only PRs updated after this time
 */
export async function* fetchRepoPullRequests(
  repo: Repo,
  api: GitHubAPI,
  since?: string,
): AsyncGenerator<PRBatch> {
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

    const items = await api.request<GitHubPullRequestResponse[]>({
      method: "GET",
      url: "/repos/{owner}/{repo}/pulls",
      ...params,
    });

    // Normalize PRs to match our schema
    const pullRequests: PullRequest[] = items.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      draft: pr.draft,
      author_login: pr.user.login,
      assignees: pr.assignees.map((a) => ({ login: a.login })),
      labels: pr.labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      })),
      // File stats are not included in the list endpoint, will be fetched separately
      additions: pr.additions ?? null,
      deletions: pr.deletions ?? null,
      changed_files: pr.changed_files ?? null,
      merged: pr.merged,
      merged_at: pr.merged_at,
      merge_commit_sha: pr.merge_commit_sha,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      closed_at: pr.closed_at,
    }));

    const hasMore = items.length === perPage;

    yield {
      pullRequests,
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
 * Fetches file statistics for a pull request.
 * Returns additions, deletions, and changed_files count.
 *
 * @param repo - Repository object with owner and name
 * @param prNumber - Pull request number
 * @param api - GitHub API client instance
 * @returns File statistics
 */
export async function fetchPullRequestFileStats(
  repo: Repo,
  prNumber: number,
  api: GitHubAPI,
): Promise<FileStats> {
  const files = await api.request<
    Array<{
      additions: number;
      deletions: number;
    }>
  >({
    method: "GET",
    url: "/repos/{owner}/{repo}/pulls/{pull_number}/files",
    owner: repo.owner.login,
    repo: repo.name,
    pull_number: prNumber,
    per_page: 100, // Max per page, but we only need the count
  });

  // Calculate totals
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const changed_files = files.length;

  return {
    additions,
    deletions,
    changed_files,
  };
}

/**
 * Fetches reviews for a pull request.
 * Returns reviewer login, state, and submitted_at timestamp.
 *
 * @param repo - Repository object with owner and name
 * @param prNumber - Pull request number
 * @param api - GitHub API client instance
 * @returns Array of pull request reviews
 */
export async function fetchPullRequestReviews(
  repo: Repo,
  prNumber: number,
  api: GitHubAPI,
): Promise<PullRequestReview[]> {
  const reviews = await api.request<
    Array<{
      user: {
        login: string;
      };
      state:
        | "APPROVED"
        | "CHANGES_REQUESTED"
        | "COMMENTED"
        | "DISMISSED"
        | "PENDING";
      submitted_at: string;
    }>
  >({
    method: "GET",
    url: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
    owner: repo.owner.login,
    repo: repo.name,
    pull_number: prNumber,
  });

  return reviews.map((review) => ({
    reviewer_login: review.user.login,
    state: review.state,
    submitted_at: review.submitted_at,
  }));
}
