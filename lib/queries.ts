/**
 * Read-only Database Queries
 *
 * Provides read-only query functions for the Next.js app.
 * No business logic, just SQL queries.
 */

import { query } from "./db.js";

export interface RepoRow {
  id: number;
  github_id: number;
  name: string;
  full_name: string;
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface IssueRow {
  id: number;
  github_id: number;
  repo_github_id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: unknown; // JSONB
  assignees: unknown; // JSONB
  author_login: string;
  synced_at: string;
}

export interface PullRequestRow {
  id: number;
  github_id: number;
  repo_github_id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  author_login: string;
  assignees: unknown; // JSONB
  labels: unknown; // JSONB
  additions: number | null;
  deletions: number | null;
  changed_files: number | null;
  merged: boolean;
  merged_at: string | null;
  merge_commit_sha: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  synced_at: string;
}

/**
 * Gets all repositories ordered by name.
 *
 * @returns Array of repository rows
 */
export async function getRepos(): Promise<RepoRow[]> {
  return query<RepoRow>(
    `SELECT id, github_id, name, full_name, private, archived, pushed_at, updated_at, created_at
     FROM repos
     ORDER BY name ASC`,
  );
}

/**
 * Gets all issues for a repository ordered by updated_at descending.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @returns Array of issue rows
 */
export async function getRepoIssues(repoGithubId: number): Promise<IssueRow[]> {
  return query<IssueRow>(
    `SELECT id, github_id, repo_github_id, number, title, body, state,
            created_at, updated_at, closed_at, labels, assignees, author_login, synced_at
     FROM issues
     WHERE repo_github_id = $1
     ORDER BY updated_at DESC`,
    [repoGithubId],
  );
}

/**
 * Gets all pull requests for a repository ordered by updated_at descending.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @returns Array of pull request rows
 */
export async function getRepoPullRequests(
  repoGithubId: number,
): Promise<PullRequestRow[]> {
  return query<PullRequestRow>(
    `SELECT id, github_id, repo_github_id, number, title, body, state, draft,
            author_login, assignees, labels, additions, deletions, changed_files,
            merged, merged_at, merge_commit_sha, created_at, updated_at, closed_at, synced_at
     FROM pull_requests
     WHERE repo_github_id = $1
     ORDER BY updated_at DESC`,
    [repoGithubId],
  );
}
