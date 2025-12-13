-- Fix Closed Issues Query
-- 
-- Finds issues that are marked as 'open' in the database but are actually closed on GitHub.
-- This can happen if an issue was closed before the last incremental sync timestamp.
--
-- Usage: Run this query to identify issues that need manual fixing, or use it
-- as part of a backfill process to update issue states.

-- Find issues that are open in DB but should be closed
-- (This is a diagnostic query - you'd need to verify against GitHub API)
SELECT 
  i.github_id,
  i.repo_github_id,
  r.full_name as repo_full_name,
  i.number,
  i.title,
  i.state as db_state,
  i.updated_at as db_updated_at,
  i.closed_at as db_closed_at,
  i.synced_at
FROM issues i
INNER JOIN repos r ON i.repo_github_id = r.github_id
WHERE i.state = 'open'
  AND i.closed_at IS NULL
  -- Issues that haven't been updated recently might be closed
  -- Adjust the date threshold based on your needs
  AND i.updated_at < NOW() - INTERVAL '30 days'
ORDER BY i.updated_at DESC;

-- To manually fix a specific issue:
-- UPDATE issues 
-- SET state = 'closed', closed_at = '<actual_closed_at_from_github>', updated_at = '<actual_updated_at_from_github>'
-- WHERE github_id = <github_id>;
