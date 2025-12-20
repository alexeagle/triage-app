/**
 * Next Work Item Scoring and Ranking
 *
 * Implements preference-based scoring algorithm for selecting the best
 * "next thing to work on" for a logged-in user.
 */

import { query } from "./db";
import type { NextWorkItemRow } from "./queries";

export interface WorkItemPreferences {
  prefer_known_customers: boolean;
  prefer_recent_activity: boolean;
  prefer_waiting_on_me: boolean;
  prefer_quick_wins: boolean;
}

/**
 * Generates explanation for why an item was selected.
 */
function generateExplanation(scoreContributions: {
  waiting_on_me: number;
  known_customer: number;
  recent_activity: number;
  quick_win: number;
  community_interest: number;
}): { primary: string; secondary: string[] } {
  const reasons: Array<{ name: string; score: number }> = [
    { name: "Waiting on you", score: scoreContributions.waiting_on_me },
    { name: "Known customer", score: scoreContributions.known_customer },
    { name: "Recently active", score: scoreContributions.recent_activity },
    { name: "Quick win", score: scoreContributions.quick_win },
    {
      name: "Strong community interest",
      score: scoreContributions.community_interest,
    },
  ];

  // Sort by score descending
  reasons.sort((a, b) => b.score - a.score);

  // Primary is the highest scoring reason
  const primary = reasons[0]?.score > 0 ? reasons[0].name : "Available";

  // Secondary are reasons with score >= 5, excluding primary
  const secondary = reasons
    .slice(1)
    .filter((r) => r.score >= 5)
    .slice(0, 2)
    .map((r) => r.name);

  return { primary, secondary };
}

/**
 * Gets the best "next thing to work on" for a logged-in user using preference-based scoring.
 * Combines issues and PRs, applies eligibility filters, scores items, and returns the top result.
 *
 * @param userGithubId - GitHub ID of the logged-in user
 * @param preferences - User preferences for ranking
 * @param snoozedItems - Array of snoozed items to exclude: [{ type: 'issue'|'pr', id: number }]
 * @param includeScoring - If true, includes detailed scoring information in the response
 * @returns The recommended work item with explanation, or null if nothing actionable exists
 */
