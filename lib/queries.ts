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
  author_is_maintainer?: boolean | null; // Optional, populated when joined with github_users table
  author_bio?: string | null; // Optional, populated when joined with github_users table
  author_company?: string | null; // Optional, populated when joined with github_users table
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
  turn?: "maintainer" | "author" | null; // Optional, populated when joined with issue_turns
  author_avatar_url?: string | null; // Optional, populated when joined with github_users table
  author_is_maintainer?: boolean | null; // Optional, populated when joined with github_users table
  author_bio?: string | null; // Optional, populated when joined with github_users table
  author_company?: string | null; // Optional, populated when joined with github_users table
}

export interface RepoStatsRow {
  repo_github_id: number;
  open_issues_count: number;
  open_prs_count: number;
}

export interface RepoWithPRCount {
  github_id: number;
  full_name: string;
  name: string;
  open_prs_count: number;
  open_issues_count: number;
  stalled_prs_count?: number;
  stalled_issues_count?: number;
}

export interface MaintainerRow {
  github_user_id: number;
  login: string;
  avatar_url: string | null;
  source: string;
  confidence: number;
  last_confirmed_at: string;
  bio?: string | null; // Optional, populated when joined with github_users table
  company?: string | null; // Optional, populated when joined with github_users table
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
            gu.avatar_url as author_avatar_url,
            gu.is_maintainer as author_is_maintainer,
            gu.bio as author_bio,
            gu.company as author_company
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
      it.turn,
      gu.avatar_url as author_avatar_url,
      gu.is_maintainer as author_is_maintainer,
      gu.bio as author_bio,
      gu.company as author_company
     FROM pull_requests pr
     LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
     LEFT JOIN github_users gu ON pr.author_login = gu.login
     WHERE pr.repo_github_id = $1
     ORDER BY pr.updated_at DESC`,
    [repoGithubId],
  );
}

/**
 * Gets statistics for all repositories including open issues and PR counts.
 * If userGithubId is provided, only returns stats for repos the user has starred.
 *
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Array of repository stats rows with repo_github_id, open_issues_count, and open_prs_count
 */
export async function getRepoStats(
  userGithubId?: number | null,
): Promise<RepoStatsRow[]> {
  let sql = `SELECT 
       r.github_id as repo_github_id,
       COUNT(DISTINCT CASE WHEN i.state = 'open' THEN i.id END)::int as open_issues_count,
       COUNT(DISTINCT CASE WHEN pr.state = 'open' THEN pr.id END)::int as open_prs_count
     FROM repos r
     LEFT JOIN issues i ON r.github_id = i.repo_github_id
     LEFT JOIN pull_requests pr ON r.github_id = pr.repo_github_id`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $1`;
  }

  sql += ` GROUP BY r.github_id`;

  return query<RepoStatsRow>(sql, userGithubId ? [userGithubId] : []);
}

/**
 * Gets all unique organizations from repositories.
 * Extracts the organization name from full_name (everything before the first "/").
 * If userGithubId is provided, only returns orgs for repos the user has starred.
 *
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Array of organization names, sorted alphabetically
 */
export async function getOrgs(userGithubId?: number | null): Promise<string[]> {
  let sql = `SELECT DISTINCT 
       SPLIT_PART(r.full_name, '/', 1) as org
     FROM repos r`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $1`;
  }

  sql += ` ORDER BY org ASC`;

  const result = await query<{ org: string }>(
    sql,
    userGithubId ? [userGithubId] : [],
  );
  return result.map((row) => row.org);
}

/**
 * Gets repository counts per organization.
 * If userGithubId is provided, only counts repos the user has starred.
 *
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Array of objects with org name and repo count
 */
export async function getRepoCountsByOrg(
  userGithubId?: number | null,
): Promise<Array<{ org: string; count: number }>> {
  let sql = `SELECT 
       SPLIT_PART(r.full_name, '/', 1) as org,
       COUNT(*)::int as count
     FROM repos r`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $1`;
  }

  sql += ` GROUP BY org
           ORDER BY org ASC`;

  return query<{ org: string; count: number }>(
    sql,
    userGithubId ? [userGithubId] : [],
  );
}

