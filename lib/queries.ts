/**
 * Read-only Database Queries
 *
 * Provides read-only query functions for the Next.js app.
 * No business logic, just SQL queries.
 */

import { query } from "./db";
import { getCompanyClassifications } from "./companyClassification";
import { CompanyClassification } from "./companyClassificationTypes";

/**
 * Helper function to add company classification to an array of items.
 *
 * @param items - Array of items to enrich
 * @param getCompanyName - Function to extract company name from an item
 * @param setClassification - Function to set classification on an item
 * @returns Array of items with classification added
 */
async function addCompanyClassification<T>(
  items: T[],
  getCompanyName: (item: T) => string | null | undefined,
  setClassification: (item: T, classification: string | null) => T,
): Promise<T[]> {
  const companyNames = items
    .map(getCompanyName)
    .filter((c): c is string => c != null);
  const classifications = await getCompanyClassifications(companyNames);

  return items.map((item) => {
    const companyName = getCompanyName(item);
    const classification = companyName
      ? (classifications.get(companyName)?.toString() ?? null)
      : null;
    return setClassification(item, classification);
  });
}

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
  author_github_id?: number | null; // Optional, populated when joined with github_users table
  author_avatar_url?: string | null; // Optional, populated when joined with github_users table
  author_is_maintainer?: boolean | null; // Optional, populated when joined with github_users table
  author_bio?: string | null; // Optional, populated when joined with github_users table
  author_company?: string | null; // Optional, populated when joined with github_users table
  author_company_classification?: string | null; // Optional, computed classification
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
  author_github_id?: number | null; // Optional, populated when joined with github_users table
  author_avatar_url?: string | null; // Optional, populated when joined with github_users table
  author_is_maintainer?: boolean | null; // Optional, populated when joined with github_users table
  author_bio?: string | null; // Optional, populated when joined with github_users table
  author_company?: string | null; // Optional, populated when joined with github_users table
  author_company_classification?: string | null; // Optional, computed classification
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
  company_classification?: string | null; // Optional, computed classification
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
  const issues = await query<IssueRow>(
    `SELECT i.id, i.github_id, i.repo_github_id, i.number, i.title, i.body, i.state,
            i.created_at, i.updated_at, i.closed_at, i.labels, i.assignees, i.author_login, i.synced_at,
            gu.github_id as author_github_id,
            gu.avatar_url as author_avatar_url,
            gu.is_maintainer as author_is_maintainer,
            ghm.bio as author_bio,
            -- Effective company name with override support
            CASE
              WHEN co.override_company_name IS NOT NULL THEN co.override_company_name
              WHEN co.override_source = 'github' THEN ghm.company
              WHEN co.override_source = 'commonroom' THEN crmm.company_name
              ELSE COALESCE(
                NULLIF(LOWER(TRIM(crmm.company_name)), ''),
                NULLIF(LOWER(TRIM(ghm.company)), '')
              )
            END as author_company
     FROM issues i
     LEFT JOIN github_users gu ON i.author_login = gu.login
     LEFT JOIN github_profiles ghm ON gu.github_id = ghm.github_id
     LEFT JOIN commonroom_member_metadata crmm ON gu.login = crmm.github_login
     LEFT JOIN company_overrides co ON gu.github_id = co.github_user_id
     WHERE i.repo_github_id = $1 AND i.state = 'open'
     ORDER BY i.updated_at DESC`,
    [repoGithubId],
  );

  // Add company classification
  return addCompanyClassification(
    issues,
    (issue) => issue.author_company,
    (issue, classification) => ({
      ...issue,
      author_company_classification: classification,
    }),
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
  const prs = await query<PullRequestRow>(
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
      gu.github_id as author_github_id,
      gu.avatar_url as author_avatar_url,
      gu.is_maintainer as author_is_maintainer,
      ghm.bio as author_bio,
      -- Effective company name with override support
      CASE
        WHEN co.override_company_name IS NOT NULL THEN co.override_company_name
        WHEN co.override_source = 'github' THEN ghm.company
        WHEN co.override_source = 'commonroom' THEN crmm.company_name
        ELSE COALESCE(crmm.company_name, ghm.company)
      END as author_company
     FROM pull_requests pr
     LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
     LEFT JOIN github_users gu ON pr.author_login = gu.login
     LEFT JOIN github_profiles ghm ON gu.github_id = ghm.github_id
     LEFT JOIN commonroom_member_metadata crmm ON gu.login = crmm.github_login
     LEFT JOIN company_overrides co ON gu.github_id = co.github_user_id
     WHERE pr.repo_github_id = $1
     ORDER BY pr.updated_at DESC`,
    [repoGithubId],
  );

  // Add company classification
  return addCompanyClassification(
    prs,
    (pr) => pr.author_company,
    (pr, classification) => ({
      ...pr,
      author_company_classification: classification,
    }),
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

  // Debug logging (can be removed later)
  if (userGithubId && result.length === 0) {
    console.log(
      `[getOrgs] No orgs found for user ${userGithubId} with starred filter. Checking if stars exist...`,
    );
    const starCheck = await query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM repo_stars WHERE user_github_id = $1`,
      [userGithubId],
    );
    console.log(
      `[getOrgs] User ${userGithubId} has ${starCheck[0]?.count || 0} stars in repo_stars table`,
    );
  }

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
  const maintainers = await query<MaintainerRow>(
    `SELECT 
      rm.github_user_id,
      gu.login,
      gu.avatar_url,
      rm.source,
      rm.confidence,
      rm.last_confirmed_at,
      ghm.bio as bio,
      -- Effective company name with override support
      CASE
        WHEN co.override_company_name IS NOT NULL THEN co.override_company_name
        WHEN co.override_source = 'github' THEN ghm.company
        WHEN co.override_source = 'commonroom' THEN crmm.company_name
        ELSE COALESCE(
          NULLIF(LOWER(TRIM(crmm.company_name)), ''),
          NULLIF(LOWER(TRIM(ghm.company)), '')
        )
      END as company
     FROM repo_maintainers rm
     INNER JOIN github_users gu ON rm.github_user_id = gu.github_id
     LEFT JOIN github_profiles ghm ON gu.github_id = ghm.github_id
     LEFT JOIN commonroom_member_metadata crmm ON gu.login = crmm.github_login
     LEFT JOIN company_overrides co ON gu.github_id = co.github_user_id
     WHERE rm.repo_github_id = $1
     ORDER BY rm.confidence DESC, rm.source ASC, gu.login ASC`,
    [repoGithubId],
  );

  // Add company classification
  return addCompanyClassification(
    maintainers,
    (m) => m.company,
    (maintainer, classification) => ({
      ...maintainer,
      company_classification: classification,
    }),
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
      gu.github_id as author_github_id,
      gu.avatar_url as author_avatar_url,
      gu.is_maintainer as author_is_maintainer,
      ghm.bio as author_bio,
      -- Effective company name with override support
      CASE
        WHEN co.override_company_name IS NOT NULL THEN co.override_company_name
        WHEN co.override_source = 'github' THEN ghm.company
        WHEN co.override_source = 'commonroom' THEN crmm.company_name
        ELSE COALESCE(crmm.company_name, ghm.company)
      END as author_company
    FROM pull_requests pr
    INNER JOIN repos r ON pr.repo_github_id = r.github_id
    LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
    LEFT JOIN github_users gu ON pr.author_login = gu.login
    LEFT JOIN github_profiles ghm ON gu.github_id = ghm.github_id
    LEFT JOIN commonroom_member_metadata crmm ON gu.login = crmm.github_login
    LEFT JOIN company_overrides co ON gu.github_id = co.github_user_id`;

  if (userGithubId) {
    sql += ` INNER JOIN repo_stars rs ON r.github_id = rs.repo_github_id
             WHERE rs.user_github_id = $1
               AND LOWER(pr.author_login) NOT LIKE '%bot%'`;
  } else {
    sql += ` WHERE LOWER(pr.author_login) NOT LIKE '%bot%'`;
  }

  sql += ` ORDER BY pr.updated_at DESC`;

  const prs = await query<PullRequestRow>(
    sql,
    userGithubId ? [userGithubId] : [],
  );

  // Add company classification
  return addCompanyClassification(
    prs,
    (pr) => pr.author_company,
    (pr, classification) => ({
      ...pr,
      author_company_classification: classification,
    }),
  );
}

export interface NextWorkItemRow {
  item_type: "issue" | "pr";
  repo_full_name: string;
  number: number;
  title: string;
  stalled: boolean;
  turn: "maintainer" | "author" | null;
  last_interaction_at: string | null;
  updated_at: string;
  github_id: number;
  explanation?: {
    primary: string;
    secondary: string[];
  };
  scoring?: {
    base_score: number;
    preference_boost: number;
    total_score: number;
    waiting_on_me_contribution: number;
    known_customer_contribution: number;
    recent_activity_contribution: number;
    quick_win_contribution: number;
    community_interest_contribution: number;
    signals: {
      is_known_customer_author: boolean;
      is_repo_maintained_or_starred: boolean;
      waiting_on_me: boolean;
      quick_win: boolean;
      reaction_score: number;
      unique_commenter_count: number;
      last_activity_at: string;
    };
  };
}

