/**
 * Company Activity Queries
 *
 * Generic queries for company activity views.
 * Can be used with any view that follows the company_activity schema.
 */

import { query } from "../data/db/index";

export interface CompanyActivityRow {
  hubspot_company_id: number;
  company_name: string;
  user_github_id: number;
  user_login: string;
  is_maintainer: boolean | null;
  item_github_id: number;
  repo_github_id: number;
  item_number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  item_type: "issue" | "pr";
  interaction_type: "author" | "comment" | "reaction" | "review";
  interaction_date: string;
}

export interface CompanyActivitySummary {
  company_name: string;
  hubspot_company_id: number;
  users: Array<{
    user_login: string;
    user_github_id: number;
    is_maintainer: boolean | null;
    interaction_count: number;
  }>;
  repositories: Array<{
    repo_github_id: number;
    repo_full_name: string | null;
    interaction_count: number;
  }>;
}

/**
 * Gets company activity data grouped by company from a specified view.
 *
 * @param viewName - Name of the database view to query (e.g., 'prospect_activity', 'customer_activity')
 * @returns Array of company activity summaries
 */
export async function getCompanyActivity(
  viewName: string = "prospect_activity",
): Promise<CompanyActivitySummary[]> {
  // Get all activity data
  const activity = await query<CompanyActivityRow>(
    `SELECT 
      hubspot_company_id,
      company_name,
      user_github_id,
      user_login,
      is_maintainer,
      item_github_id,
      repo_github_id,
      item_number,
      title,
      state,
      created_at,
      updated_at,
      item_type,
      interaction_type,
      interaction_date
     FROM ${viewName}
     ORDER BY company_name, user_login, interaction_date DESC`,
  );

  // Group by company
  const companyMap = new Map<
    string,
    {
      hubspot_company_id: number;
      company_name: string;
      users: Map<
        string,
        {
          user_login: string;
          user_github_id: number;
          is_maintainer: boolean | null;
          interactions: number;
        }
      >;
      repos: Map<
        number,
        {
          repo_github_id: number;
          repo_full_name: string | null;
          interactions: number;
        }
      >;
    }
  >();

  // Get repository full names
  const repoIds = new Set(activity.rows.map((row) => row.repo_github_id));
  const repoMap = new Map<number, string | null>();

  if (repoIds.size > 0) {
    const repos = await query<{ github_id: number; full_name: string }>(
      `SELECT github_id, full_name
       FROM repos
       WHERE github_id = ANY($1)`,
      [Array.from(repoIds)],
    );

    for (const repo of repos.rows) {
      repoMap.set(repo.github_id, repo.full_name);
    }
  }

  // Process activity rows
  for (const row of activity.rows) {
    const companyKey = `${row.hubspot_company_id}-${row.company_name}`;

    if (!companyMap.has(companyKey)) {
      companyMap.set(companyKey, {
        hubspot_company_id: row.hubspot_company_id,
        company_name: row.company_name,
        users: new Map(),
        repos: new Map(),
      });
    }

    const company = companyMap.get(companyKey)!;

    // Count user interactions
    const userKey = row.user_login;
    if (!company.users.has(userKey)) {
      company.users.set(userKey, {
        user_login: row.user_login,
        user_github_id: row.user_github_id,
        is_maintainer: row.is_maintainer,
        interactions: 0,
      });
    }
    company.users.get(userKey)!.interactions++;

    // Count repo interactions
    const repoKey = row.repo_github_id;
    if (!company.repos.has(repoKey)) {
      company.repos.set(repoKey, {
        repo_github_id: row.repo_github_id,
        repo_full_name: repoMap.get(row.repo_github_id) || null,
        interactions: 0,
      });
    }
    company.repos.get(repoKey)!.interactions++;
  }

  // Convert to final format and sort
  const result: CompanyActivitySummary[] = Array.from(companyMap.values()).map(
    (company) => ({
      company_name: company.company_name,
      hubspot_company_id: company.hubspot_company_id,
      users: Array.from(company.users.values())
        .sort((a, b) => b.interactions - a.interactions)
        .map((u) => ({
          user_login: u.user_login,
          user_github_id: u.user_github_id,
          is_maintainer: u.is_maintainer,
          interaction_count: u.interactions,
        })),
      repositories: Array.from(company.repos.values())
        .sort((a, b) => b.interactions - a.interactions)
        .map((r) => ({
          repo_github_id: r.repo_github_id,
          repo_full_name: r.repo_full_name,
          interaction_count: r.interactions,
        })),
    }),
  );

  // Sort companies by name
  result.sort((a, b) => a.company_name.localeCompare(b.company_name));

  return result;
}

/**
 * Convenience function to get prospect activity.
 * Equivalent to getCompanyActivity('prospect_activity').
 *
 * @returns Array of prospect company activity summaries
 */
export async function getProspectActivity(): Promise<CompanyActivitySummary[]> {
  return getCompanyActivity("prospect_activity");
}