/**
 * Gets all repositories for a specific organization.
 * If userGithubId is provided, only returns repos the user has starred.
 *
 * @param org - Organization name
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Array of repository rows for that organization
 */
export async function getReposByOrg(
  org: string,
  userGithubId?: number | null,
): Promise<RepoRow[]> {
  let sql = `SELECT r.id, r.github_id, r.name, r.full_name, r.private, r.archived, r.pushed_at, r.updated_at, r.created_at
     FROM repos r`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE r.full_name LIKE $1
               AND rs.user_github_id = $2`;
  } else {
    sql += ` WHERE r.full_name LIKE $1`;
  }

  sql += ` ORDER BY r.name ASC`;

  return query<RepoRow>(
    sql,
    userGithubId ? [`${org}/%`, userGithubId] : [`${org}/%`],
  );
}

/**
 * Gets all maintainers for a repository with their source and confidence.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @returns Array of maintainer rows with source and confidence
 */
export async function getRepoMaintainers(
  repoGithubId: number,
): Promise<MaintainerRow[]> {
  return query<MaintainerRow>(
    `SELECT 
      rm.github_user_id,
      gu.login,
      gu.avatar_url,
      rm.source,
      rm.confidence,
      rm.last_confirmed_at,
      gu.bio,
      gu.company
     FROM repo_maintainers rm
     INNER JOIN github_users gu ON rm.github_user_id = gu.github_id
     WHERE rm.repo_github_id = $1
     ORDER BY rm.confidence DESC, rm.source ASC, gu.login ASC`,
    [repoGithubId],
  );
}

export interface RepoWithMaintainerStats {
  github_id: number;
  full_name: string;
  name: string;
  open_prs_count: number;
  open_issues_count: number;
}

/**
 * Gets all repositories where a user is a maintainer, with open PR and issue counts.
 *
 * @param userGithubId - GitHub ID of the user
 * @returns Array of repositories with stats, sorted by full_name
 */
export async function getReposByMaintainer(
  userGithubId: number,
): Promise<RepoWithMaintainerStats[]> {
  return query<RepoWithMaintainerStats>(
    `SELECT 
       r.github_id,
       r.full_name,
       r.name,
       COUNT(DISTINCT CASE WHEN pr.state = 'open' THEN pr.id END)::int as open_prs_count,
       COUNT(DISTINCT CASE WHEN i.state = 'open' THEN i.id END)::int as open_issues_count
     FROM repo_maintainers rm
     INNER JOIN repos r ON rm.repo_github_id = r.github_id
     LEFT JOIN pull_requests pr ON r.github_id = pr.repo_github_id
     LEFT JOIN issues i ON r.github_id = i.repo_github_id
     WHERE rm.github_user_id = $1
     GROUP BY r.github_id, r.full_name, r.name
     ORDER BY r.full_name ASC`,
    [userGithubId],
  );
}

/**
 * Gets top repositories by open PR count.
 * Excludes issues/PRs where turn = 'author' (it's the author's turn to respond).
 * Includes stalled counts based on stall_interval parameter.
 * If userGithubId is provided, only returns repos the user has starred.
 *
 * @param limit - Maximum number of repositories to return (default: 20)
 * @param stallInterval - PostgreSQL interval string (e.g., '14 days') for determining if work is stalled
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Array of repositories with open PR counts and stalled counts, sorted by count descending
 */
export async function getTopReposByOpenPRs(
  limit: number = 20,
  stallInterval: string = "14 days",
  userGithubId?: number | null,
): Promise<RepoWithPRCount[]> {
  let sql = `SELECT 
       r.github_id,
       r.full_name,
       r.name,
       COUNT(DISTINCT CASE 
         WHEN pr.state = 'open' 
         AND LOWER(pr.author_login) NOT LIKE '%bot%'
         AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
         THEN pr.id 
       END)::int as open_prs_count,
       COUNT(DISTINCT CASE 
         WHEN i.state = 'open' 
         AND LOWER(i.author_login) NOT LIKE '%bot%'
         AND (it_i.turn IS NULL OR it_i.turn != 'author')
         THEN i.id 
       END)::int as open_issues_count,
       COUNT(DISTINCT CASE 
         WHEN pr.state = 'open' 
         AND LOWER(pr.author_login) NOT LIKE '%bot%'
         AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
         AND it_pr.turn = 'maintainer'
         AND it_pr.last_maintainer_action_at < NOW() - $2::interval
         THEN pr.id 
       END)::int as stalled_prs_count,
       COUNT(DISTINCT CASE 
         WHEN i.state = 'open' 
         AND LOWER(i.author_login) NOT LIKE '%bot%'
         AND (it_i.turn IS NULL OR it_i.turn != 'author')
         AND it_i.turn = 'maintainer'
         AND it_i.last_maintainer_action_at < NOW() - $2::interval
         THEN i.id 
       END)::int as stalled_issues_count
     FROM repos r
     LEFT JOIN pull_requests pr ON r.github_id = pr.repo_github_id
     LEFT JOIN issue_turns it_pr ON pr.github_id = it_pr.issue_github_id
     LEFT JOIN issues i ON r.github_id = i.repo_github_id
     LEFT JOIN issue_turns it_i ON i.github_id = it_i.issue_github_id`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $3`;
  }

  sql += ` GROUP BY r.github_id, r.full_name, r.name
     HAVING COUNT(DISTINCT CASE 
         WHEN pr.state = 'open' 
         AND LOWER(pr.author_login) NOT LIKE '%bot%'
         AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
         THEN pr.id 
       END) > 0
        OR COUNT(DISTINCT CASE 
         WHEN i.state = 'open' 
         AND LOWER(i.author_login) NOT LIKE '%bot%'
         AND (it_i.turn IS NULL OR it_i.turn != 'author')
         THEN i.id 
       END) > 0
     ORDER BY (
       COUNT(DISTINCT CASE 
         WHEN pr.state = 'open' 
         AND LOWER(pr.author_login) NOT LIKE '%bot%'
         AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
         THEN pr.id 
       END) +
       COUNT(DISTINCT CASE 
         WHEN i.state = 'open' 
         AND LOWER(i.author_login) NOT LIKE '%bot%'
         AND (it_i.turn IS NULL OR it_i.turn != 'author')
         THEN i.id 
       END)
     ) DESC
     LIMIT $1`;

  const params = userGithubId
    ? [limit, stallInterval, userGithubId]
    : [limit, stallInterval];

  return query<RepoWithPRCount>(sql, params);
}

