-- User Item Interactions Materialized View
-- 
-- This materialized view aggregates user interactions with issues and pull requests.
-- It tracks the last interaction time for each user-item pair, combining:
-- - Issue comments (via issue_comments table)
-- - PR reviews (via pull_request_reviews table)
--
-- The view is useful for:
-- - Finding users who have interacted with specific items
-- - Determining the last interaction time for any user-item pair
-- - Analyzing user engagement patterns across issues and PRs

CREATE MATERIALIZED VIEW user_item_interactions_mv AS
WITH issue_interactions AS (
  SELECT
    gu.github_id       AS user_github_id,
    'issue'            AS item_type,
    ic.issue_github_id AS item_github_id,
    MAX(ic.created_at) AS last_interaction_at
  FROM issue_comments ic
  JOIN github_users gu
    ON gu.login = ic.author_login
  GROUP BY
    gu.github_id,
    ic.issue_github_id
),

pr_review_interactions AS (
  SELECT
    gu.github_id        AS user_github_id,
    'pr'                AS item_type,
    prr.pr_github_id    AS item_github_id,
    MAX(prr.submitted_at) AS last_interaction_at
  FROM pull_request_reviews prr
  JOIN github_users gu
    ON gu.login = prr.reviewer_login
  GROUP BY
    gu.github_id,
    prr.pr_github_id
)

SELECT * FROM issue_interactions
UNION ALL
SELECT * FROM pr_review_interactions;

-- Indexes for common query patterns
CREATE UNIQUE INDEX idx_user_item_interactions_mv_pk
  ON user_item_interactions_mv (
    user_github_id,
    item_type,
    item_github_id
  );

CREATE INDEX idx_user_item_interactions_mv_user
  ON user_item_interactions_mv (user_github_id);

CREATE INDEX idx_user_item_interactions_mv_last_interaction
  ON user_item_interactions_mv (last_interaction_at);
