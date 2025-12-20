/**
 * User Interaction Details Queries
 *
 * Gets detailed information about a user's interactions with issues/PRs.
 */

import { query } from "../data/db/index";

export interface UserInteractionDetail {
  item_github_id: number;
  item_type: "issue" | "pr";
  item_number: number;
  title: string;
  repo_full_name: string;
  repo_github_id: number;
  interaction_types: Array<"author" | "comment" | "reaction" | "review">;
  interaction_date: string;
  is_author: boolean;
  github_url: string;
}

/**
 * Gets detailed interaction information for a user from a specific company.
 *
 * @param userGithubId - GitHub user ID
 * @param companyName - Company name (for filtering)
 * @returns Array of interaction details
 */
export async function getUserInteractionDetails(
  userGithubId: number,
  companyName: string,
): Promise<UserInteractionDetail[]> {
  // Get interactions from company_activity_base view, deduplicated by item_github_id.
  // For each item, show the most recent interaction and combine interaction types.
  // We filter by company name to get interactions for that specific company.
  const activity = await query<{
    item_github_id: number;
    item_type: string;
    item_number: number;
    title: string;
    repo_github_id: number;
    interaction_types: string[];
    interaction_date: string;
    is_author: boolean;
  }>(
    `SELECT 
      item_github_id,
      item_type,
      item_number,
      title,
      repo_github_id,
      ARRAY_AGG(DISTINCT interaction_type ORDER BY interaction_type) as interaction_types,
      MAX(interaction_date) as interaction_date,
      BOOL_OR(interaction_type = 'author') as is_author
     FROM company_activity_base
     WHERE user_github_id = $1
       AND company_name = $2
     GROUP BY item_github_id, item_type, item_number, title, repo_github_id
     ORDER BY interaction_date DESC`,
    [userGithubId, companyName],
  );

  // Get repository full names
  const repoIds = new Set(activity.rows.map((row) => row.repo_github_id));
  const repoMap = new Map<number, string>();

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

  // Build results with GitHub URLs
  return activity.rows.map((row) => {
    const repoFullName =
      repoMap.get(row.repo_github_id) || `repo-${row.repo_github_id}`;
    const itemType = row.item_type === "issue" ? "issues" : "pull";
    const githubUrl = `https://github.com/${repoFullName}/${itemType}/${row.item_number}`;

    return {
      item_github_id: row.item_github_id,
      item_type: row.item_type as "issue" | "pr",
      item_number: row.item_number,
      title: row.title,
      repo_full_name: repoFullName,
      repo_github_id: row.repo_github_id,
      interaction_types: (row.interaction_types || []) as Array<
        "author" | "comment" | "reaction" | "review"
      >,
      interaction_date: row.interaction_date,
      is_author: row.is_author || false,
      github_url: githubUrl,
    };
  });
}
