-- Issue Turns View
-- 
-- This view computes "whose turn is it" for each open issue.
-- Determines whether it's the maintainer's turn or the author's turn to respond.
--
-- Rules:
-- 1. If an issue has NO comments by a maintainer:
--    → turn = 'maintainer'
-- 2. Else, look at the most recent comment (by created_at):
--    a. If last comment author is a maintainer:
--       → turn = 'author'
--    b. If last comment author is the issue author:
--       → turn = 'maintainer'
--    c. Otherwise (third party commenter):
--       → turn = 'maintainer'

CREATE OR REPLACE VIEW issue_turns AS
WITH last_comments AS (
  -- Get the most recent comment for each open issue
  SELECT DISTINCT ON (ic.issue_github_id)
    ic.issue_github_id,
    ic.created_at as last_comment_at,
    ic.author_login as last_comment_author,
    ic.comment_github_id
  FROM issue_comments ic
  INNER JOIN issues i ON ic.issue_github_id = i.github_id
  WHERE i.state = 'open'
  ORDER BY ic.issue_github_id, ic.created_at DESC, ic.comment_github_id DESC
),
last_maintainer_comments AS (
  -- Get the most recent comment by a maintainer (non-bot) for each open issue
  -- This will be NULL if no maintainer has commented
  SELECT DISTINCT ON (ic.issue_github_id)
    ic.issue_github_id,
    ic.created_at as last_maintainer_action_at
  FROM issue_comments ic
  INNER JOIN issues i ON ic.issue_github_id = i.github_id
  INNER JOIN github_users gu ON ic.author_login = gu.login
  WHERE i.state = 'open'
    AND gu.is_maintainer = true
    AND (gu.type IS NULL OR gu.type != 'Bot')
    AND LOWER(gu.login) NOT LIKE '%bot%'
  ORDER BY ic.issue_github_id, ic.created_at DESC, ic.comment_github_id DESC
),
has_maintainer_comment AS (
  -- Check if issue has any comments by maintainers (non-bot)
  -- This will be NULL if no maintainer has commented
  SELECT DISTINCT
    ic.issue_github_id,
    true as has_maintainer_comment
  FROM issue_comments ic
  INNER JOIN issues i ON ic.issue_github_id = i.github_id
  INNER JOIN github_users gu ON ic.author_login = gu.login
  WHERE i.state = 'open'
    AND gu.is_maintainer = true
    AND (gu.type IS NULL OR gu.type != 'Bot')
    AND LOWER(gu.login) NOT LIKE '%bot%'
)
SELECT 
  i.github_id as issue_github_id,
  r.full_name as repo_full_name,
  i.number as issue_number,
  i.title,
  CASE
    -- Rule 1: If issue has NO comments by a maintainer → maintainer's turn
    -- This covers both: no comments at all, or comments exist but none by maintainers
    WHEN hmc.has_maintainer_comment IS NULL THEN 'maintainer'
    -- Rule 2: Look at the most recent comment
    -- Rule 2a: If last comment author is a maintainer (non-bot) → author's turn
    WHEN gu_last.is_maintainer = true 
         AND (gu_last.type IS NULL OR gu_last.type != 'Bot')
         AND LOWER(gu_last.login) NOT LIKE '%bot%' THEN 'author'
    -- Rule 2b: If last comment author is the issue author → maintainer's turn
    WHEN lc.last_comment_author = i.author_login THEN 'maintainer'
    -- Rule 2c: Otherwise (third party commenter) → maintainer's turn
    ELSE 'maintainer'
  END as turn,
  lc.last_comment_at,
  lc.last_comment_author,
  -- last_maintainer_action_at: most recent maintainer comment, or issue creation date if none
  COALESCE(lmc.last_maintainer_action_at, i.created_at) as last_maintainer_action_at
FROM issues i
INNER JOIN repos r ON i.repo_github_id = r.github_id
LEFT JOIN last_comments lc ON i.github_id = lc.issue_github_id
LEFT JOIN github_users gu_last ON lc.last_comment_author = gu_last.login
LEFT JOIN has_maintainer_comment hmc ON i.github_id = hmc.issue_github_id
LEFT JOIN last_maintainer_comments lmc ON i.github_id = lmc.issue_github_id
WHERE i.state = 'open'
ORDER BY i.github_id;