export async function getNextWorkItem(
  userGithubId: number,
  preferences: WorkItemPreferences,
  snoozedItems: Array<{ type: "issue" | "pr"; id: number }> = [],
  includeScoring: boolean = false,
): Promise<NextWorkItemRow | null> {
  const sql = `
WITH user_info AS (
  SELECT login FROM github_users WHERE github_id = $1
),
eligible_issues AS (
  SELECT
    i.github_id,
    'issue' AS item_type,
    r.full_name AS repo_full_name,
    r.github_id AS repo_github_id,
    i.number,
    i.title,
    i.updated_at,
    i.author_login,
    it.turn,
    (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - '14 days'::interval) AS stalled,
    uii.last_interaction_at,
    COALESCE(gu.is_maintainer, false) AS author_is_maintainer,
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(i.assignees) AS a
      WHERE a->>'login' = (SELECT login FROM user_info)
    ) AS is_assigned,
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
  INNER JOIN repos r ON i.repo_github_id = r.github_id
  LEFT JOIN issue_turns it ON i.github_id = it.issue_github_id
  LEFT JOIN user_item_interactions_mv uii 
    ON uii.user_github_id = $1 AND uii.item_type = 'issue' AND uii.item_github_id = i.github_id
  LEFT JOIN github_users gu ON i.author_login = gu.login
  LEFT JOIN github_profiles ghm ON gu.github_id = ghm.github_id
  LEFT JOIN commonroom_member_metadata crmm ON gu.login = crmm.github_login
  LEFT JOIN company_overrides co ON gu.github_id = co.github_user_id
  WHERE i.state = 'open'
    AND (
      it.turn = 'maintainer'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(i.assignees) AS a
        WHERE a->>'login' = (SELECT login FROM user_info)
      )
    )
    AND (it.turn IS NULL OR it.turn != 'author')
),
eligible_prs AS (
  SELECT
    pr.github_id,
    'pr' AS item_type,
    r.full_name AS repo_full_name,
    r.github_id AS repo_github_id,
    pr.number,
    pr.title,
    pr.updated_at,
    pr.author_login,
    it.turn,
    (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - '14 days'::interval) AS stalled,
    uii.last_interaction_at,
    COALESCE(gu.is_maintainer, false) AS author_is_maintainer,
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(pr.assignees) AS a
      WHERE a->>'login' = (SELECT login FROM user_info)
    ) AS is_assigned,
    CASE
      WHEN co.override_company_name IS NOT NULL THEN co.override_company_name
      WHEN co.override_source = 'github' THEN ghm.company
      WHEN co.override_source = 'commonroom' THEN crmm.company_name
      ELSE COALESCE(
        NULLIF(LOWER(TRIM(crmm.company_name)), ''),
        NULLIF(LOWER(TRIM(ghm.company)), '')
      )
    END as author_company
  FROM pull_requests pr
  INNER JOIN repos r ON pr.repo_github_id = r.github_id
  LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
  LEFT JOIN user_item_interactions_mv uii 
    ON uii.user_github_id = $1 AND uii.item_type = 'pr' AND uii.item_github_id = pr.github_id
  LEFT JOIN github_users gu ON pr.author_login = gu.login
  LEFT JOIN github_profiles ghm ON gu.github_id = ghm.github_id
  LEFT JOIN commonroom_member_metadata crmm ON gu.login = crmm.github_login
  LEFT JOIN company_overrides co ON gu.github_id = co.github_user_id
  WHERE pr.state = 'open' AND pr.draft = false
    AND (
      it.turn = 'maintainer'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(pr.assignees) AS a
        WHERE a->>'login' = (SELECT login FROM user_info)
      )
    )
    AND (it.turn IS NULL OR it.turn != 'author')
),
item_signals AS (
  SELECT 
    ei.github_id,
    ei.item_type,
    ei.repo_full_name,
    ei.repo_github_id,
    ei.number,
    ei.title,
    ei.updated_at,
    ei.turn,
    ei.stalled,
    ei.last_interaction_at,
    ei.author_login,
    ei.author_company,
    ei.author_is_maintainer,
    ei.is_assigned,
    EXISTS (
      SELECT 1 FROM hubspot_companies hc
      WHERE LOWER(TRIM(hc.name)) = LOWER(TRIM(ei.author_company))
        AND LOWER(hc.lifecyclestage) = 'customer'
    ) AS is_known_customer_author,
    (
      EXISTS (SELECT 1 FROM repo_maintainers rm WHERE rm.repo_github_id = ei.repo_github_id AND rm.github_user_id = $1)
      OR EXISTS (SELECT 1 FROM repo_stars rs WHERE rs.repo_github_id = ei.repo_github_id AND rs.user_github_id = $1)
    ) AS is_repo_maintained_or_starred,
    COALESCE(
      (SELECT MAX(ic.created_at) FROM issue_comments ic WHERE ic.issue_github_id = ei.github_id),
      ei.updated_at
    ) AS last_activity_at,
    (
      (ei.turn = 'maintainer' AND EXISTS (SELECT 1 FROM repo_maintainers rm WHERE rm.repo_github_id = ei.repo_github_id AND rm.github_user_id = $1))
      OR ei.is_assigned
    ) AS waiting_on_me,
    (SELECT COUNT(*) FROM issue_comments ic WHERE ic.issue_github_id = ei.github_id) <= 2 AS quick_win,
    LEAST(
      (SELECT COUNT(*) FROM issue_reactions ir WHERE ir.issue_github_id = ei.github_id),
      10
    ) AS reaction_score,
    LEAST(
      (SELECT COUNT(DISTINCT ic.author_login) FROM issue_comments ic WHERE ic.issue_github_id = ei.github_id),
      5
    ) AS unique_commenter_count
  FROM eligible_issues ei
  UNION ALL
  SELECT 
    ep.github_id,
    ep.item_type,
    ep.repo_full_name,
    ep.repo_github_id,
    ep.number,
    ep.title,
    ep.updated_at,
    ep.turn,
    ep.stalled,
    ep.last_interaction_at,
    ep.author_login,
    ep.author_company,
    ep.author_is_maintainer,
    ep.is_assigned,
    EXISTS (
      SELECT 1 FROM hubspot_companies hc
      WHERE LOWER(TRIM(hc.name)) = LOWER(TRIM(ep.author_company))
        AND LOWER(hc.lifecyclestage) = 'customer'
    ) AS is_known_customer_author,
    (
      EXISTS (SELECT 1 FROM repo_maintainers rm WHERE rm.repo_github_id = ep.repo_github_id AND rm.github_user_id = $1)
      OR EXISTS (SELECT 1 FROM repo_stars rs WHERE rs.repo_github_id = ep.repo_github_id AND rs.user_github_id = $1)
    ) AS is_repo_maintained_or_starred,
    COALESCE(
      (SELECT MAX(ic.created_at) FROM issue_comments ic WHERE ic.issue_github_id = ep.github_id),
      ep.updated_at
    ) AS last_activity_at,
    (
      (ep.turn = 'maintainer' AND EXISTS (SELECT 1 FROM repo_maintainers rm WHERE rm.repo_github_id = ep.repo_github_id AND rm.github_user_id = $1))
      OR ep.is_assigned
    ) AS waiting_on_me,
    (SELECT COUNT(*) FROM issue_comments ic WHERE ic.issue_github_id = ep.github_id) <= 2 AS quick_win,
    LEAST(
      (SELECT COUNT(*) FROM issue_reactions ir WHERE ir.issue_github_id = ep.github_id),
      10
    ) AS reaction_score,
    LEAST(
      (SELECT COUNT(DISTINCT ic.author_login) FROM issue_comments ic WHERE ic.issue_github_id = ep.github_id),
      5
    ) AS unique_commenter_count
  FROM eligible_prs ep
),
scored_items AS (
  SELECT
    *,
    (
      CASE WHEN waiting_on_me THEN 15 ELSE 0 END +
      CASE 
        WHEN last_activity_at > NOW() - '24 hours'::interval THEN 15
        WHEN last_activity_at > NOW() - '3 days'::interval THEN 10
        WHEN last_activity_at > NOW() - '7 days'::interval THEN 5
        ELSE 0
      END +
      (unique_commenter_count * 3) +
      (reaction_score * 1) +
      CASE WHEN NOT is_repo_maintained_or_starred THEN -20 ELSE 0 END
    ) AS base_score,
    (
      CASE WHEN $2::boolean AND waiting_on_me THEN 25 ELSE 0 END +
      CASE 
        WHEN $3::boolean AND is_known_customer_author AND NOT author_is_maintainer THEN 30
        WHEN $3::boolean AND is_known_customer_author AND author_is_maintainer THEN 0
        ELSE 0
      END +
      CASE 
        WHEN $4::boolean AND last_activity_at > NOW() - '24 hours'::interval THEN 10
        WHEN $4::boolean AND last_activity_at > NOW() - '3 days'::interval THEN 5
        ELSE 0
      END +
      CASE WHEN $5::boolean AND quick_win THEN 15 ELSE 0 END
    ) AS preference_boost,
    (
      CASE WHEN waiting_on_me THEN 15 ELSE 0 END +
      CASE WHEN $2::boolean AND waiting_on_me THEN 25 ELSE 0 END
    ) AS waiting_on_me_contribution,
    (
      CASE 
        WHEN $3::boolean AND is_known_customer_author AND NOT author_is_maintainer THEN 30
        WHEN $3::boolean AND is_known_customer_author AND author_is_maintainer THEN 0
        ELSE 0
      END
    ) AS known_customer_contribution,
    (
      CASE 
        WHEN last_activity_at > NOW() - '24 hours'::interval THEN 15
        WHEN last_activity_at > NOW() - '3 days'::interval THEN 10
        WHEN last_activity_at > NOW() - '7 days'::interval THEN 5
        ELSE 0
      END +
      CASE 
        WHEN $4::boolean AND last_activity_at > NOW() - '24 hours'::interval THEN 10
        WHEN $4::boolean AND last_activity_at > NOW() - '3 days'::interval THEN 5
        ELSE 0
      END
    ) AS recent_activity_contribution,
    (
      CASE WHEN $5::boolean AND quick_win THEN 15 ELSE 0 END
    ) AS quick_win_contribution,
    (
      (unique_commenter_count * 3) + (reaction_score * 1)
    ) AS community_interest_contribution
  FROM item_signals
)
SELECT
  item_type,
  repo_full_name,
  number,
  title,
  stalled,
  turn,
  last_interaction_at,
  updated_at,
  github_id,
  base_score + preference_boost AS total_score,
  base_score,
  preference_boost,
  waiting_on_me_contribution,
  known_customer_contribution,
  recent_activity_contribution,
  quick_win_contribution,
  community_interest_contribution,
  last_activity_at,
  is_known_customer_author,
  is_repo_maintained_or_starred,
  waiting_on_me,
  quick_win,
  reaction_score,
  unique_commenter_count
FROM scored_items
${
  snoozedItems.length > 0
    ? `WHERE NOT EXISTS (
  SELECT 1
  FROM (VALUES ${snoozedItems
    .map((_, i) => {
      const typeParam = 6 + i * 2;
      const idParam = 7 + i * 2;
      return `($${typeParam}::text, $${idParam}::bigint)`;
    })
    .join(", ")} ) AS snoozed(type, id)
  WHERE snoozed.type = scored_items.item_type
    AND snoozed.id = scored_items.github_id
)`
    : ""
}
ORDER BY total_score DESC, last_activity_at DESC
LIMIT 1;
`;

  const params: unknown[] = [
    userGithubId,
    preferences.prefer_waiting_on_me,
    preferences.prefer_known_customers,
    preferences.prefer_recent_activity,
    preferences.prefer_quick_wins,
  ];
  snoozedItems.forEach((item) => {
    params.push(item.type, item.id);
  });

  const results = await query<
    NextWorkItemRow & {
      total_score: number;
      base_score: number;
      preference_boost: number;
      waiting_on_me_contribution: number;
      known_customer_contribution: number;
      recent_activity_contribution: number;
      quick_win_contribution: number;
      community_interest_contribution: number;
      last_activity_at: string;
      is_known_customer_author: boolean;
      is_repo_maintained_or_starred: boolean;
      waiting_on_me: boolean;
      quick_win: boolean;
      reaction_score: number;
      unique_commenter_count: number;
    }
  >(sql, params);

  if (results.length === 0) {
    return null;
  }

  const item = results[0];

  // Generate explanation
  const explanation = generateExplanation({
    waiting_on_me: item.waiting_on_me_contribution,
    known_customer: item.known_customer_contribution,
    recent_activity: item.recent_activity_contribution,
    quick_win: item.quick_win_contribution,
    community_interest: item.community_interest_contribution,
  });

  const result: NextWorkItemRow = {
    item_type: item.item_type,
    repo_full_name: item.repo_full_name,
    number: item.number,
    title: item.title,
    stalled: item.stalled,
    turn: item.turn,
    last_interaction_at: item.last_interaction_at,
    updated_at: item.updated_at,
    github_id: item.github_id,
    explanation,
  };

  // Include scoring details if requested
  if (includeScoring) {
    result.scoring = {
      base_score: item.base_score,
      preference_boost: item.preference_boost,
      total_score: item.total_score,
      waiting_on_me_contribution: item.waiting_on_me_contribution,
      known_customer_contribution: item.known_customer_contribution,
      recent_activity_contribution: item.recent_activity_contribution,
      quick_win_contribution: item.quick_win_contribution,
      community_interest_contribution: item.community_interest_contribution,
      signals: {
        is_known_customer_author: item.is_known_customer_author,
        is_repo_maintained_or_starred: item.is_repo_maintained_or_starred,
        waiting_on_me: item.waiting_on_me,
        quick_win: item.quick_win,
        reaction_score: item.reaction_score,
        unique_commenter_count: item.unique_commenter_count,
        last_activity_at: item.last_activity_at,
      },
    };
  }

  return result;
}