/**
 * Gets total count of open PRs across all repositories (human authors only, excludes bots).
 * Excludes PRs where turn = 'author' (it's the author's turn to respond).
 * If userGithubId is provided, only counts PRs in repos the user has starred.
 *
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Total number of open PRs by human authors
 */
export async function getTotalOpenPRs(
  userGithubId?: number | null,
): Promise<number> {
  let sql = `SELECT COUNT(*)::int as count
     FROM pull_requests pr
     INNER JOIN repos r ON pr.repo_github_id = r.github_id
     LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $1`;
  } else {
    sql += ` WHERE 1=1`;
  }

  sql += ` AND pr.state = 'open'
       AND LOWER(pr.author_login) NOT LIKE '%bot%'
       AND (it.turn IS NULL OR it.turn != 'author')`;

  const result = await query<{ count: number }>(
    sql,
    userGithubId ? [userGithubId] : [],
  );
  return result[0]?.count ?? 0;
}

/**
 * Gets total count of open issues across all repositories (human authors only, excludes bots).
 * Excludes issues where turn = 'author' (it's the author's turn to respond).
 * If userGithubId is provided, only counts issues in repos the user has starred.
 *
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Total number of open issues by human authors
 */
export async function getTotalOpenIssues(
  userGithubId?: number | null,
): Promise<number> {
  let sql = `SELECT COUNT(*)::int as count
     FROM issues i
     INNER JOIN repos r ON i.repo_github_id = r.github_id
     LEFT JOIN issue_turns it ON i.github_id = it.issue_github_id`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $1`;
  } else {
    sql += ` WHERE 1=1`;
  }

  sql += ` AND i.state = 'open'
       AND LOWER(i.author_login) NOT LIKE '%bot%'
       AND (it.turn IS NULL OR it.turn != 'author')`;

  const result = await query<{ count: number }>(
    sql,
    userGithubId ? [userGithubId] : [],
  );
  return result[0]?.count ?? 0;
}

/**
 * Gets total count of repositories in the database.
 * If userGithubId is provided, only counts repos the user has starred.
 *
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Total number of repositories
 */
export async function getTotalRepoCount(
  userGithubId?: number | null,
): Promise<number> {
  let sql = `SELECT COUNT(*)::int as count
     FROM repos r`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $1`;
  }

  const result = await query<{ count: number }>(
    sql,
    userGithubId ? [userGithubId] : [],
  );
  return result[0]?.count ?? 0;
}

