-- Next Work Item Query
-- 
-- Selects the single best "next thing to work on" for a logged-in user.
-- Combines issues and PRs, applies eligibility filters, scores items, and returns the top result.
--
-- Parameters:
--   :user_github_id - GitHub ID of the logged-in user
--   :stall_interval - PostgreSQL interval string (default: '14 days')
--
-- Eligibility (hard filters):
--   - Item is open
--   - Repo is either starred by the user OR maintained by the user
--   - Item is actionable: turn = 'maintainer' OR assigned to the user
--   - Exclude draft PRs
--   - Exclude items waiting on author (turn = 'author')
--
-- Scoring (additive):
--   +50 if stalled = true
--   +30 if turn = 'maintainer'
--   +20 if item is assigned to the user
--   +15 if user has interacted before (exists in user_item_interactions_mv)
--   +10 if item updated in last 48 hours
--   -10 if item updated more than 30 days ago

WITH user_info AS (
  -- Get user's login from github_id
  -- If user doesn't exist, this returns no rows and the query will return no results
  SELECT login
  FROM github_users
  WHERE github_id = :user_github_id
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
    (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - :stall_interval::interval) AS stalled,
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
    ON uii.user_github_id = :user_github_id
    AND uii.item_type = 'issue'
    AND uii.item_github_id = i.github_id
  WHERE i.state = 'open'
    -- Repo is either starred by user OR maintained by user
    AND (
      EXISTS (
        SELECT 1 FROM repo_stars rs
        WHERE rs.repo_github_id = r.github_id
        AND rs.user_github_id = :user_github_id
      )
      OR EXISTS (
        SELECT 1 FROM repo_maintainers rm
        WHERE rm.repo_github_id = r.github_id
        AND rm.github_user_id = :user_github_id
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
    (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - :stall_interval::interval) AS stalled,
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
    ON uii.user_github_id = :user_github_id
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
        AND rs.user_github_id = :user_github_id
      )
      OR EXISTS (
        SELECT 1 FROM repo_maintainers rm
        WHERE rm.repo_github_id = r.github_id
        AND rm.github_user_id = :user_github_id
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
    SELECT * FROM eligible_issues
    UNION ALL
    SELECT * FROM eligible_prs
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
  updated_at
FROM scored_items
ORDER BY score DESC, updated_at DESC
LIMIT 1;
