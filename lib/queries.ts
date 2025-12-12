/**
 * Read-only Database Queries
 *
 * Provides read-only query functions for the Next.js app.
 * No business logic, just SQL queries.
 */

import { query } from "./db";

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
  repo_full_name?: string; // Optional, populated when joined with repos table
  author_avatar_url?: string | null; // Optional, populated when joined with github_users table
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
  repo_full_name?: string; // Optional, populated when joined with repos table
}

export interface RepoStatsRow {
  repo_github_id: number;
  open_issues_count: number;
  open_prs_count: number;
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
 * Gets all open issues for a repository ordered by updated_at descending.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @returns Array of open issue rows
 */
export async function getRepoIssues(repoGithubId: number): Promise<IssueRow[]> {
  return query<IssueRow>(
    `SELECT i.id, i.github_id, i.repo_github_id, i.number, i.title, i.body, i.state,
            i.created_at, i.updated_at, i.closed_at, i.labels, i.assignees, i.author_login, i.synced_at,
            gu.avatar_url as author_avatar_url
     FROM issues i
     LEFT JOIN github_users gu ON i.author_login = gu.login
     WHERE i.repo_github_id = $1 AND i.state = 'open'
     ORDER BY i.updated_at DESC`,
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

/**
 * Gets statistics for all repositories including open issues and PR counts.
 *
 * @returns Array of repository stats rows with repo_github_id, open_issues_count, and open_prs_count
 */
export async function getRepoStats(): Promise<RepoStatsRow[]> {
  return query<RepoStatsRow>(
    `SELECT 
       r.github_id as repo_github_id,
       COUNT(DISTINCT CASE WHEN i.state = 'open' THEN i.id END)::int as open_issues_count,
       COUNT(DISTINCT CASE WHEN pr.state = 'open' THEN pr.id END)::int as open_prs_count
     FROM repos r
     LEFT JOIN issues i ON r.github_id = i.repo_github_id
     LEFT JOIN pull_requests pr ON r.github_id = pr.repo_github_id
     GROUP BY r.github_id`,
  );
}

/**
 * Gets all unique organizations from repositories.
 * Extracts the organization name from full_name (everything before the first "/").
 *
 * @returns Array of organization names, sorted alphabetically
 */
export async function getOrgs(): Promise<string[]> {
  const result = await query<{ org: string }>(
    `SELECT DISTINCT 
       SPLIT_PART(full_name, '/', 1) as org
     FROM repos
     ORDER BY org ASC`,
  );
  return result.map((row) => row.org);
}

/**
 * Gets all repositories for a specific organization.
 *
 * @param org - Organization name
 * @returns Array of repository rows for that organization
 */
export async function getReposByOrg(org: string): Promise<RepoRow[]> {
  return query<RepoRow>(
    `SELECT id, github_id, name, full_name, private, archived, pushed_at, updated_at, created_at
     FROM repos
     WHERE full_name LIKE $1
     ORDER BY name ASC`,
    [`${org}/%`],
  );
}

export const PAGE_SIZE = 20;

export interface IssueTurnRow {
  issue_github_id: number;
  repo_full_name: string;
  issue_number: number;
  title: string;
  turn: "maintainer" | "author";
  last_comment_at: string | null;
  last_comment_author: string | null;
}

/**
 * Gets all open issues with their "turn" status (whose turn is it to respond).
 * Uses the issue_turns view to compute turn logic based on comment history.
 *
 * @returns Array of issue turn rows
 */
export async function getIssueTurns(): Promise<IssueTurnRow[]> {
  return query<IssueTurnRow>(
    `SELECT 
      issue_github_id,
      repo_full_name,
      issue_number,
      title,
      turn,
      last_comment_at,
      last_comment_author
    FROM issue_turns
    ORDER BY issue_github_id`,
  );
}

/**
 * Gets issue turns for a specific repository.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @returns Array of issue turn rows for that repository
 */
export async function getIssueTurnsByRepo(
  repoGithubId: number,
): Promise<IssueTurnRow[]> {
  return query<IssueTurnRow>(
    `SELECT 
      it.issue_github_id,
      it.repo_full_name,
      it.issue_number,
      it.title,
      it.turn,
      it.last_comment_at,
      it.last_comment_author
    FROM issue_turns it
    INNER JOIN issues i ON it.issue_github_id = i.github_id
    WHERE i.repo_github_id = $1
    ORDER BY it.issue_github_id`,
    [repoGithubId],
  );
}

/**
 * Gets open issues by author login, ordered by updated_at descending.
 *
 * @param author - Author login (GitHub username)
 * @returns Array of open issue rows with repository full name
 */
export async function getIssuesByAuthor(
  author: string,
  offset: number,
): Promise<{ issues: IssueRow[]; total: number }> {
  const issues = await query<IssueRow>(
    `SELECT
      i.id,
      i.github_id,
      i.repo_github_id,
      i.number,
      i.title,
      i.body,
      i.state,
      i.created_at,
      i.updated_at,
      i.closed_at,
      i.labels,
      i.assignees,
      i.author_login,
      i.synced_at,
      r.full_name as repo_full_name,
      gu.avatar_url as author_avatar_url
    FROM issues i
    INNER JOIN repos r ON i.repo_github_id = r.github_id
    LEFT JOIN github_users gu ON i.author_login = gu.login
    WHERE i.author_login = $1 AND i.state = 'open'
    ORDER BY i.updated_at DESC
    LIMIT $2
    OFFSET $3
    `,
    [author, PAGE_SIZE, offset],
  );
  const totalResult = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
      FROM issues
      WHERE author_login = $1 AND state = 'open'`,
    [author],
  );
  const total = totalResult[0].count;
  return { issues, total };
}

/**
 * Gets all pull requests where author_login does NOT contain "bot", ordered by updated_at descending.
 * Includes repository full name for display.
 *
 * @returns Array of pull request rows with repository full name
 */
export async function getNonBotPullRequests(): Promise<PullRequestRow[]> {
  return query<PullRequestRow>(
    `SELECT
      pr.id,
      pr.github_id,
      pr.repo_github_id,
      pr.number,
      pr.title,
      pr.body,
      pr.state,
      pr.draft,
      pr.author_login,
      pr.assignees,
      pr.labels,
      pr.additions,
      pr.deletions,
      pr.changed_files,
      pr.merged,
      pr.merged_at,
      pr.merge_commit_sha,
      pr.created_at,
      pr.updated_at,
      pr.closed_at,
      pr.synced_at,
      r.full_name as repo_full_name
    FROM pull_requests pr
    INNER JOIN repos r ON pr.repo_github_id = r.github_id
    WHERE LOWER(pr.author_login) NOT LIKE '%bot%'
    ORDER BY pr.updated_at DESC`,
  );
}
