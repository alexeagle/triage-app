-- Reset Sync State
-- 
-- Use these queries to manually reset the last sync timestamp to a date in the past.
-- This forces the incremental sync to re-process issues/PRs from that date forward,
-- which can help catch missed state changes (like closed issues).
--
-- Example: Reset to 2 weeks ago to catch issues that were closed but missed.

-- First, find the repo_github_id for a specific repository
-- Replace 'bazel-contrib/bazel-lib' with your repo name
SELECT 
  github_id,
  full_name,
  name
FROM repos
WHERE full_name = 'bazel-contrib/bazel-lib';

-- Check current sync state for a repository
-- Replace <repo_github_id> with the github_id from above
SELECT 
  repo_github_id,
  last_issue_sync,
  last_pr_sync,
  updated_at
FROM sync_state
WHERE repo_github_id = <repo_github_id>;

-- Reset last_issue_sync to 2 weeks ago for a specific repository
-- Replace <repo_github_id> with the actual github_id
UPDATE sync_state
SET 
  last_issue_sync = NOW() - INTERVAL '14 days',
  updated_at = NOW()
WHERE repo_github_id = <repo_github_id>;

-- Reset last_pr_sync to 2 weeks ago for a specific repository
-- Replace <repo_github_id> with the actual github_id
UPDATE sync_state
SET 
  last_pr_sync = NOW() - INTERVAL '14 days',
  updated_at = NOW()
WHERE repo_github_id = <repo_github_id>;

-- Reset both issue and PR sync to 2 weeks ago for a specific repository
-- Replace <repo_github_id> with the actual github_id
UPDATE sync_state
SET 
  last_issue_sync = NOW() - INTERVAL '14 days',
  last_pr_sync = NOW() - INTERVAL '14 days',
  updated_at = NOW()
WHERE repo_github_id = <repo_github_id>;

-- Reset sync state for ALL repositories to 2 weeks ago
-- WARNING: This will cause a large re-sync on the next incremental sync run
-- UPDATE sync_state
-- SET 
--   last_issue_sync = NOW() - INTERVAL '14 days',
--   last_pr_sync = NOW() - INTERVAL '14 days',
--   updated_at = NOW();

-- Reset to a specific date (example: November 1, 2025)
-- Replace <repo_github_id> and the date as needed
-- UPDATE sync_state
-- SET 
--   last_issue_sync = '2025-11-01 00:00:00+00'::timestamp with time zone,
--   last_pr_sync = '2025-11-01 00:00:00+00'::timestamp with time zone,
--   updated_at = NOW()
-- WHERE repo_github_id = <repo_github_id>;

-- Example: Reset bazel-contrib/bazel-lib to 2 weeks ago
-- First get the repo_github_id:
-- SELECT github_id FROM repos WHERE full_name = 'bazel-contrib/bazel-lib';
-- Then use that ID (e.g., 425866965):
-- UPDATE sync_state
-- SET 
--   last_issue_sync = NOW() - INTERVAL '14 days',
--   last_pr_sync = NOW() - INTERVAL '14 days',
--   updated_at = NOW()
-- WHERE repo_github_id = 425866965;