export interface IssueTurnRow {
  issue_github_id: number;
  repo_full_name: string;
  issue_number: number;
  title: string;
  turn: "maintainer" | "author";
  last_comment_at: string | null;
  last_comment_author: string | null;
  last_maintainer_action_at: string;
  stalled?: boolean;
}

export interface StalledWorkCounts {
  prs: {
    active: number;
    stalled: number;
  };
  issues: {
    active: number;
    stalled: number;
  };
}

/**
 * Gets all open issues with their "turn" status (whose turn is it to respond).
 * Uses the issue_turns view to compute turn logic based on comment history.
 * Includes stalled status based on stall_interval parameter.
 *
 * @param stallInterval - PostgreSQL interval string (e.g., '14 days') for determining if an issue is stalled
 * @returns Array of issue turn rows with stalled field
 */
export async function getIssueTurns(
  stallInterval: string = "14 days",
): Promise<IssueTurnRow[]> {
  return query<IssueTurnRow>(
    `SELECT 
      issue_github_id,
      repo_full_name,
      issue_number,
      title,
      turn,
      last_comment_at,
      last_comment_author,
      last_maintainer_action_at,
      -- stalled = true when turn is 'maintainer' AND last_maintainer_action_at is older than stall_interval
      (turn = 'maintainer' AND last_maintainer_action_at < NOW() - $1::interval) as stalled
    FROM issue_turns
    ORDER BY issue_github_id`,
    [stallInterval],
  );
}

/**
 * Gets issue turns for a specific repository.
 * Includes stalled status based on stall_interval parameter.
 *
 * @param repoGithubId - GitHub ID of the repository
 * @param stallInterval - PostgreSQL interval string (e.g., '14 days') for determining if an issue is stalled
 * @returns Array of issue turn rows for that repository with stalled field
 */
export async function getIssueTurnsByRepo(
  repoGithubId: number,
  stallInterval: string = "14 days",
): Promise<IssueTurnRow[]> {
  return query<IssueTurnRow>(
    `SELECT 
      it.issue_github_id,
      it.repo_full_name,
      it.issue_number,
      it.title,
      it.turn,
      it.last_comment_at,
      it.last_comment_author,
      it.last_maintainer_action_at,
      -- stalled = true when turn is 'maintainer' AND last_maintainer_action_at is older than stall_interval
      (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - $2::interval) as stalled
    FROM issue_turns it
    INNER JOIN issues i ON it.issue_github_id = i.github_id
    WHERE i.repo_github_id = $1
    ORDER BY it.issue_github_id`,
    [repoGithubId, stallInterval],
  );
}

