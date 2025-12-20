-- Add work item preference columns to users table
-- 
-- These preferences allow users to bias the "What should I work on next?" feature
-- by boosting certain types of issues/PRs in the ranking algorithm.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS prefer_known_customers BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS prefer_recent_activity BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS prefer_waiting_on_me BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS prefer_quick_wins BOOLEAN NOT NULL DEFAULT true;

-- Comments for documentation
COMMENT ON COLUMN users.prefer_known_customers IS 'User preference: boost issues/PRs authored by known customers';
COMMENT ON COLUMN users.prefer_recent_activity IS 'User preference: boost issues/PRs with recent comments or updates';
COMMENT ON COLUMN users.prefer_waiting_on_me IS 'User preference: boost issues/PRs where maintainer action is the blocker';
COMMENT ON COLUMN users.prefer_quick_wins IS 'User preference: boost issues/PRs likely resolvable with a single maintainer action';