/**
 * Gets counts of active and stalled PRs and Issues across all repositories.
 * Excludes bots and items where turn = 'author'.
 * If userGithubId is provided, only counts items in repos the user has starred.
 *
 * @param stallInterval - PostgreSQL interval string (e.g., '14 days') for determining if work is stalled
 * @param userGithubId - Optional GitHub user ID to filter by starred repos
 * @returns Counts of active and stalled PRs and Issues
 */
export async function getStalledWorkCounts(
  stallInterval: string = "14 days",
  userGithubId?: number | null,
): Promise<StalledWorkCounts> {
  const params = userGithubId ? [stallInterval, userGithubId] : [stallInterval];

  const result = await query<{
    type: "pr" | "issue";
    active: number;
    stalled: number;
  }>(
    userGithubId
      ? `WITH pr_turns AS (
          SELECT 
            pr.github_id,
            it.turn,
            it.last_maintainer_action_at,
            (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - $1::interval) as stalled
          FROM pull_requests pr
          INNER JOIN repos r ON pr.repo_github_id = r.github_id
          INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
          LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
          WHERE rs.user_github_id = $2
            AND pr.state = 'open'
            AND LOWER(pr.author_login) NOT LIKE '%bot%'
            AND (it.turn IS NULL OR it.turn != 'author')
        ),
        issue_turns AS (
          SELECT 
            i.github_id,
            it.turn,
            it.last_maintainer_action_at,
            (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - $1::interval) as stalled
          FROM issues i
          INNER JOIN repos r ON i.repo_github_id = r.github_id
          INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
          LEFT JOIN issue_turns it ON i.github_id = it.issue_github_id
          WHERE rs.user_github_id = $2
            AND i.state = 'open'
            AND LOWER(i.author_login) NOT LIKE '%bot%'
            AND (it.turn IS NULL OR it.turn != 'author')
        )
        SELECT 
          'pr' as type,
          COUNT(*) FILTER (WHERE NOT stalled OR stalled IS NULL)::int as active,
          COUNT(*) FILTER (WHERE stalled = true)::int as stalled
        FROM pr_turns
        UNION ALL
        SELECT 
          'issue' as type,
          COUNT(*) FILTER (WHERE NOT stalled OR stalled IS NULL)::int as active,
          COUNT(*) FILTER (WHERE stalled = true)::int as stalled
        FROM issue_turns`
      : `WITH pr_turns AS (
          SELECT 
            pr.github_id,
            it.turn,
            it.last_maintainer_action_at,
            (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - $1::interval) as stalled
          FROM pull_requests pr
          LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
          WHERE pr.state = 'open'
            AND LOWER(pr.author_login) NOT LIKE '%bot%'
            AND (it.turn IS NULL OR it.turn != 'author')
        ),
        issue_turns AS (
          SELECT 
            i.github_id,
            it.turn,
            it.last_maintainer_action_at,
            (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - $1::interval) as stalled
          FROM issues i
          LEFT JOIN issue_turns it ON i.github_id = it.issue_github_id
          WHERE i.state = 'open'
            AND LOWER(i.author_login) NOT LIKE '%bot%'
            AND (it.turn IS NULL OR it.turn != 'author')
        )
        SELECT 
          'pr' as type,
          COUNT(*) FILTER (WHERE NOT stalled OR stalled IS NULL)::int as active,
          COUNT(*) FILTER (WHERE stalled = true)::int as stalled
        FROM pr_turns
        UNION ALL
        SELECT 
          'issue' as type,
          COUNT(*) FILTER (WHERE NOT stalled OR stalled IS NULL)::int as active,
          COUNT(*) FILTER (WHERE stalled = true)::int as stalled
        FROM issue_turns`,
    params,
  );

  const prs = result.find((r) => r.type === "pr") || { active: 0, stalled: 0 };
  const issues = result.find((r) => r.type === "issue") || {
    active: 0,
    stalled: 0,
  };

  return {
    prs: {
      active: prs.active,
      stalled: prs.stalled,
    },
    issues: {
      active: issues.active,
      stalled: issues.stalled,
    },
  };
}

/**
 * Gets all pull requests where author_login does NOT contain "bot", ordered by updated_at descending.
 * Includes repository full name for display.
 *
 * @returns Array of pull request rows with repository full name
 */
export async function getNonBotPullRequests(
  userGithubId?: number | null,
): Promise<PullRequestRow[]> {
  let sql = `SELECT
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
      r.full_name as repo_full_name,
      it.turn,
      gu.avatar_url as author_avatar_url,
      gu.is_maintainer as author_is_maintainer,
      gu.bio as author_bio,
      gu.company as author_company
    FROM pull_requests pr
    INNER JOIN repos r ON pr.repo_github_id = r.github_id
    LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
    LEFT JOIN github_users gu ON pr.author_login = gu.login`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $1
               AND LOWER(pr.author_login) NOT LIKE '%bot%'`;
  } else {
    sql += ` WHERE LOWER(pr.author_login) NOT LIKE '%bot%'`;
  }

  sql += ` ORDER BY pr.updated_at DESC`;

  return query<PullRequestRow>(sql, userGithubId ? [userGithubId] : []);
}

export interface NextWorkItemRow {
  item_type: "issue" | "pr";
  repo_full_name: string;
  number: number;
  title: string;
  score: number;
  stalled: boolean;
  turn: "maintainer" | "author" | null;
  last_interaction_at: string | null;
  updated_at: string;
  github_id: number;
}

/**
 * Gets the single best "next thing to work on" for a logged-in user.
 * Combines issues and PRs, applies eligibility filters, scores items, and returns the top result.
 *
 * @param userGithubId - GitHub ID of the logged-in user
 * @param stallInterval - PostgreSQL interval string (default: '14 days')
 * @param snoozedItems - Array of snoozed items to exclude: [{ type: 'issue'|'pr', id: number }]
 * @returns The recommended work item, or null if nothing actionable exists
 */
export async function getNextWorkItem(
  userGithubId: number,
  stallInterval: string = "14 days",
  snoozedItems: Array<{ type: "issue" | "pr"; id: number }> = [],
): Promise<NextWorkItemRow | null> {
  const sql = `
WITH user_info AS (
  -- Get user's login from github_id
  -- If user doesn't exist, this returns no rows and the query will return no results
  SELECT login
  FROM github_users
  WHERE github_id = $1
),
eligible_issues AS (
  SELECT
    i.github_id,
    'issue' AS item_type,
    r.full_name AS repo_full_name,
    i.number,
    i.title,
    i.updated_at,
    it.turn,
    -- stalled = true when turn is 'maintainer' AND last_maintainer_action_at is older than stall_interval
    (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - $2::interval) AS stalled,
    -- Check if user is assigned (assignees is JSONB array of objects with 'login' field)
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(i.assignees) AS a
      WHERE a->>'login' = (SELECT login FROM user_info)
    ) AS is_assigned,
    -- Check if user has interacted before
    uii.last_interaction_at
  FROM issues i
  INNER JOIN repos r ON i.repo_github_id = r.github_id
  LEFT JOIN issue_turns it ON i.github_id = it.issue_github_id
  LEFT JOIN user_item_interactions_mv uii 
    ON uii.user_github_id = $1
    AND uii.item_type = 'issue'
    AND uii.item_github_id = i.github_id
  WHERE i.state = 'open'
    -- Repo is either starred by user OR maintained by user
    AND (
      EXISTS (
        SELECT 1 FROM repo_stars rs
        WHERE rs.repo_github_id = r.github_id
        AND rs.user_github_id = $1
      )
      OR EXISTS (
        SELECT 1 FROM repo_maintainers rm
        WHERE rm.repo_github_id = r.github_id
        AND rm.github_user_id = $1
      )
    )
    -- Item is actionable: turn = 'maintainer' OR assigned to user
    AND (
      it.turn = 'maintainer'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(i.assignees) AS a
        WHERE a->>'login' = (SELECT login FROM user_info)
      )
    )
    -- Exclude items waiting on author
    AND (it.turn IS NULL OR it.turn != 'author')
),
eligible_prs AS (
  SELECT
    pr.github_id,
    'pr' AS item_type,
    r.full_name AS repo_full_name,
    pr.number,
    pr.title,
    pr.updated_at,
    it.turn,
    -- stalled = true when turn is 'maintainer' AND last_maintainer_action_at is older than stall_interval
    (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - $2::interval) AS stalled,
    -- Check if user is assigned
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(pr.assignees) AS a
      WHERE a->>'login' = (SELECT login FROM user_info)
    ) AS is_assigned,
    -- Check if user has interacted before
    uii.last_interaction_at
  FROM pull_requests pr
  INNER JOIN repos r ON pr.repo_github_id = r.github_id
  LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
  LEFT JOIN user_item_interactions_mv uii 
    ON uii.user_github_id = $1
    AND uii.item_type = 'pr'
    AND uii.item_github_id = pr.github_id
  WHERE pr.state = 'open'
    -- Exclude draft PRs
    AND pr.draft = false
    -- Repo is either starred by user OR maintained by user
    AND (
      EXISTS (
        SELECT 1 FROM repo_stars rs
        WHERE rs.repo_github_id = r.github_id
        AND rs.user_github_id = $1
      )
      OR EXISTS (
        SELECT 1 FROM repo_maintainers rm
        WHERE rm.repo_github_id = r.github_id
        AND rm.github_user_id = $1
      )
    )
    -- Item is actionable: turn = 'maintainer' OR assigned to user
    AND (
      it.turn = 'maintainer'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(pr.assignees) AS a
        WHERE a->>'login' = (SELECT login FROM user_info)
      )
    )
    -- Exclude items waiting on author
    AND (it.turn IS NULL OR it.turn != 'author')
),
scored_items AS (
  SELECT
    item_type,
    repo_full_name,
    number,
    title,
    updated_at,
    turn,
    stalled,
    last_interaction_at,
    github_id,
    -- Calculate score (additive)
    (
      CASE WHEN stalled THEN 50 ELSE 0 END +
      CASE WHEN turn = 'maintainer' THEN 30 ELSE 0 END +
      CASE WHEN is_assigned THEN 20 ELSE 0 END +
      CASE WHEN last_interaction_at IS NOT NULL THEN 15 ELSE 0 END +
      CASE WHEN updated_at > NOW() - '48 hours'::interval THEN 10 ELSE 0 END +
      CASE WHEN updated_at < NOW() - '30 days'::interval THEN -10 ELSE 0 END
    ) AS score
  FROM (
    SELECT 
      github_id,
      item_type,
      repo_full_name,
      number,
      title,
      updated_at,
      turn,
      stalled,
      last_interaction_at,
      is_assigned
    FROM eligible_issues
    UNION ALL
    SELECT 
      github_id,
      item_type,
      repo_full_name,
      number,
      title,
      updated_at,
      turn,
      stalled,
      last_interaction_at,
      is_assigned
    FROM eligible_prs
  ) combined
)
SELECT
  item_type,
  repo_full_name,
  number,
  title,
  score,
  stalled,
  turn,
  last_interaction_at,
  updated_at,
  github_id
FROM scored_items
${
  snoozedItems.length > 0
    ? `WHERE NOT EXISTS (
  SELECT 1
  FROM (VALUES ${snoozedItems
    .map((_, i) => {
      const typeParam = 3 + i * 2;
      const idParam = 4 + i * 2;
      return `($${typeParam}::text, $${idParam}::bigint)`;
    })
    .join(", ")} ) AS snoozed(type, id)
  WHERE snoozed.type = scored_items.item_type
    AND snoozed.id = scored_items.github_id
)`
    : ""
}
ORDER BY score DESC, updated_at DESC
LIMIT 1;
`;

  // Build parameters array
  const params: unknown[] = [userGithubId, stallInterval];
  snoozedItems.forEach((item) => {
    params.push(item.type, item.id);
  });

  const results = await query<NextWorkItemRow>(sql, params);
  return results.length > 0 ? results[0] : null;
}
